"use server";

import { createRequest } from "@/server/requests";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requests } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { checkAuth } from "@/server/auth";

export async function handleRequestDetails(formData: FormData) {
  const tmdbId = parseInt(formData.get("tmdbId") as string, 10);
  const itemType = formData.get("itemType") as "movie" | "series";
  const itemId = formData.get("itemId") as string;
  const libraryId = formData.get("libraryId") as string;

  await createRequest(tmdbId, itemType, "Balanced", libraryId);
  redirect(`/library/${itemId}`);
}

export async function handleCancelRequest(formData: FormData) {
  await checkAuth();
  const requestId = formData.get("requestId") as string;
  const itemId = formData.get("itemId") as string;

  if (requestId) {
    await db.delete(requests).where(eq(requests.id, requestId)).run();
  }
  redirect(`/library/${itemId}`);
}

