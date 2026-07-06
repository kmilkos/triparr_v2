import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ? `file:${process.env.DATABASE_PATH}` : "file:./data/triparr.sqlite",
  },
});
