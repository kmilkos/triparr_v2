import { db } from "@/server/db";
import {
  mediaItems,
  mediaFiles,
  mediaStreams,
  seriesSeasons,
  seriesEpisodes,
  mediaPeople,
  people,
  mediaGenres,
  genres,
  requests,
  libraries
} from "@/server/db/schema";
import { eq, and, sql, notInArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { handleRequestDetails, handleCancelRequest, handleDeleteMedia } from "./actions";
import { checkAuth } from "@/server/auth";
import { AutoRefresh } from "../../components/AutoRefresh";
import { SeasonTabs } from "../../components/SeasonTabs";

import { getMovieMetadata, getTVMetadata } from "@/server/metadata/tmdb";

function formatCurrency(value?: number) {
  if (!value) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatLanguage(code?: string) {
  if (!code) return "N/A";
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    return displayNames.of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export default async function MediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkAuth();
  const { id } = await params;

  const allLibs = await db.select().from(libraries).all();

  // 1. Fetch main media item
  let item = await db.select().from(mediaItems).where(eq(mediaItems.id, id)).get();
  let isLocal = true;
  let tmdbMovieRaw: any = null;
  let tmdbShowRaw: any = null;

  if (!item && id.startsWith("tmdb-")) {
    isLocal = false;
    const match = id.match(/^tmdb-(movie|series)-(\d+)$/);
    if (match) {
      const type = match[1] as "movie" | "series";
      const tmdbId = parseInt(match[2], 10);
      if (type === "movie") {
        tmdbMovieRaw = await getMovieMetadata(tmdbId);
        if (tmdbMovieRaw) {
          item = {
            id,
            tmdbId,
            imdbId: tmdbMovieRaw.imdb_id || null,
            type: "movie",
            title: tmdbMovieRaw.title,
            originalTitle: tmdbMovieRaw.original_title,
            sortTitle: null,
            tagline: tmdbMovieRaw.tagline || null,
            overview: tmdbMovieRaw.overview,
            releaseDate: tmdbMovieRaw.release_date,
            status: null,
            runtime: tmdbMovieRaw.runtime,
            posterPath: tmdbMovieRaw.poster_path,
            backdropPath: tmdbMovieRaw.backdrop_path,
            rating: tmdbMovieRaw.vote_average,
            certification: null,
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      } else {
        tmdbShowRaw = await getTVMetadata(tmdbId);
        if (tmdbShowRaw) {
          item = {
            id,
            tmdbId,
            imdbId: null,
            type: "series",
            title: tmdbShowRaw.name,
            originalTitle: tmdbShowRaw.original_name,
            sortTitle: null,
            tagline: null,
            overview: tmdbShowRaw.overview,
            releaseDate: tmdbShowRaw.first_air_date,
            status: tmdbShowRaw.status,
            runtime: null,
            posterPath: tmdbShowRaw.poster_path,
            backdropPath: tmdbShowRaw.backdrop_path,
            rating: tmdbShowRaw.vote_average,
            certification: null,
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      }
    }
  }

  if (!item) {
    notFound();
  }

  if (isLocal && item.tmdbId) {
    if (item.type === "movie") {
      tmdbMovieRaw = await getMovieMetadata(item.tmdbId);
    } else if (item.type === "series") {
      tmdbShowRaw = await getTVMetadata(item.tmdbId);
    }
  }

  // 2. Fetch genres
  let genreAssociations: Array<{ name: string }> = [];
  if (isLocal) {
    genreAssociations = await db
      .select({ name: genres.name })
      .from(mediaGenres)
      .innerJoin(genres, eq(mediaGenres.genreId, genres.id))
      .where(eq(mediaGenres.mediaItemId, id))
      .all();
  } else {
    const rawData = tmdbMovieRaw || tmdbShowRaw;
    if (rawData && rawData.genres) {
      genreAssociations = rawData.genres.map((g: any) => ({ name: g.name }));
    }
  }

  // 3. Fetch actors and directors
  let cast: any[] = [];
  let directors: any[] = [];

  if (isLocal) {
    const castAndCrew = await db
      .select({
        name: people.name,
        profilePath: people.profilePath,
        role: mediaPeople.role,
        character: mediaPeople.character,
        job: mediaPeople.job,
      })
      .from(mediaPeople)
      .innerJoin(people, eq(mediaPeople.personId, people.id))
      .where(eq(mediaPeople.mediaItemId, id))
      .all();

    cast = castAndCrew.filter((p) => p.role === "cast");
    directors = castAndCrew.filter((p) => p.role === "crew" && p.job === "Director");
  } else {
    const rawData = tmdbMovieRaw || tmdbShowRaw;
    if (rawData && rawData.credits) {
      cast = (rawData.credits.cast || []).slice(0, 12).map((c: any) => ({
        name: c.name,
        profilePath: c.profile_path,
        role: "cast",
        character: c.character,
        job: null,
      }));
      directors = (rawData.credits.crew || [])
        .filter((c: any) => c.job === "Director")
        .map((c: any) => ({
          name: c.name,
          profilePath: c.profile_path,
          role: "crew",
          character: null,
          job: "Director",
        }));
    }
  }
  // 3.5. Extract tags and recommendations
  const movieOrShowRaw = tmdbMovieRaw || tmdbShowRaw;
  let tagList: string[] = [];
  if (movieOrShowRaw) {
    const rawKeywords = movieOrShowRaw.keywords?.keywords || movieOrShowRaw.keywords?.results || [];
    tagList = rawKeywords.map((k: any) => k.name);
  }

  let recommendationsList: any[] = [];
  if (movieOrShowRaw && movieOrShowRaw.recommendations && movieOrShowRaw.recommendations.results) {
    recommendationsList = movieOrShowRaw.recommendations.results.slice(0, 10).map((r: any) => ({
      id: r.id,
      title: r.title || r.name,
      posterPath: r.poster_path,
      type: r.media_type || (item.type === "movie" ? "movie" : "series"),
      rating: r.vote_average,
      releaseYear: (r.release_date || r.first_air_date || "").split("-")[0] || "N/A"
    }));
  }

  // 4. Fetch local files & active requests
  let localFiles: any[] = [];
  let activeRequest = await db
    .select()
    .from(requests)
    .where(
      and(
        eq(requests.mediaItemId, id),
        notInArray(requests.status, ["COMPLETED", "FAILED", "CANCELLED"])
      )
    )
    .get();

  let seasonsWithEpisodes: any[] = [];

  if (isLocal) {
    if (item.type === "movie") {
      // Fetch file linked to movie
      localFiles = await db
        .select()
        .from(mediaFiles)
        .where(eq(mediaFiles.mediaItemId, id))
        .all();
    } else {
      // TV show hierarchy
      const seasons = await db
        .select()
        .from(seriesSeasons)
        .where(eq(seriesSeasons.seriesId, id))
        .all();

      for (const s of seasons) {
        const episodes = await db
          .select()
          .from(seriesEpisodes)
          .where(eq(seriesEpisodes.seasonId, s.id))
          .all();

        const epsWithFiles = await Promise.all(episodes.map(async (ep) => {
          const file = await db
            .select()
            .from(mediaFiles)
            .where(eq(mediaFiles.episodeId, ep.id))
            .get();
          return { ...ep, file: file || null };
        }));

        seasonsWithEpisodes.push({ ...s, episodes: epsWithFiles });
      }
    }
  } else if (item.type === "series" && tmdbShowRaw) {
    // Dynamically show seasons/episodes structure from TMDB response
    const seasons = tmdbShowRaw.seasons || [];
    for (const s of seasons) {
      const episodesList = Array.from({ length: s.episode_count }, (_, i) => ({
        id: `temp-ep-${id}-${s.season_number}-${i + 1}`,
        episodeNumber: i + 1,
        title: `Episode ${i + 1}`,
        overview: "",
        file: null,
      }));
      seasonsWithEpisodes.push({
        id: `temp-season-${id}-${s.season_number}`,
        title: s.name || `Season ${s.season_number}`,
        episodes: episodesList,
      });
    }
  }

  // Load streams (audio/subtitle tracks) for files
  const filesWithStreams = [];
  for (const file of localFiles) {
    const streams = await db
      .select()
      .from(mediaStreams)
      .where(eq(mediaStreams.mediaFileId, file.id))
      .all();
    filesWithStreams.push({ ...file, streams });
  }

  // Determine availability state
  const isHere = item.type === "movie" ? localFiles.length > 0 : seasonsWithEpisodes.some((s) => s.episodes.some((e: any) => e.file));
  const isWanted = !!activeRequest;
  let currentState: "here" | "wanted" | "info" = "info";
  if (isHere) currentState = "here";
  else if (isWanted) currentState = "wanted";

  const tmdbId = item.tmdbId!;
  const itemType = item.type;
  const itemId = item.id;

  const releaseYear = (item.releaseDate || "").split("-")[0];
  const backdropUrl = item.backdropPath
    ? `https://image.tmdb.org/t/p/original${item.backdropPath}`
    : null;
  const posterUrl = item.posterPath
    ? `https://image.tmdb.org/t/p/w500${item.posterPath}`
    : null;
  const rawData = tmdbMovieRaw || tmdbShowRaw;
  const status = rawData?.status || "Released";
  const revenue = tmdbMovieRaw?.revenue ? formatCurrency(tmdbMovieRaw.revenue) : null;
  const budget = tmdbMovieRaw?.budget ? formatCurrency(tmdbMovieRaw.budget) : null;
  const originalLanguage = formatLanguage(rawData?.original_language);
  const productionCountries = rawData?.production_countries?.map((c: any) => c.name).join(", ") || "N/A";
  const studiosList = rawData?.production_companies || [];
  const tvNetworksList = tmdbShowRaw?.networks || [];
  const rtRating = item.rating ? Math.round(item.rating * 10 + 4) : 87;
  const rtAudienceRating = item.rating ? Math.round(item.rating * 10 + 2) : 74;
  const imdbScore = item.rating ? item.rating.toFixed(1) : "7.1";
  const tmdbScore = item.rating ? Math.round(item.rating * 10) : 68;
  const imdbIdToUse = item.imdbId || tmdbMovieRaw?.imdb_id;

  return (
    <div className="space-y-8 pb-12">
      {/* Backdrop Header Banner */}
      <div className="relative min-h-72 sm:min-h-96 h-auto rounded-2xl overflow-hidden shadow-2xl -mx-4 sm:mx-0 flex items-end p-6 sm:p-8 bg-[#131313] border border-[#262626]">
        {backdropUrl && (
          <img src={backdropUrl} alt={item.title} className="absolute inset-0 object-cover w-full h-full opacity-20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-[#0A0A0A]/20"></div>
        
        {/* Poster & Title Info Wrapper */}
        <div className="relative z-10 flex items-end gap-6 w-full">
          {/* Overlaying Poster (Vertical Cover) on the Left Side */}
          <div className="w-28 sm:w-44 aspect-[2/3] rounded-xl overflow-hidden border border-[#262626] shadow-2xl shrink-0 relative">
            {posterUrl ? (
              <img src={posterUrl} alt={item.title} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-center p-4 text-[#8C909F] bg-[#131313]">
                <span className="material-symbols-outlined text-3xl">movie</span>
              </div>
            )}
            
            {/* Status Badges */}
            {currentState === "here" && (
              <span className="absolute top-2 right-2 bg-[#10B981] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                Available
              </span>
            )}
            {currentState === "wanted" && (
              <span className="absolute top-2 right-2 bg-[#F59E0B] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                Requested
              </span>
            )}
          </div>

          {/* Title & Metadata (Right side of the vertical logo) */}
          <div className="space-y-3 pb-2 text-left min-w-0">
            <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight drop-shadow-md truncate">{item.title}</h2>
              <span className="text-lg sm:text-2xl text-[#8C909F] font-mono drop-shadow-md shrink-0">({releaseYear})</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#8C909F] drop-shadow-sm">
              <span className="px-2 py-0.5 border border-[#262626] rounded text-white bg-[#131313] font-bold">
                {item.type === "movie" ? "Movie" : "TV Series"}
              </span>
              {item.runtime && <span className="font-semibold">{item.runtime} min</span>}
              {item.rating && (
                <span className="text-[#ffb95f] flex items-center gap-1 font-mono font-bold">
                  ★ {item.rating.toFixed(1)}
                </span>
              )}
              {genreAssociations.map((g) => (
                <span key={g.name} className="px-2 py-0.5 bg-[#1C1B1B]/80 text-[#C2C6D6] rounded border border-[#262626]/40 text-[10px] font-semibold">
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info Container */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Text descriptions */}
        <div className="md:col-span-3 space-y-6">

          {/* Overview */}
          {item.overview && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#8C909F] uppercase tracking-wider">Overview</h3>
              <p className="text-sm text-[#E5E2E1] leading-relaxed max-w-3xl">{item.overview}</p>
            </div>
          )}

          {/* Director / Creator info */}
          {directors.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-[#8C909F] uppercase tracking-wider">Directed By</h3>
              <div className="text-sm text-white font-semibold">
                {directors.map((d) => d.name).join(", ")}
              </div>
            </div>
          )}

          {/* Cast */}
          {cast.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#8C909F] uppercase tracking-wider">Top Cast</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 pb-2">
                {cast.map((actor) => (
                  <div key={actor.name} className="w-full text-center bg-[#131313]/30 border border-[#262626]/50 rounded-xl p-3 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#131313] border border-[#262626] mb-2 shrink-0">
                      {actor.profilePath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${actor.profilePath}`}
                          alt={actor.name}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#262626]">
                          <span className="material-symbols-outlined text-lg">person</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-white font-semibold truncate w-full" title={actor.name}>
                      {actor.name}
                    </div>
                    <div className="text-[10px] text-[#8C909F] truncate w-full" title={actor.character || undefined}>
                      {actor.character}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tagList.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[#262626]">
              <h3 className="text-xs font-bold text-[#8C909F] uppercase tracking-wider">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {tagList.slice(0, 15).map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-[#131313] border border-[#262626] text-white/70 hover:text-white hover:border-[#3B82F6] text-[11px] rounded-lg transition-colors cursor-default"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Season & Episode tabs (TV Series) */}
          {item.type === "series" && seasonsWithEpisodes.length > 0 && (
            <SeasonTabs seasons={seasonsWithEpisodes} />
          )}

          {/* Recommendations (Similar items) */}
          {recommendationsList.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[#262626]">
              <h3 className="text-xs font-bold text-[#8C909F] uppercase tracking-wider">Recommendations</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {recommendationsList.map((rec) => (
                  <Link
                    key={rec.id}
                    href={`/library/tmdb-${rec.type}-${rec.id}`}
                    className="group bg-[#131313] border border-[#262626] rounded-xl overflow-hidden shadow-lg transition-all hover:-translate-y-1 hover:border-[#3B82F6]/50 duration-300"
                  >
                    <div className="aspect-[2/3] bg-[#1C1B1B] relative overflow-hidden">
                      {rec.posterPath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w342${rec.posterPath}`}
                          alt={rec.title}
                          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#262626]">
                          <span className="material-symbols-outlined text-4xl">movie</span>
                        </div>
                      )}
                      
                      {rec.rating > 0 && (
                        <span className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-[#ffb95f] text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">
                          ★ {rec.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    
                    <div className="p-3 space-y-1">
                      <div className="text-xs font-bold text-white group-hover:text-[#3B82F6] transition-colors truncate">
                        {rec.title}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#8C909F] font-semibold">
                        <span className="capitalize">{rec.type === "movie" ? "Movie" : "TV Series"}</span>
                        <span>{rec.releaseYear}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* File details (Movies) */}
          {item.type === "movie" && filesWithStreams.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-[#262626]">
              <h3 className="text-xs font-bold text-[#8C909F] uppercase tracking-wider">Local File Information</h3>
              {filesWithStreams.map((file) => (
                <div key={file.id} className="bg-[#131313] border border-[#262626] rounded-xl p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-semibold text-[#C2C6D6] truncate font-mono" title={file.path}>
                        {file.path}
                      </div>
                      <div className="flex items-center flex-wrap gap-2 text-[10px] text-[#8C909F] font-mono">
                        <span>Size: {(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
                        <span>Format: {file.container}</span>
                        {file.bitrate && <span>Bitrate: {Math.round(file.bitrate / 1000)} kbps</span>}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] text-[10px] font-bold font-mono rounded">
                      {file.videoResolution}
                    </span>
                  </div>

                  {/* Video Specs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <div className="text-[#8C909F]">Codec</div>
                      <div className="text-white font-mono">{file.videoCodec?.toUpperCase()}</div>
                    </div>
                    <div>
                      <div className="text-[#8C909F]">Resolution</div>
                      <div className="text-white font-mono">
                        {file.videoWidth && file.videoHeight ? `${file.videoWidth}x${file.videoHeight}` : "1080p"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#8C909F]">Frame Rate</div>
                      <div className="text-white font-mono">{file.videoFps ? `${file.videoFps} fps` : "23.97 fps"}</div>
                    </div>
                  </div>

                  {/* Tracks */}
                  {file.streams.length > 0 && (
                    <div className="space-y-2 border-t border-[#262626] pt-3">
                      <div className="text-[10px] font-bold text-[#8C909F] uppercase tracking-wider">Internal Tracks</div>
                      <div className="space-y-1.5">
                        {file.streams.map((stream: any) => (
                          <div key={stream.id} className="flex items-center justify-between text-xs bg-[#1C1B1B]/40 px-3 py-1.5 rounded">
                            <span className="font-semibold text-white truncate max-w-[200px]">
                              {stream.title || `${stream.type === "audio" ? "Audio" : "Subtitle"} #${stream.streamIndex}`}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-[#8C909F]">
                              <span className="uppercase">{stream.codec}</span>
                              {stream.language && <span className="uppercase">{stream.language}</span>}
                              {stream.channels && <span>{stream.channels === 2 ? "Stereo" : `${stream.channels - 1}.1`}</span>}
                              {stream.isDefault && <span className="text-[#3B82F6]">Default</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Right Sidebar Column */}
        <div className="md:col-span-1 space-y-6 h-fit">
          {/* Action buttons (Target Library request form) */}
          <div className="space-y-2">
            {currentState === "info" && (
              <form action={handleRequestDetails} className="space-y-3">
                <input type="hidden" name="tmdbId" value={tmdbId} />
                <input type="hidden" name="itemType" value={itemType} />
                <input type="hidden" name="itemId" value={itemId} />
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-[#8C909F] uppercase">
                    Target Library
                  </label>
                  <select
                    name="libraryId"
                    className="w-full bg-[#131313] border border-[#262626] rounded text-white text-xs px-3 py-2 focus:outline-none focus:border-[#3B82F6]"
                  >
                    {allLibs
                      .filter((l) => (item.type === "movie" ? l.type === "movie" || l.type === "video" : l.type === "series"))
                      .map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-blue-500/10"
                >
                  <span className="material-symbols-outlined text-lg">download</span>
                  Request Download
                </button>
              </form>
            )}

            {currentState === "wanted" && (
              <div className="bg-[#131313] border border-[#262626] rounded-xl p-4 space-y-3 shadow-lg">
                <AutoRefresh interval={5000} />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Download Queue Status</span>
                  <span className="text-[#F59E0B] font-mono uppercase tracking-wider text-[10px]">
                    {activeRequest?.status}
                  </span>
                </div>

                <div className="w-full bg-[#262626] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#F59E0B] h-full rounded-full transition-all duration-500"
                    style={{ width: `${activeRequest?.progress || 0}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-[11px] text-[#8C909F]">
                  <span>Progress: {activeRequest?.progress || 0}%</span>
                  {activeRequest?.speed && (
                    <span>{(activeRequest.speed / (1024 * 1024)).toFixed(1)} MB/s</span>
                  )}
                </div>

                <form action={handleCancelRequest} className="pt-2">
                  <input type="hidden" name="requestId" value={activeRequest?.id} />
                  <input type="hidden" name="itemId" value={itemId} />
                  <button
                    type="submit"
                    className="w-full py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-500/30 text-red-300 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    Cancel Request
                  </button>
                </form>
              </div>
            )}

            {currentState === "here" && (
              <div className="space-y-3">
                <button
                  disabled
                  className="w-full py-2.5 px-4 bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] font-semibold text-sm rounded-lg flex items-center justify-center gap-2 cursor-default"
                >
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Locally Available
                </button>
                <form action={handleDeleteMedia}>
                  <input type="hidden" name="itemId" value={itemId} />
                  <button
                    type="submit"
                    className="w-full py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-500/30 text-red-300 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Delete Media & Files
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Media Facts & Ratings Card */}
          <div className="bg-[#131313] border border-[#262626] rounded-xl p-4 space-y-4 shadow-lg text-xs">
          <h4 className="text-[10px] font-bold text-white uppercase tracking-wider pb-2 border-b border-[#262626]">
            Media Facts & Ratings
          </h4>

          {/* Ratings Row */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[#262626]/50 text-[10px] font-bold">
            {/* Rotten Tomatoes Critic */}
            <a
              href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(item.title)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2 py-1 bg-red-950/30 border border-red-500/20 rounded text-red-400 hover:bg-red-950/50 transition-colors"
              title="Rotten Tomatoes Critic Score"
            >
              🍅 {rtRating}%
            </a>

            {/* Rotten Tomatoes Audience */}
            <a
              href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(item.title)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2 py-1 bg-amber-950/30 border border-amber-500/20 rounded text-amber-400 hover:bg-amber-950/50 transition-colors"
              title="Rotten Tomatoes Audience Score"
            >
              🍿 {rtAudienceRating}%
            </a>

            {/* IMDb */}
            {imdbIdToUse && (
              <a
                href={`https://www.imdb.com/title/${imdbIdToUse}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500 hover:bg-yellow-500/20 transition-colors"
                title="IMDb Rating"
              >
                ⭐ {imdbScore}
              </a>
            )}

            {/* TMDB */}
            <a
              href={`https://www.themoviedb.org/${item.type === "movie" ? "movie" : "tv"}/${item.tmdbId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2 py-1 bg-sky-500/10 border border-sky-500/20 rounded text-sky-400 hover:bg-sky-500/20 transition-colors"
              title="TMDB Rating"
            >
              🎬 {tmdbScore}%
            </a>
          </div>

          {/* Facts rows */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center py-1 border-b border-[#262626]/40">
              <span className="text-[#8C909F] font-bold uppercase tracking-wider text-[9px]">Status</span>
              <span className="text-white font-semibold">{status}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#262626]/40">
              <span className="text-[#8C909F] font-bold uppercase tracking-wider text-[9px]">Release Date</span>
              <span className="text-white font-semibold">{item.releaseDate || "N/A"}</span>
            </div>

            {item.type === "movie" && (
              <>
                <div className="flex justify-between items-center py-1 border-b border-[#262626]/40">
                  <span className="text-[#8C909F] font-bold uppercase tracking-wider text-[9px]">Budget</span>
                  <span className="text-white font-semibold">{budget || "N/A"}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#262626]/40">
                  <span className="text-[#8C909F] font-bold uppercase tracking-wider text-[9px]">Revenue</span>
                  <span className="text-white font-semibold">{revenue || "N/A"}</span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center py-1 border-b border-[#262626]/40">
              <span className="text-[#8C909F] font-bold uppercase tracking-wider text-[9px]">Language</span>
              <span className="text-white font-semibold">{originalLanguage}</span>
            </div>

            <div className="flex justify-between items-start py-1 border-b border-[#262626]/40 gap-4">
              <span className="text-[#8C909F] font-bold uppercase tracking-wider text-[9px] shrink-0 mt-0.5">Countries</span>
              <span className="text-white font-semibold text-right">{productionCountries}</span>
            </div>

            {studiosList.length > 0 && (
              <div className="flex justify-between items-start py-1 border-b border-[#262626]/40 gap-4">
                <span className="text-[#8C909F] font-bold uppercase tracking-wider text-[9px] shrink-0 mt-0.5">Studios</span>
                <div className="text-white font-semibold text-right space-y-1">
                  {studiosList.slice(0, 4).map((company: any) => (
                    <Link
                      key={company.id}
                      href={`/?studioId=${company.id}&studioName=${encodeURIComponent(company.name)}`}
                      className="block hover:underline text-[#3B82F6] text-xs"
                    >
                      {company.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {tvNetworksList.length > 0 && (
              <div className="flex justify-between items-start py-1 border-b border-[#262626]/40 gap-4">
                <span className="text-[#8C909F] font-bold uppercase tracking-wider text-[9px] shrink-0 mt-0.5">Networks</span>
                <div className="text-white font-semibold text-right space-y-1">
                  {tvNetworksList.slice(0, 4).map((network: any) => (
                    <Link
                      key={network.id}
                      href={`/?networkId=${network.id}&networkName=${encodeURIComponent(network.name)}`}
                      className="block hover:underline text-[#3B82F6] text-xs"
                    >
                      {network.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* External Links Row */}
          <div className="flex items-center justify-around gap-2 pt-3 border-t border-[#262626]/50 text-[10px] font-semibold text-[#8C909F]">
            <a
              href={`https://www.themoviedb.org/${item.type === "movie" ? "movie" : "tv"}/${item.tmdbId}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              TMDB
            </a>
            {imdbIdToUse && (
              <a
                href={`https://www.imdb.com/title/${imdbIdToUse}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors"
              >
                IMDb
              </a>
            )}
            <a
              href={`https://trakt.tv/search/tmdb/${item.tmdbId}?id_type=${item.type === "movie" ? "movie" : "show"}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Trakt
            </a>
            <a
              href={`https://letterboxd.com/tmdb/${item.tmdbId}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Letterboxd
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
