import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./index";
import * as path from "path";
import * as fs from "fs";

export async function runMigrations() {
  const migrationsFolder = path.resolve("./drizzle");
  
  if (!fs.existsSync(migrationsFolder)) {
    console.warn(`Migrations folder not found at ${migrationsFolder}. Skipping migration.`);
    return;
  }

  console.log("Running Drizzle migrations...");
  try {
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}
