import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

export function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(uri);
    globalForMongo.mongoClientPromise = client.connect();
  }

  return globalForMongo.mongoClientPromise;
}

let indexesPromise: Promise<void> | null = null;

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const name = process.env.MONGODB_DB;
  const db = name ? client.db(name) : client.db();

  if (!indexesPromise) {
    indexesPromise = Promise.all([
      db.collection("conversations").createIndex({ userId: 1, updatedAt: -1 }),
      db.collection("messages").createIndex({ conversationId: 1, createdAt: 1 }),
      db.collection("messages").createIndex({ userId: 1, role: 1, createdAt: 1 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexesPromise = null;
        throw error;
      });
  }

  await indexesPromise;
  return db;
}
