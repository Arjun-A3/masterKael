import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  lessonTitle,
  readQuestion,
  type QuestionSession,
} from "@/lib/question";

export type Role = "user" | "assistant";

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type StoredMessage = {
  id: string;
  role: Role;
  content: string;
};

function asId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export async function listConversations(
  userId: string,
): Promise<ConversationSummary[]> {
  const db = await getDb();
  const docs = await db
    .collection("conversations")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    title: String(doc.title || "Lesson"),
    updatedAt: new Date(doc.updatedAt as Date).toISOString(),
  }));
}

export async function getConversation(userId: string, id: string) {
  const _id = asId(id);
  if (!_id) return null;
  const db = await getDb();
  const conversation = await db
    .collection("conversations")
    .findOne({ _id, userId });
  if (!conversation) return null;

  const messages = await db
    .collection("messages")
    .find({ conversationId: _id, userId })
    .sort({ createdAt: 1 })
    .toArray();

  return {
    id,
    title: String(conversation.title || "Problem"),
    question: readQuestion(conversation.question),
    messages: messages.map((message) => ({
      id: message._id.toString(),
      role: message.role as Role,
      content: String(message.content),
    })),
  };
}

export async function createConversation(userId: string, title: string) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection("conversations").insertOne({
    userId,
    title,
    createdAt: now,
    updatedAt: now,
  });
  return result.insertedId;
}

export async function addMessage(
  userId: string,
  conversationId: ObjectId,
  role: Role,
  content: string,
) {
  const db = await getDb();
  const result = await db.collection("messages").insertOne({
    userId,
    conversationId,
    role,
    content,
    createdAt: new Date(),
  });
  return result.insertedId;
}

export async function saveQuestion(
  userId: string,
  conversationId: ObjectId,
  question: QuestionSession,
) {
  const db = await getDb();
  await db.collection("conversations").updateOne(
    { _id: conversationId, userId },
    {
      $set: {
        question,
        title: lessonTitle(question, "Problem"),
        updatedAt: new Date(),
      },
    },
  );
}

export async function touchConversation(userId: string, conversationId: ObjectId) {
  const db = await getDb();
  await db.collection("conversations").updateOne(
    { _id: conversationId, userId },
    { $set: { updatedAt: new Date() } },
  );
}

export async function deleteMessage(userId: string, messageId: ObjectId) {
  const db = await getDb();
  await db.collection("messages").deleteOne({ _id: messageId, userId });
}

export async function deleteConversation(userId: string, id: string) {
  const _id = asId(id);
  if (!_id) return false;
  const db = await getDb();
  const result = await db.collection("conversations").deleteOne({ _id, userId });
  if (!result.deletedCount) return false;
  await db.collection("messages").deleteMany({ conversationId: _id, userId });
  return true;
}

export function titleFrom(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= 64) return clean;
  return `${clean.slice(0, 63).trimEnd()}…`;
}
