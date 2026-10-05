import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

/** Подключение создаётся при первом обращении, поэтому сборка не требует DATABASE_URL. */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Не задан DATABASE_URL. См. .env.example");
  }
  // В serverless на каждый экземпляр хватает одного соединения. prepare: false нужен для пулеров (pgbouncer, Neon).
  globalForDb.pgClient ??= postgres(url, {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    prepare: false,
  });
  return drizzle(globalForDb.pgClient, { schema });
}

export * as tables from "./schema";
