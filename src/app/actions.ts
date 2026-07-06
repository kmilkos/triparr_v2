"use server";

import { createRequest } from "@/server/requests";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requests } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { checkAuth } from "@/server/auth";

export async function handleRequestAction(formData: FormData) {
  const tmdbId = parseInt(formData.get("tmdbId") as string, 10);
  const mediaType = formData.get("mediaType") as "movie" | "series";
  const query = formData.get("query") as string;
  const libraryId = formData.get("libraryId") as string;

  await createRequest(tmdbId, mediaType, "Balanced", libraryId);
  redirect(`/?q=${encodeURIComponent(query)}`);
}

export async function handleCancelRequestAction(formData: FormData) {
  await checkAuth();
  const requestId = formData.get("requestId") as string;
  const redirectUrl = formData.get("redirectUrl") as string || "/";

  if (requestId) {
    await db.delete(requests).where(eq(requests.id, requestId)).run();
  }
  redirect(redirectUrl);
}
