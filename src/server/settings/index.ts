import { db } from "../db";
import { appSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

const APP_SECRET = process.env.APP_SECRET || "fallback-secret-key-at-least-32-chars-long";

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(APP_SECRET).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  const [ivHex, authTagHex, encryptedDataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = crypto.createHash("sha256").update(APP_SECRET).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedDataHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  try {
    const record = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .get();
    if (!record) return null;
    const decrypted = decrypt(record.value);
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error(`Failed to get setting ${key}:`, error);
    return null;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  const encrypted = encrypt(serialized);
  await db
    .insert(appSettings)
    .values({ key, value: encrypted, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: encrypted, updatedAt: new Date().toISOString() },
    })
    .run();
}
