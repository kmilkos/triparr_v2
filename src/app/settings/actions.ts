"use server";

import { setSetting } from "@/server/settings";
import { db } from "@/server/db";
import { libraries } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { scanLibrary } from "@/server/metadata/scanner";
import { checkAuth } from "@/server/auth";
import { redirect } from "next/navigation";
import * as fs from "fs";
import * as path from "path";

export async function handleSaveSettings(formData: FormData) {
  const tmdb_api_token = formData.get("tmdb_api_token") as string;
  const prowlarr_url = formData.get("prowlarr_url") as string;
  const prowlarr_api_key = formData.get("prowlarr_api_key") as string;
  const real_debrid_token = formData.get("real_debrid_token") as string;

  await setSetting("tmdb_api_token", tmdb_api_token.trim());
  await setSetting("prowlarr_url", prowlarr_url.trim());
  await setSetting("prowlarr_api_key", prowlarr_api_key.trim());
  await setSetting("real_debrid_token", real_debrid_token.trim());

  redirect("/settings?success=Settings updated");
}

export async function handleAddLibrary(formData: FormData) {
  const name = formData.get("name") as string;
  const folderPath = formData.get("path") as string;
  const type = formData.get("type") as "movie" | "series" | "video";

  if (!name || !folderPath || !type) {
    redirect("/settings?error=Please fill in all library fields");
  }

  try {
    const resolvedPath = path.resolve(folderPath.trim());
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    const libraryId = `lib-${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(libraries)
      .values({
        id: libraryId,
        name: name.trim(),
        path: resolvedPath,
        type,
      })
      .run();

    redirect("/settings?success=Library added successfully");
  } catch (e: any) {
    redirect(`/settings?error=${encodeURIComponent(e.message)}`);
  }
}

export async function handleDeleteLibrary(formData: FormData) {
  const libraryId = formData.get("libraryId") as string;
  if (!libraryId) return;

  try {
    await db.delete(libraries).where(eq(libraries.id, libraryId)).run();
    redirect("/settings?success=Library deleted");
  } catch (e: any) {
    redirect(`/settings?error=${encodeURIComponent(e.message)}`);
  }
}

export async function handleScan() {
  const results = await scanLibrary();
  redirect(
    `/settings?scan_success=1&movies=${results.moviesScanned}&episodes=${results.episodesScanned}`
  );
}

export async function handleSaveFilters(formData: FormData) {
  const resolutions = formData.getAll("resolutions") as string[];
  const maxMovieSizeGb = parseFloat(formData.get("max_movie_size_gb") as string) || 0;
  const maxEpisodeSizeGb = parseFloat(formData.get("max_episode_size_gb") as string) || 0;
  const minSeeders = parseInt(formData.get("min_seeders") as string, 10) || 0;
  const excludedKeywordsRaw = formData.get("excluded_keywords") as string;

  const excludedKeywords = excludedKeywordsRaw
    ? excludedKeywordsRaw.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)
    : [];

  const filters = {
    allowedResolutions: resolutions,
    maxMovieSizeGb,
    maxEpisodeSizeGb,
    minSeeders,
    excludedKeywords,
  };

  await setSetting("release_filters", filters);

  redirect("/settings?success=Filters saved successfully");
}

export async function listDirectories(targetPath: string) {
  await checkAuth();
  try {
    const resolvedPath = path.resolve(targetPath || "/");

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: "Directory does not exist", currentPath: resolvedPath, dirs: [], parentPath: null };
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return { success: false, error: "Path is not a directory", currentPath: resolvedPath, dirs: [], parentPath: null };
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });

    // Filter only directories and sort them alphabetically
    const dirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    // Get parent path
    const parentPath = path.dirname(resolvedPath);

    return {
      success: true,
      currentPath: resolvedPath,
      parentPath: resolvedPath === parentPath ? null : parentPath,
      dirs,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
      currentPath: targetPath,
      dirs: [],
      parentPath: null,
    };
  }
}


