import * as path from "path";

export interface ParsedMedia {
  type: "movie" | "episode";
  title: string;
  year: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
}

export function parseFilename(filePath: string): ParsedMedia | null {
  const filename = path.basename(filePath);
  const ext = path.extname(filename);
  const nameWithoutExt = filename.slice(0, -ext.length);

  // Common movie and episode patterns
  // 1. Episode check: S01E01 or s01e01 or S1E1 or s1e1
  const epRegex = /(.*?)\s*[-_.]?\s*[sS](\d+)[eE](\d+)\s*[-_.]?\s*(.*)/i;
  const epMatch = nameWithoutExt.match(epRegex);

  if (epMatch) {
    const showTitle = cleanTitle(epMatch[1]);
    const seasonNumber = parseInt(epMatch[2], 10);
    const episodeNumber = parseInt(epMatch[3], 10);
    const epTitleRaw = epMatch[4] ? epMatch[4].trim() : "";
    const episodeTitle = epTitleRaw.replace(/^[-_.]\s*/, "").trim() || null;

    // Check if season-level directory contains show info
    // e.g. /opt/triparr/media/TVSeries/Breaking Bad/Season 01/...
    const pathParts = filePath.split(/[\\/]/);
    let title = showTitle;
    if (pathParts.length >= 3) {
      const parentDir = pathParts[pathParts.length - 2]; // e.g. Season 01
      const grandParentDir = pathParts[pathParts.length - 3]; // e.g. Breaking Bad
      if (parentDir.toLowerCase().startsWith("season") && grandParentDir) {
        title = cleanTitle(grandParentDir);
      }
    }

    return {
      type: "episode",
      title,
      year: null,
      seasonNumber,
      episodeNumber,
      episodeTitle,
    };
  }

  // 2. Movie check: Movie Title (Year) or Movie Title 2024
  const movieYearRegex = /(.*?)\s*[([]?(\d{4})[)]]?\s*$/;
  const movieMatch = nameWithoutExt.match(movieYearRegex);

  if (movieMatch) {
    return {
      type: "movie",
      title: cleanTitle(movieMatch[1]),
      year: parseInt(movieMatch[2], 10),
      seasonNumber: null,
      episodeNumber: null,
      episodeTitle: null,
    };
  }

  // Fallback to treat as movie without year
  // Clean titles by removing dots, hyphens, and quality markers (1080p, 2160p, HEVC, etc.)
  const cleanedTitle = cleanTitle(nameWithoutExt);
  if (!cleanedTitle) return null;

  return {
    type: "movie",
    title: cleanedTitle,
    year: null,
    seasonNumber: null,
    episodeNumber: null,
    episodeTitle: null,
  };
}

function cleanTitle(title: string): string {
  return title
    .replace(/[._-_]/g, " ") // replace dots, hyphens, underscores with space
    .replace(/\s+/g, " ") // normalize spacing
    .replace(/\b(1080p|2160p|720p|4k|uhd|hevc|x265|x264|h264|bluray|web-dl|webdl|dd5\.1|dts|aac)\b.*/gi, "") // strip release quality keywords and anything after
    .trim();
}
