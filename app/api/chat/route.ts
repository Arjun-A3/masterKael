import { ObjectId } from "mongodb";
import { isTitleSlug, loadLeetCodeProblem } from "@/lib/leetcode";
import { LlmError, modelConfigError, streamReply, type ChatTurn } from "@/lib/llm";
import { createSessionSplitter, lessonBrief, lessonTitle, parseQuestionUpdate, type QuestionSession } from "@/lib/question";
import { requireUser } from "@/lib/session";
import {
  addMessage,
  createConversation,
  deleteConversation,
  deleteMessage,
  getConversation,
  saveQuestion,
  titleFrom,
  touchConversation,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGE = 8000;

function failureEvent(error: unknown): { error: string; code?: string } {
  if (error instanceof LlmError) return { error: error.message, code: error.code };
  return {
    error: error instanceof Error ? error.message : "The model could not answer.",
  };
}

export async function POST(request: Request) {
  const gate = await requireUser();
  if (gate.error) return gate.error;
  const userId = gate.userId;

  const configError = modelConfigError();
  if (configError) {
    return Response.json({ error: configError }, { status: 503 });
  }

  let body: { conversationId?: unknown; message?: unknown; titleSlug?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a message." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "Send a message." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return Response.json(
      { error: "That message is too long. Keep it under 8000 characters." },
      { status: 400 },
    );
  }

  const requestedId =
    typeof body.conversationId === "string" ? body.conversationId : "";
  const titleSlug = typeof body.titleSlug === "string" ? body.titleSlug.trim() : "";
  if (titleSlug && !isTitleSlug(titleSlug)) {
    return Response.json({ error: "That problem link is not valid." }, { status: 400 });
  }

  let seeded: QuestionSession | null = null;
  if (!requestedId && titleSlug) {
    try {
      seeded = await loadLeetCodeProblem(titleSlug);
    } catch (error) {
      console.error(error);
      return Response.json({ error: "Could not reach LeetCode." }, { status: 502 });
    }
    if (!seeded) {
      return Response.json({ error: "No LeetCode problem matches that." }, { status: 404 });
    }
  }

  let conversationId: ObjectId;
  let createdNow = false;
  let previousQuestion: QuestionSession | null = null;
  let historySeed: ChatTurn[] = [];

  try {
    if (requestedId) {
      const existing = await getConversation(userId, requestedId);
      if (!existing) {
        return Response.json({ error: "Lesson not found." }, { status: 404 });
      }
      conversationId = new ObjectId(requestedId);
      previousQuestion = existing.question;
      historySeed = existing.messages.map((item) => ({
        role: item.role,
        content: item.content,
      }));
    } else {
      conversationId = await createConversation(
        userId,
        seeded ? lessonTitle(seeded) : titleFrom(message),
      );
      createdNow = true;
      if (seeded) {
        await saveQuestion(userId, conversationId, seeded);
        previousQuestion = seeded;
      }
    }
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Could not reach the database." },
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let userMessageId: ObjectId | null = null;
      let assistantSaved = false;
      let full = "";

      const rollback = async () => {
        if (userMessageId) await deleteMessage(userId, userMessageId);
        if (createdNow) await deleteConversation(userId, conversationId.toString());
      };

      try {
        userMessageId = await addMessage(userId, conversationId, "user", message);
        send({
          conversationId: conversationId.toString(),
          ...(previousQuestion ? { session: previousQuestion } : {}),
        });

        const history: ChatTurn[] = [...historySeed, { role: "user", content: message }];
        const splitter = createSessionSplitter();
        for await (const token of streamReply(history, request.signal, lessonBrief(previousQuestion))) {
          const visible = splitter.push(token);
          if (!visible) continue;
          full += visible;
          send({ token: visible });
        }
        const rest = splitter.finish();
        if (rest.visible) {
          full += rest.visible;
          send({ token: rest.visible });
        }

        if (!full.trim()) {
          await rollback();
          send({ error: "master kael returned an empty reply." });
          return;
        }

        const question = parseQuestionUpdate(rest.sessionRaw, previousQuestion);
        await addMessage(userId, conversationId, "assistant", full);
        assistantSaved = true;
        if (question) {
          await saveQuestion(userId, conversationId, question);
          send({ session: question });
        } else {
          await touchConversation(userId, conversationId);
        }
        send({ done: true });
      } catch (error) {
        console.error(error);
        if (request.signal.aborted && full.trim() && !assistantSaved) {
          try {
            await addMessage(userId, conversationId, "assistant", full);
            await touchConversation(userId, conversationId);
          } catch (saveError) {
            console.error(saveError);
          }
          return;
        }

        if (assistantSaved) {
          try {
            send(failureEvent(error));
          } catch {
            // The client already went away.
          }
          return;
        }

        if (!full.trim()) {
          try {
            await rollback();
          } catch (rollbackError) {
            console.error(rollbackError);
          }
        } else {
          try {
            await addMessage(userId, conversationId, "assistant", full);
            await touchConversation(userId, conversationId);
          } catch (saveError) {
            console.error(saveError);
          }
        }

        try {
          send(failureEvent(error));
        } catch {
          // The client already went away.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
