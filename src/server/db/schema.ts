import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

// Media Items: Movies and TV Series
export const mediaItems = sqliteTable("media_items", {
  id: text("id").primaryKey(), // tmdb-${id} or movie-${id} or series-${id}
  tmdbId: integer("tmdb_id"),
  imdbId: text("imdb_id"),
  type: text("type", { enum: ["movie", "series"] }).notNull(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  sortTitle: text("sort_title"),
  tagline: text("tagline"),
  overview: text("overview"),
  releaseDate: text("release_date"), // YYYY-MM-DD
  status: text("status"), // Released, In Production, etc.
  runtime: integer("runtime"), // in minutes
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  rating: real("rating"), // TMDB average rating
  certification: text("certification"), // PG-13, R, etc.
  addedAt: text("added_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// TV Series Seasons
export const seriesSeasons = sqliteTable("series_seasons", {
  id: text("id").primaryKey(), // series-${seriesId}-season-${seasonNum}
  seriesId: text("series_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  seasonNumber: integer("season_number").notNull(),
  title: text("title"),
  overview: text("overview"),
  episodeCount: integer("episode_count"),
  posterPath: text("poster_path"),
  airDate: text("air_date"),
});

// TV Series Episodes
export const seriesEpisodes = sqliteTable("series_episodes", {
  id: text("id").primaryKey(), // season-${seasonId}-ep-${epNum}
  seasonId: text("season_id")
    .notNull()
    .references(() => seriesSeasons.id, { onDelete: "cascade" }),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title").notNull(),
  overview: text("overview"),
  runtime: integer("runtime"),
  stillPath: text("still_path"),
  airDate: text("air_date"),
  rating: real("rating"),
});

// Media Libraries
export const libraries = sqliteTable("libraries", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  type: text("type", { enum: ["movie", "series", "video"] }).notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Media Files on disk
export const mediaFiles = sqliteTable("media_files", {
  id: text("id").primaryKey(),
  libraryId: text("library_id")
    .references(() => libraries.id, { onDelete: "cascade" }),
  mediaItemId: text("media_item_id")
    .references(() => mediaItems.id, { onDelete: "cascade" }), // Movies
  episodeId: text("episode_id")
    .references(() => seriesEpisodes.id, { onDelete: "cascade" }), // Episodes
  path: text("path").notNull().unique(),
  size: integer("size").notNull(), // size in bytes (SQLite supports big numbers)
  duration: integer("duration"), // in seconds
  bitrate: integer("bitrate"),
  container: text("container"), // mkv, mp4, etc.
  videoCodec: text("video_codec"), // h264, hevc, etc.
  videoResolution: text("video_resolution"), // 1080p, 2160p, etc.
  videoWidth: integer("video_width"),
  videoHeight: integer("video_height"),
  videoFps: real("video_fps"),
  scannedAt: text("scanned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Internal Media Streams (Audio & Subtitle tracks)
export const mediaStreams = sqliteTable("media_streams", {
  id: text("id").primaryKey(), // file-${fileId}-stream-${index}
  mediaFileId: text("media_file_id")
    .notNull()
    .references(() => mediaFiles.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["audio", "subtitle"] }).notNull(),
  streamIndex: integer("stream_index").notNull(),
  codec: text("codec").notNull(),
  language: text("language"), // eng, fre, etc.
  title: text("title"),
  channels: integer("channels"), // 2 for stereo, 6 for 5.1 (audio only)
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  isForced: integer("is_forced", { mode: "boolean" }).default(false),
});

// People (Actors, Directors, Writers)
export const people = sqliteTable("people", {
  id: text("id").primaryKey(), // tmdb-person-${id}
  name: text("name").notNull(),
  profilePath: text("profile_path"),
});

// Cast/Crew junction table
export const mediaPeople = sqliteTable("media_people", {
  id: text("id").primaryKey(),
  mediaItemId: text("media_item_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  episodeId: text("episode_id")
    .references(() => seriesEpisodes.id, { onDelete: "cascade" }),
  personId: text("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["cast", "crew"] }).notNull(),
  character: text("character"), // Name of character played (for cast)
  job: text("job"), // Director, Writer, Producer, etc. (for crew)
  displayOrder: integer("display_order"), // display ranking
});

// Genres
export const genres = sqliteTable("genres", {
  id: integer("id").primaryKey(), // TMDB Genre ID
  name: text("name").notNull().unique(),
});

// Media-Genre junction
export const mediaGenres = sqliteTable("media_genres", {
  mediaItemId: text("media_item_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  genreId: integer("genre_id")
    .notNull()
    .references(() => genres.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.mediaItemId, t.genreId] }),
}));

// Studios/Production Companies
export const studios = sqliteTable("studios", {
  id: integer("id").primaryKey(), // TMDB Company ID
  name: text("name").notNull().unique(),
});

// Media-Studio junction
export const mediaStudios = sqliteTable("media_studios", {
  mediaItemId: text("media_item_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.mediaItemId, t.studioId] }),
}));

// Request queue items
export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(), // UUID or request-${tmdbId}
  libraryId: text("library_id")
    .references(() => libraries.id, { onDelete: "cascade" }),
  mediaItemId: text("media_item_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  episodeId: text("episode_id")
    .references(() => seriesEpisodes.id, { onDelete: "cascade" }), // null for movies or whole series
  status: text("status", {
    enum: [
      "REQUESTED",
      "SEARCHING",
      "CANDIDATES_FOUND",
      "AWAITING_SELECTION",
      "SUBMITTED_TO_DEBRID",
      "WAITING_FILE_SELECTION",
      "DOWNLOADING",
      "AVAILABLE",
      "DOWNLOADING_FILE",
      "ORGANIZING",
      "COMPLETED",
      "FAILED",
      "CANCELLED"
    ]
  }).notNull(),
  qualityProfile: text("quality_profile").notNull().default("Balanced"),
  progress: integer("progress").notNull().default(0), // percentage
  speed: integer("speed"), // in bytes per second
  eta: integer("eta"), // in seconds
  releaseTitle: text("release_title"),
  releaseSize: integer("release_size"),
  debridId: text("debrid_id"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Settings table
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // AES encrypted JSON string
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Users (Admin Account)
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Sessions
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
});

