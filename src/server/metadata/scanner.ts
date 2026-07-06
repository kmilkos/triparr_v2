import * as fs from "fs";
import * as path from "path";
import { execFile, execSync } from "child_process";
import { promisify } from "util";
import { db } from "../db";
import {
  mediaItems,
  seriesSeasons,
  seriesEpisodes,
  mediaFiles,
  mediaStreams,
  people,
  mediaPeople,
  genres,
  mediaGenres,
  studios,
  mediaStudios,
  libraries
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { parseFilename } from "./parser";
import {
  searchTMDB,
  getMovieMetadata,
  getTVMetadata,
  getTVSeasonMetadata
} from "./tmdb";

const execFileAsync = promisify(execFile);
const VIDEO_EXTENSIONS = new Set([".mkv", ".mp4", ".avi", ".m4v", ".mov", ".wmv"]);

// Cache the resolved path so we don't query it on every single file scan
let cachedFFprobePath: string | null = null;

export async function checkAndInstallFFprobe(): Promise<string> {
  if (cachedFFprobePath) return cachedFFprobePath;

  // 1. Try global path
  try {
    execSync("ffprobe -version", { stdio: "ignore" });
    console.log("Global ffprobe found in PATH.");
    cachedFFprobePath = "ffprobe";
    return "ffprobe";
  } catch (e) {
    // Check if local ffprobe exists
    const localBin = path.resolve("./data/bin");
    const localFFprobe = path.join(localBin, "ffprobe.exe");
    if (fs.existsSync(localFFprobe)) {
      console.log(`Local ffprobe found at ${localFFprobe}`);
      cachedFFprobePath = localFFprobe;
      return localFFprobe;
    }

    console.log("ffprobe not found. Installing static binary to ./data/bin...");
    if (!fs.existsSync(localBin)) {
      fs.mkdirSync(localBin, { recursive: true });
    }

    const zipPath = path.join(localBin, "ffprobe.zip");
    const url = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip";
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(zipPath, buffer);

      // Extract using powershell Expand-Archive on Windows
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${localBin}' -Force"`);
      fs.unlinkSync(zipPath);

      console.log(`ffprobe successfully installed locally at ${localFFprobe}`);
      cachedFFprobePath = localFFprobe;
      return localFFprobe;
    } catch (err) {
      console.error("Failed to download and install ffprobe static binary:", err);
      return "ffprobe";
    }
  }
}

interface FFprobeOutput {
  format?: {
    duration?: string;
    size?: string;
    bit_rate?: string;
    format_name?: string;
  };
  streams?: Array<{
    index: number;
    codec_type: "video" | "audio" | "subtitle";
    codec_name: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    channels?: number;
    tags?: Record<string, string>;
    disposition?: {
      default?: number;
      forced?: number;
    };
  }>;
}

export async function probeMediaFile(filePath: string): Promise<FFprobeOutput | null> {
  try {
    const executable = await checkAndInstallFFprobe();
    const { stdout } = await execFileAsync(
      executable,
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", filePath],
      { timeout: 10000 }
    );
    return JSON.parse(stdout) as FFprobeOutput;
  } catch (error) {
    console.warn(`ffprobe failed or not found for ${filePath}. Using fallback analysis.`);
    return null;
  }
}

