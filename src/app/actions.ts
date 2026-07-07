"use server";

import { createRequest } from "@/server/requests";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requests } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { checkAuth } from "@/server/auth";

import { deleteDebridTorrent } from "@/server/requests/debrid";
import { mediaItems, mediaFiles, seriesEpisodes, seriesSeasons } from "@/server/db/schema";
import * as fs from "fs";
import * as path from "path";

export async function handleRequestAction(formData: FormData) {
  const tmdbId = parseInt(formData.get("tmdbId") as string, 10);
  const mediaType = formData.get("mediaType") as "movie" | "series";
  const query = formData.get("query") as string;
  const libraryId = formData.get("libraryId") as string;

  await createRequest(tmdbId, mediaType, "Balanced", libraryId);
  redirect(`/?q=${encodeURIComponent(query)}`);
}

export async function deleteMediaFilesFromDisk(mediaItemId: string) {
  // Fetch movie files
  const movieFiles = await db
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.mediaItemId, mediaItemId))
    .all();

  // Fetch episode files
  const episodeFiles = await db
    .select({ path: mediaFiles.path })
    .from(seriesEpisodes)
    .innerJoin(seriesSeasons, eq(seriesEpisodes.seasonId, seriesSeasons.id))
    .innerJoin(mediaFiles, eq(mediaFiles.episodeId, seriesEpisodes.id))
    .where(eq(seriesSeasons.seriesId, mediaItemId))
    .all();

  const allFiles = [...movieFiles, ...episodeFiles];

  for (const file of allFiles) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`Deleted file from disk: ${file.path}`);
        
        let parentDir = path.dirname(file.path);
        const libDir = path.resolve("./data/Libraries");
        
        // Recursively remove empty directories up to the Libraries root
        while (parentDir && parentDir.startsWith(libDir) && parentDir !== libDir) {
          if (fs.readdirSync(parentDir).length === 0) {
            fs.rmdirSync(parentDir);
            console.log(`Deleted empty parent directory: ${parentDir}`);
            parentDir = path.dirname(parentDir);
          } else {
            break;
          }
        }
      }
    } catch (err) {
      console.error(`Failed to delete file or directory for path ${file.path}:`, err);
    }
  }
}

export async function cancelRequestAndCleanup(requestId: string) {
  const req = await db.select().from(requests).where(eq(requests.id, requestId)).get();
  if (!req) return;

  // 1. Delete torrent from Real-Debrid if active
  if (req.debridId) {
    await deleteDebridTorrent(req.debridId);
  }

  // 2. Delete files from physical disk
  await deleteMediaFilesFromDisk(req.mediaItemId);

  // 3. Delete media item from DB (cascades automatically to all associated tables)
  await db.delete(mediaItems).where(eq(mediaItems.id, req.mediaItemId)).run();

  // 4. Delete request record
  await db.delete(requests).where(eq(requests.id, requestId)).run();
}

export async function handleCancelRequestAction(formData: FormData) {
  await checkAuth();
  const requestId = formData.get("requestId") as string;
  const redirectUrl = formData.get("redirectUrl") as string || "/";

  if (requestId) {
    await cancelRequestAndCleanup(requestId);
  }
  redirect(redirectUrl);
}
