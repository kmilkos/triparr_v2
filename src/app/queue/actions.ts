"use server";

import { db } from "@/server/db";
import { requests } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { checkAuth } from "@/server/auth";
import { redirect } from "next/navigation";
import { addTorrentOrMagnetToDebrid } from "@/server/requests/debrid";

export async function handleCancelRequest(formData: FormData) {
  await checkAuth();
  const requestId = formData.get("requestId") as string;
  if (requestId) {
    await db.delete(requests).where(eq(requests.id, requestId)).run();
  }
  redirect("/queue?success=Request cancelled");
}

export async function handleRetryRequest(formData: FormData) {
  await checkAuth();
  const requestId = formData.get("requestId") as string;
  if (requestId) {
    await db
      .update(requests)
      .set({
        status: "REQUESTED",
        progress: 0,
        speed: null,
        eta: null,
        debridId: null,
        releaseTitle: null,
        releaseSize: null,
        error: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requests.id, requestId))
      .run();
  }
  redirect("/queue?success=Request scheduled for retry");
}

export async function handleSelectRelease(formData: FormData) {
  await checkAuth();
  const requestId = formData.get("requestId") as string;
  const downloadUrl = formData.get("downloadUrl") as string;
  const title = formData.get("title") as string;
  const size = parseInt(formData.get("size") as string, 10) || 0;

  if (!requestId || !downloadUrl) {
    redirect("/queue?error=Invalid selection parameters");
  }

  try {
    const debridId = await addTorrentOrMagnetToDebrid(downloadUrl);
    await db
      .update(requests)
      .set({
        status: "SEARCHING",
        debridId,
        releaseTitle: title,
        releaseSize: size,
        progress: 0,
        error: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requests.id, requestId))
      .run();

    redirect("/queue?success=Manual release submitted to Real-Debrid successfully!");
  } catch (error: any) {
    redirect(`/queue?error=Failed to submit manually: ${encodeURIComponent(error.message || error)}`);
  }
}
