import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import * as path from "path";
import * as fs from "fs";

const dbPath = process.env.DATABASE_PATH || "./data/triparr.sqlite";

// Ensure database parent directory exists
const resolvedPath = path.resolve(dbPath);
const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const url = `file:${resolvedPath}`;
const client = createClient({ url });

// Enable Write-Ahead Logging (WAL) and set a busy timeout of 5000ms to prevent database locks (SQLITE_BUSY)
try {
  client.execute("PRAGMA journal_mode = WAL;");
  client.execute("PRAGMA busy_timeout = 5000;");
} catch (err) {
  console.error("Failed to execute SQLite PRAGMA commands:", err);
}

export const db = drizzle(client, { schema });
export type DbType = typeof db;
export * as schema from "./schema";
export { client };
