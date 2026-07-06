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

export const db = drizzle(client, { schema });
export type DbType = typeof db;
export * as schema from "./schema";
export { client };
