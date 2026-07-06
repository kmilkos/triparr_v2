"use server";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { hashPassword, createSession } from "@/server/auth";
import { redirect } from "next/navigation";

export async function handleRegister(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!username || !password) {
    redirect("/register?error=Missing credentials");
  }

  if (password !== confirmPassword) {
    redirect("/register?error=Passwords do not match");
  }

  let registerSuccessful = false;
  let registerErrorMsg = "";

  try {
    const passwordHash = hashPassword(password);
    const userId = `user-${Date.now()}`;
    
    await db.insert(users)
      .values({
        id: userId,
        username: username.trim(),
        passwordHash,
      })
      .run();

    await createSession(userId);
    registerSuccessful = true;
  } catch (e: any) {
    console.error(e);
    registerErrorMsg = e.message || "An unexpected error occurred";
  }

  if (registerSuccessful) {
    redirect("/");
  } else {
    redirect(`/register?error=${encodeURIComponent(registerErrorMsg)}`);
  }
}
