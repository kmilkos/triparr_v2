"use server";

import { createRequest } from "@/server/requests";
import { redirect } from "next/navigation";

export async function handleRequestDetails(formData: FormData) {
  const tmdbId = parseInt(formData.get("tmdbId") as string, 10);
  const itemType = formData.get("itemType") as "movie" | "series";
  const itemId = formData.get("itemId") as string;
  const libraryId = formData.get("libraryId") as string;

  await createRequest(tmdbId, itemType, "Balanced", libraryId);
  redirect(`/library/${itemId}`);
}
