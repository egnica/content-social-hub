import "server-only";

import { MongoClient } from "mongodb";
import { getDatabaseName, requireEnv } from "@/lib/env";

const globalForMongo = globalThis;

function createClientPromise() {
  const uri = requireEnv("MONGODB_URI");
  const client = new MongoClient(uri, {
    maxPoolSize: 20,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 10_000,
  });

  return client.connect();
}

export function getMongoClient() {
  if (!globalForMongo.__contentSocialHubMongoClientPromise) {
    globalForMongo.__contentSocialHubMongoClientPromise = createClientPromise();
  }

  return globalForMongo.__contentSocialHubMongoClientPromise;
}

export async function getDb() {
  const client = await getMongoClient();
  return client.db(getDatabaseName());
}

export async function checkDatabaseConnection() {
  const db = await getDb();
  await db.command({ ping: 1 });

  return {
    database: db.databaseName,
    connected: true,
  };
}
