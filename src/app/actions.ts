"use server";

import { createRequest } from "@/server/requests";
import { redirect } from "next/navigation";

export async function handleRequestAction(formData: FormData) {
  const tmdbId = parseInt(formData.get("tmdbId") as string, 10);
  const mediaType = formData.get("mediaType") as "movie" | "series";
  const query = formData.get("query") as string;
  const libraryId = formData.get("libraryId") as string;

  await createRequest(tmdbId, mediaType, "Balanced", libraryId);
  redirect(`/?q=${encodeURIComponent(query)}`);
}
