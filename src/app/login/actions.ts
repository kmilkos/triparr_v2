"use server";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession } from "@/server/auth";
import { redirect } from "next/navigation";

export async function handleLogin(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    redirect("/login?error=Missing credentials");
  }

  let loginSuccessful = false;
  let loginErrorMsg = "";

  try {
    const user = await db.select().from(users).where(eq(users.username, username.trim())).get();
    if (!user) {
      loginErrorMsg = "Invalid username or password";
    } else {
      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        loginErrorMsg = "Invalid username or password";
      } else {
        await createSession(user.id);
        loginSuccessful = true;
      }
    }
  } catch (e: any) {
    console.error(e);
    loginErrorMsg = e.message || "An unexpected error occurred";
  }

  if (loginSuccessful) {
    redirect("/");
  } else {
    redirect(`/login?error=${encodeURIComponent(loginErrorMsg)}`);
  }
}
