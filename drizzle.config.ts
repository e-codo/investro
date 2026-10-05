import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit не читает .env.local сам, как это делает Next.js.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Для миграций лучше прямое соединение (Neon выдаёт его как DATABASE_URL_UNPOOLED), а не через пулер.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
