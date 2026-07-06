import { db } from "../db";
import { mediaItems, requests, mediaFiles, seriesEpisodes, seriesSeasons, libraries } from "../db/schema";
import { eq, and, or, like, sql, notInArray } from "drizzle-orm";
import { getMovieMetadata, getTVMetadata } from "../metadata/tmdb";

// Create a new download request
export async function createRequest(
  tmdbId: number,
  type: "movie" | "series",
  qualityProfile = "Balanced",
  libraryId?: string
) {
  const mediaItemId = `tmdb-${type}-${tmdbId}`;

  // Resolve target library
  let targetLibId = libraryId;
  if (!targetLibId) {
    const matchedLib = await db
      .select()
      .from(libraries)
      .where(eq(libraries.type, type))
      .get();
    
    if (matchedLib) {
      targetLibId = matchedLib.id;
    } else {
      const { seedDefaultLibraries } = await import("../metadata/scanner");
      const libs = await seedDefaultLibraries();
      const refLib = libs.find((l) => l.type === type);
      targetLibId = refLib?.id || "lib-movies";
    }
  }

  // 1. Ensure metadata is cached ("Just Info")
  let item = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaItemId)).get();
  if (!item) {
    if (type === "movie") {
      const meta = await getMovieMetadata(tmdbId);
      if (meta) {
        // Cache movie metadata
        await db.insert(mediaItems)
          .values({
            id: mediaItemId,
            tmdbId,
            imdbId: meta.imdb_id || null,
            type: "movie",
            title: meta.title,
            originalTitle: meta.original_title,
            tagline: meta.tagline || null,
            overview: meta.overview,
            releaseDate: meta.release_date || null,
            runtime: meta.runtime || null,
            posterPath: meta.poster_path || null,
            backdropPath: meta.backdrop_path || null,
            rating: meta.vote_average || null,
          })
          .run();
      }
    } else {
      const meta = await getTVMetadata(tmdbId);
      if (meta) {
        // Cache series metadata
        await db.insert(mediaItems)
          .values({
            id: mediaItemId,
            tmdbId,
            type: "series",
            title: meta.name,
            originalTitle: meta.original_name,
            overview: meta.overview,
            releaseDate: meta.first_air_date || null,
            posterPath: meta.poster_path || null,
            backdropPath: meta.backdrop_path || null,
            rating: meta.vote_average || null,
            status: meta.status || null,
          })
          .run();
      }
    }
  }

  // 2. Add entry to request queue ("Wanted")
  const requestId = `request-${tmdbId}-${Date.now()}`;
  await db.insert(requests)
    .values({
      id: requestId,
      libraryId: targetLibId,
      mediaItemId,
      status: "REQUESTED",
      qualityProfile,
      progress: 0,
    })
    .run();

  return requestId;
}

// Get library items matching the state filter (async for libsql)
export async function getLibraryItems(
  stateFilter: "all" | "here" | "wanted" | "info",
  searchQuery = ""
) {
  // Base query: fetch media items
  let conditions: any[] = [];
  
  if (searchQuery) {
    conditions.push(like(mediaItems.title, `%${searchQuery}%`));
  }

  const allItems = await db.select().from(mediaItems).where(conditions.length ? and(...conditions) : undefined).all();

  // Load state matrices asynchronously
  const mapped = await Promise.all(allItems.map(async (item) => {
    let isHere = false;
    let localFiles: any[] = [];

    if (item.type === "movie") {
      localFiles = await db
        .select()
        .from(mediaFiles)
        .where(eq(mediaFiles.mediaItemId, item.id))
        .all();
      isHere = localFiles.length > 0;
    } else {
      // TV Series
      const seasons = await db
        .select()
        .from(seriesSeasons)
        .where(eq(seriesSeasons.seriesId, item.id))
        .all();
      
      const seasonIds = seasons.map((s) => s.id);
      if (seasonIds.length > 0) {
        const episodes = await db
          .select()
          .from(seriesEpisodes)
          .where(sql`${seriesEpisodes.seasonId} IN (${sql.join(seasonIds.map(id => sql`${id}`), sql`, `)})`)
          .all();
        
        const episodeIds = episodes.map((e) => e.id);
        if (episodeIds.length > 0) {
          localFiles = await db
            .select()
            .from(mediaFiles)
            .where(sql`${mediaFiles.episodeId} IN (${sql.join(episodeIds.map(id => sql`${id}`), sql`, `)})`)
            .all();
          isHere = localFiles.length > 0;
        }
      }
    }

    // Check if "Wanted"
    const activeRequest = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.mediaItemId, item.id),
          notInArray(requests.status, ["COMPLETED", "FAILED", "CANCELLED"])
        )
      )
      .get();
    
    const isWanted = !!activeRequest;

    let computedState: "here" | "wanted" | "info" = "info";
    if (isHere) computedState = "here";
    else if (isWanted) computedState = "wanted";

    return {
      ...item,
      state: computedState,
      activeRequest: activeRequest || null,
      fileCount: localFiles.length,
      resolutions: Array.from(new Set(localFiles.map(f => f.videoResolution).filter(Boolean))),
    };
  }));

  return mapped.filter((item) => {
    if (stateFilter === "all") return true;
    return item.state === stateFilter;
  });
}
