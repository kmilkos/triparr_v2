import { db } from "../db";
import { users, sessions } from "../db/schema";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === testHash;
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(); // 30 days
  
  await db.insert(sessions)
    .values({ id: sessionId, userId, expiresAt })
    .run();
  
  const cookieStore = await cookies();
  cookieStore.set("session_id", sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });

  return sessionId;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) return null;

  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }

  const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
  return user || null;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    cookieStore.delete("session_id");
  }
}

export async function checkAuth() {
  const allUsers = await db.select().from(users).all();
  if (allUsers.length === 0) {
    redirect("/register");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}