export function crawlDirectory(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      crawlDirectory(fullPath, fileList);
    } else {
      const ext = path.extname(item).toLowerCase();
      if (VIDEO_EXTENSIONS.has(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

// Seed default multiple root libraries
export async function seedDefaultLibraries() {
  const existingLibs = await db.select().from(libraries).all();
  if (existingLibs.length > 0) return existingLibs;

  console.log("Seeding default separated libraries: Movies, TV Series, Kids Movies, Kids TV Series, Own Videos...");

  const defaults = [
    { id: "lib-movies", name: "Movies", path: path.resolve("./data/Libraries/Movies"), type: "movie" as const },
    { id: "lib-tvshows", name: "TV Series", path: path.resolve("./data/Libraries/TVSeries"), type: "series" as const },
    { id: "lib-kidsmovies", name: "Kids Movies", path: path.resolve("./data/Libraries/KidsMovies"), type: "movie" as const },
    { id: "lib-kidstvshows", name: "Kids TV Series", path: path.resolve("./data/Libraries/KidsTVSeries"), type: "series" as const },
    { id: "lib-ownvideos", name: "Own Videos", path: path.resolve("./data/Libraries/OwnVideos"), type: "video" as const },
  ];

  for (const lib of defaults) {
    // Create folders
    if (!fs.existsSync(lib.path)) {
      fs.mkdirSync(lib.path, { recursive: true });
    }

    await db.insert(libraries)
      .values({
        id: lib.id,
        name: lib.name,
        path: lib.path,
        type: lib.type,
      })
      .onConflictDoNothing()
      .run();
  }

  return db.select().from(libraries).all();
}

// Crawl and scan all configured libraries dynamically
export async function scanLibrary() {
  const allLibs = await seedDefaultLibraries();

  const results = {
    moviesScanned: 0,
    episodesScanned: 0,
    errors: [] as string[],
  };

  for (const lib of allLibs) {
    console.log(`Scanning Library: ${lib.name} (${lib.path})`);
    if (!fs.existsSync(lib.path)) {
      console.warn(`Library path does not exist: ${lib.path}. Skipping.`);
      continue;
    }

    const files = crawlDirectory(lib.path);
    for (const file of files) {
      try {
        const isNew = await processScannedFile(file, lib.id, lib.type);
        if (isNew) {
          if (lib.type === "movie" || lib.type === "video") {
            results.moviesScanned++;
          } else {
            results.episodesScanned++;
          }
        }
      } catch (err: any) {
        console.error(`Error scanning file ${file} in library ${lib.name}:`, err);
        results.errors.push(`${lib.name} -> ${path.basename(file)}: ${err.message}`);
      }
    }
  }

  return results;
}

async function processScannedFile(
  filePath: string,
  libraryId: string,
  libraryType: "movie" | "series" | "video"
): Promise<boolean> {
  // Check if file is already in DB
  const existingFile = await db
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.path, filePath))
    .get();

  if (existingFile) {
    return false; // Skip already scanned
  }

  console.log(`Processing scanned file: ${filePath}`);
  const parsed = parseFilename(filePath);
  
  // Decide media type based on library settings
  const mediaType = libraryType === "series" ? "episode" : "movie";
  const title = parsed?.title || path.basename(filePath, path.extname(filePath));

  // Run ffprobe details
  const probeData = await probeMediaFile(filePath);
  const fileStats = fs.statSync(filePath);

  const fileSize = fileStats.size;
  let duration: number | null = null;
  let bitrate: number | null = null;
  let container = path.extname(filePath).slice(1);
  let videoCodec = "h264";
  let videoResolution = "1080p";
  let videoWidth: number | null = null;
  let videoHeight: number | null = null;
  let videoFps: number | null = null;

  if (probeData) {
    if (probeData.format) {
      duration = probeData.format.duration ? Math.round(parseFloat(probeData.format.duration)) : null;
      bitrate = probeData.format.bit_rate ? parseInt(probeData.format.bit_rate, 10) : null;
      container = probeData.format.format_name || container;
    }
    const videoStream = probeData.streams?.find((s) => s.codec_type === "video");
    if (videoStream) {
      videoCodec = videoStream.codec_name || videoCodec;
      videoWidth = videoStream.width || null;
      videoHeight = videoStream.height || null;
      
      // Determine resolution
      if (videoHeight) {
        if (videoHeight >= 2160) videoResolution = "2160p";
        else if (videoHeight >= 1080) videoResolution = "1080p";
        else if (videoHeight >= 720) videoResolution = "720p";
        else videoResolution = "480p";
      }

      if (videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split("/");
        if (parts.length === 2) {
          const num = parseFloat(parts[0]);
          const den = parseFloat(parts[1]);
          if (den > 0) videoFps = Math.round((num / den) * 100) / 100;
        } else {
          videoFps = parseFloat(videoStream.r_frame_rate) || null;
        }
      }
    }
  } else {
    // Fallback: guess resolution from name
    if (filePath.includes("2160p") || filePath.includes("4K") || filePath.includes("4k")) {
      videoResolution = "2160p";
    }
  }

  // Look up TMDB metadata
  let dbMediaItemId = "";
  let dbEpisodeId: string | null = null;

  if (libraryType === "video") {
    // Local home videos - no TMDB matching
    dbMediaItemId = `local-video-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    await insertLocalFallbackItem(dbMediaItemId, title, "movie");
  } else if (mediaType === "movie") {
    let tmdbMovie = await findTMDBMovie(title, parsed?.year);
    if (tmdbMovie) {
      dbMediaItemId = `tmdb-movie-${tmdbMovie.id}`;
      await insertMovieMetadata(dbMediaItemId, tmdbMovie);
    } else {
      // Fallback local media item
      dbMediaItemId = `local-movie-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      await insertLocalFallbackItem(dbMediaItemId, title, "movie");
    }
  } else {
    // Episode / Series
    let tmdbShow = await findTMDBShow(title);
    if (tmdbShow) {
      dbMediaItemId = `tmdb-series-${tmdbShow.id}`;
      await insertShowMetadata(dbMediaItemId, tmdbShow);

      // Get episode
      const seasonNum = parsed?.seasonNumber ?? 1;
      const episodeNum = parsed?.episodeNumber ?? 1;

      // Ensure Season and Episode records exist
      const dbSeasonId = await ensureSeasonExists(dbMediaItemId, tmdbShow.id, seasonNum);
      dbEpisodeId = await ensureEpisodeExists(dbSeasonId, tmdbShow.id, seasonNum, episodeNum, parsed?.episodeTitle || null);
    } else {
      // Fallback local show
      dbMediaItemId = `local-series-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      await insertLocalFallbackItem(dbMediaItemId, title, "series");

      const seasonNum = parsed?.seasonNumber ?? 1;
      const episodeNum = parsed?.episodeNumber ?? 1;

      const dbSeasonId = `local-season-${dbMediaItemId}-${seasonNum}`;
      await db.insert(seriesSeasons)
        .values({
          id: dbSeasonId,
          seriesId: dbMediaItemId,
          seasonNumber: seasonNum,
          title: `Season ${seasonNum}`,
        })
        .onConflictDoNothing()
        .run();

      dbEpisodeId = `local-episode-${dbSeasonId}-${episodeNum}`;
      await db.insert(seriesEpisodes)
        .values({
          id: dbEpisodeId,
          seasonId: dbSeasonId,
          episodeNumber: episodeNum,
          title: parsed?.episodeTitle || `Episode ${episodeNum}`,
        })
        .onConflictDoNothing()
        .run();
    }
  }

  // Insert media file with library association
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await db.insert(mediaFiles)
    .values({
      id: fileId,
      libraryId,
      mediaItemId: mediaType === "movie" ? dbMediaItemId : null,
      episodeId: mediaType === "episode" ? dbEpisodeId : null,
      path: filePath,
      size: fileSize,
      duration,
      bitrate,
      container,
      videoCodec,
      videoResolution,
      videoWidth,
      videoHeight,
      videoFps,
      scannedAt: new Date().toISOString()
    })
    .run();

  // Insert media streams if ffprobe succeeded
  if (probeData && probeData.streams) {
    for (const stream of probeData.streams) {
      if (stream.codec_type === "audio" || stream.codec_type === "subtitle") {
        const streamId = `file-${fileId}-stream-${stream.index}`;
        await db.insert(mediaStreams)
          .values({
            id: streamId,
            mediaFileId: fileId,
            type: stream.codec_type,
            streamIndex: stream.index,
            codec: stream.codec_name || "unknown",
            language: stream.tags?.language || null,
            title: stream.tags?.title || null,
            channels: stream.channels || null,
            isDefault: stream.disposition?.default === 1,
            isForced: stream.disposition?.forced === 1,
          })
          .onConflictDoNothing()
          .run();
      }
    }
  }

  return true;
}

// Helpers to match TMDB
async function findTMDBMovie(title: string, year?: number | null) {
  const results = await searchTMDB(title, "movie");
  if (!results.length) return null;
  if (year) {
    const matched = results.find((r: any) => r.release_date && r.release_date.startsWith(year.toString()));
    if (matched) return getMovieMetadata(matched.id);
  }
  return getMovieMetadata(results[0].id);
}

async function findTMDBShow(title: string) {
  const results = await searchTMDB(title, "series");
  if (!results.length) return null;
  return getTVMetadata(results[0].id);
}

async function insertLocalFallbackItem(id: string, title: string, type: "movie" | "series") {
  await db.insert(mediaItems)
    .values({
      id,
      title,
      type,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run();
}

async function insertMovieMetadata(id: string, movie: any) {
  await db.insert(mediaItems)
    .values({
      id,
      tmdbId: movie.id,
      imdbId: movie.imdb_id || null,
      type: "movie",
      title: movie.title,
      originalTitle: movie.original_title,
      tagline: movie.tagline || null,
      overview: movie.overview,
      releaseDate: movie.release_date || null,
      runtime: movie.runtime || null,
      posterPath: movie.poster_path || null,
      backdropPath: movie.backdrop_path || null,
      rating: movie.vote_average || null,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: mediaItems.id,
      set: {
        title: movie.title,
        overview: movie.overview,
        posterPath: movie.poster_path || null,
        backdropPath: movie.backdrop_path || null,
        rating: movie.vote_average || null,
        updatedAt: new Date().toISOString(),
      },
    })
    .run();

  if (movie.genres) {
    for (const genre of movie.genres) {
      await db.insert(genres)
        .values({ id: genre.id, name: genre.name })
        .onConflictDoNothing()
        .run();

      await db.insert(mediaGenres)
        .values({ mediaItemId: id, genreId: genre.id })
        .onConflictDoNothing()
        .run();
    }
  }

  if (movie.production_companies) {
    for (const company of movie.production_companies) {
      await db.insert(studios)
        .values({ id: company.id, name: company.name })
        .onConflictDoNothing()
        .run();

      await db.insert(mediaStudios)
        .values({ mediaItemId: id, studioId: company.id })
        .onConflictDoNothing()
        .run();
    }
  }

  if (movie.credits) {
    const cast = movie.credits.cast || [];
    const crew = movie.credits.crew || [];

    for (const actor of cast.slice(0, 15)) {
      await db.insert(people)
        .values({ id: `tmdb-person-${actor.id}`, name: actor.name, profilePath: actor.profile_path || null })
        .onConflictDoNothing()
        .run();

      await db.insert(mediaPeople)
        .values({
          id: `movie-${movie.id}-cast-${actor.id}`,
          mediaItemId: id,
          personId: `tmdb-person-${actor.id}`,
          role: "cast",
          character: actor.character,
          displayOrder: actor.order,
        })
        .onConflictDoNothing()
        .run();
    }

    const director = crew.find((c: any) => c.job === "Director");
    if (director) {
      await db.insert(people)
        .values({ id: `tmdb-person-${director.id}`, name: director.name, profilePath: director.profile_path || null })
        .onConflictDoNothing()
        .run();

      await db.insert(mediaPeople)
        .values({
          id: `movie-${movie.id}-director-${director.id}`,
          mediaItemId: id,
          personId: `tmdb-person-${director.id}`,
          role: "crew",
          job: "Director",
        })
        .onConflictDoNothing()
        .run();
    }
  }
}

async function insertShowMetadata(id: string, show: any) {
  await db.insert(mediaItems)
    .values({
      id,
      tmdbId: show.id,
      type: "series",
      title: show.name,
      originalTitle: show.original_name,
      overview: show.overview,
      releaseDate: show.first_air_date || null,
      posterPath: show.poster_path || null,
      backdropPath: show.backdrop_path || null,
      rating: show.vote_average || null,
      status: show.status || null,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: mediaItems.id,
      set: {
        title: show.name,
        overview: show.overview,
        posterPath: show.poster_path || null,
        backdropPath: show.backdrop_path || null,
        rating: show.vote_average || null,
        status: show.status || null,
        updatedAt: new Date().toISOString(),
      },
    })
    .run();

  if (show.genres) {
    for (const genre of show.genres) {
      await db.insert(genres)
        .values({ id: genre.id, name: genre.name })
        .onConflictDoNothing()
        .run();

      await db.insert(mediaGenres)
        .values({ mediaItemId: id, genreId: genre.id })
        .onConflictDoNothing()
        .run();
    }
  }

  if (show.production_companies) {
    for (const company of show.production_companies) {
      await db.insert(studios)
        .values({ id: company.id, name: company.name })
        .onConflictDoNothing()
        .run();

      await db.insert(mediaStudios)
        .values({ mediaItemId: id, studioId: company.id })
        .onConflictDoNothing()
        .run();
    }
  }

  if (show.credits && show.credits.cast) {
    for (const actor of show.credits.cast.slice(0, 15)) {
      await db.insert(people)
        .values({ id: `tmdb-person-${actor.id}`, name: actor.name, profilePath: actor.profile_path || null })
        .onConflictDoNothing()
        .run();

      await db.insert(mediaPeople)
        .values({
          id: `series-${show.id}-cast-${actor.id}`,
          mediaItemId: id,
          personId: `tmdb-person-${actor.id}`,
          role: "cast",
          character: actor.character,
          displayOrder: actor.order,
        })
        .onConflictDoNothing()
        .run();
    }
  }
}

async function ensureSeasonExists(seriesId: string, showTmdbId: number, seasonNum: number): Promise<string> {
  const dbSeasonId = `series-${showTmdbId}-season-${seasonNum}`;
  
  const existing = await db
    .select()
    .from(seriesSeasons)
    .where(eq(seriesSeasons.id, dbSeasonId))
    .get();

  if (existing) return dbSeasonId;

  let overview = "";
  let posterPath: string | null = null;
  let airDate: string | null = null;
  let title = `Season ${seasonNum}`;

  const showDetails = await getTVMetadata(showTmdbId);
  const matchedSeason = showDetails?.seasons?.find((s: any) => s.season_number === seasonNum);
  
  if (matchedSeason) {
    title = matchedSeason.name || title;
    overview = matchedSeason.overview || "";
    posterPath = matchedSeason.poster_path || null;
    airDate = matchedSeason.air_date || null;
  }

  await db.insert(seriesSeasons)
    .values({
      id: dbSeasonId,
      seriesId,
      seasonNumber: seasonNum,
      title,
      overview,
      posterPath,
      airDate,
    })
    .onConflictDoNothing()
    .run();

  return dbSeasonId;
}

async function ensureEpisodeExists(
  seasonId: string,
  showTmdbId: number,
  seasonNum: number,
  episodeNum: number,
  parsedTitle: string | null
): Promise<string> {
  const dbEpisodeId = `season-${seasonId}-ep-${episodeNum}`;

  const existing = await db
    .select()
    .from(seriesEpisodes)
    .where(eq(seriesEpisodes.id, dbEpisodeId))
    .get();

  if (existing) return dbEpisodeId;

  let title = parsedTitle || `Episode ${episodeNum}`;
  let overview = "";
  let runtime: number | null = null;
  let stillPath: string | null = null;
  let airDate: string | null = null;
  let rating: number | null = null;

  const seasonMeta = await getTVSeasonMetadata(showTmdbId, seasonNum);
  const epMeta = seasonMeta?.episodes?.find((e: any) => e.episode_number === episodeNum);

  if (epMeta) {
    title = epMeta.name || title;
    overview = epMeta.overview || "";
    runtime = epMeta.runtime || null;
    stillPath = epMeta.still_path || null;
    airDate = epMeta.air_date || null;
    rating = epMeta.vote_average || null;
  }

  await db.insert(seriesEpisodes)
    .values({
      id: dbEpisodeId,
      seasonId,
      episodeNumber: episodeNum,
      title,
      overview,
      runtime,
      stillPath,
      airDate,
      rating,
    })
    .onConflictDoNothing()
    .run();

  return dbEpisodeId;
}
