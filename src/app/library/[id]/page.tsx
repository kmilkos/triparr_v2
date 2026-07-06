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
import { handleRequestDetails } from "./actions";
import { checkAuth } from "@/server/auth";

export default async function MediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkAuth();
  const { id } = await params;

  const allLibs = await db.select().from(libraries).all();

  // 1. Fetch main media item
  const item = await db.select().from(mediaItems).where(eq(mediaItems.id, id)).get();
  if (!item) {
    notFound();
  }

  // 2. Fetch genres
  const genreAssociations = await db
    .select({ name: genres.name })
    .from(mediaGenres)
    .innerJoin(genres, eq(mediaGenres.genreId, genres.id))
    .where(eq(mediaGenres.mediaItemId, id))
    .all();

  // 3. Fetch actors and directors
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

  const cast = castAndCrew.filter((p) => p.role === "cast");
  const directors = castAndCrew.filter((p) => p.role === "crew" && p.job === "Director");

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

  return (
    <div className="space-y-8 pb-12">
      {/* Backdrop Header */}
      {backdropUrl && (
        <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden shadow-2xl -mx-4 sm:mx-0">
          <img src={backdropUrl} alt={item.title} className="object-cover w-full h-full opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent"></div>
        </div>
      )}

      {/* Info Container */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Poster & Quick Actions */}
        <div className="space-y-4">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#131313] border border-[#262626] shadow-xl">
            {posterUrl ? (
              <img src={posterUrl} alt={item.title} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-center p-6 text-[#8C909F]">
                <span className="material-symbols-outlined text-5xl">movie</span>
              </div>
            )}

            {/* Badges */}
            {currentState === "here" && (
              <span className="absolute top-3 right-3 bg-[#10B981] text-white text-xs font-bold px-3 py-1 rounded-full glow-green">
                Available
              </span>
            )}
            {currentState === "wanted" && (
              <span className="absolute top-3 right-3 bg-[#F59E0B] text-white text-xs font-bold px-3 py-1 rounded-full glow-amber">
                Requested
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
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
                  className="w-full py-2.5 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">download</span>
                  Request Download
                </button>
              </form>
            )}

            {currentState === "wanted" && (
              <div className="bg-[#131313] border border-[#262626] rounded-lg p-4 space-y-3">
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
              </div>
            )}

            {currentState === "here" && (
              <button
                disabled
                className="w-full py-2.5 px-4 bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] font-semibold text-sm rounded-lg flex items-center justify-center gap-2 cursor-default"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Locally Available
              </button>
            )}
          </div>
        </div>

        {/* Text descriptions */}
        <div className="md:col-span-3 space-y-6">
          <div>
            <div className="flex items-center flex-wrap gap-3 mb-2">
              <h2 className="text-4xl font-extrabold text-white">{item.title}</h2>
              <span className="text-xl text-[#8C909F] font-mono">({releaseYear})</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#8C909F]">
              <span className="px-2 py-0.5 border border-[#262626] rounded text-white bg-[#131313]">
                {item.type === "movie" ? "Movie" : "TV Series"}
              </span>
              {item.runtime && <span>{item.runtime} min</span>}
              {item.rating && (
                <span className="text-[#ffb95f] flex items-center gap-1 font-mono font-bold">
                  ★ {item.rating.toFixed(1)}
                </span>
              )}
              {genreAssociations.map((g) => (
                <span key={g.name} className="px-2 py-0.5 bg-[#1C1B1B] rounded">
                  {g.name}
                </span>
              ))}
            </div>
          </div>

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
              <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                {cast.map((actor) => (
                  <div key={actor.name} className="flex-shrink-0 w-24 text-center">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#131313] border border-[#262626] mx-auto mb-1.5">
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
                    <div className="text-xs text-white font-semibold truncate" title={actor.name}>
                      {actor.name}
                    </div>
                    <div className="text-[10px] text-[#8C909F] truncate" title={actor.character || undefined}>
                      {actor.character}
                    </div>
                  </div>
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

          {/* Hierarchy Details (TV Series) */}
          {item.type === "series" && seasonsWithEpisodes.length > 0 && (
            <div className="space-y-6 pt-4 border-t border-[#262626]">
              <h3 className="text-xs font-bold text-[#8C909F] uppercase tracking-wider">Seasons & Episodes</h3>
              {seasonsWithEpisodes.map((season) => (
                <div key={season.id} className="bg-[#131313] border border-[#262626] rounded-xl overflow-hidden">
                  <div className="bg-[#1C1B1B] px-4 py-3 border-b border-[#262626] flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">{season.title}</span>
                    <span className="text-[10px] font-mono text-[#8C909F]">
                      {season.episodes.length} Episodes
                    </span>
                  </div>
                  <div className="divide-y divide-[#262626]">
                    {season.episodes.map((ep: any) => (
                      <div key={ep.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-white">
                            Episode {ep.episodeNumber}: {ep.title}
                          </div>
                          {ep.overview && <p className="text-[11px] text-[#8C909F] leading-normal max-w-2xl">{ep.overview}</p>}
                        </div>

                        {/* File details for episode */}
                        {ep.file ? (
                          <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                            <span className="px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] text-[10px] font-bold font-mono rounded">
                              {ep.file.videoResolution}
                            </span>
                            <div className="text-right">
                              <div className="text-[10px] font-mono text-white">
                                {(ep.file.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                              </div>
                              <div className="text-[9px] font-mono text-[#8C909F] uppercase">
                                {ep.file.container} / {ep.file.videoCodec}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-[#262626] text-[#8C909F] text-[10px] font-bold rounded self-start sm:self-center shrink-0">
                            Missing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
