import { db } from "@/server/db";
import { requests, mediaItems, libraries } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { checkAuth } from "@/server/auth";
import { AutoRefresh } from "../components/AutoRefresh";
import Link from "next/link";
import { searchProwlarr } from "@/server/requests/prowlarr";
import {
  handleCancelRequest,
  handleRetryRequest,
  handleSelectRelease,
} from "./actions";

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatEta(seconds?: number | null): string {
  if (!seconds) return "Unknown";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    manualSearchId?: string;
    success?: string;
    error?: string;
  }>;
}) {
  await checkAuth();
  const params = await searchParams;
  const { manualSearchId, success, error } = params;

  // Fetch all requests
  const queueItems = await db
    .select({
      request: requests,
      item: mediaItems,
      library: libraries,
    })
    .from(requests)
    .innerJoin(mediaItems, eq(requests.mediaItemId, mediaItems.id))
    .leftJoin(libraries, eq(requests.libraryId, libraries.id))
    .orderBy(desc(requests.updatedAt))
    .all();

  // Statistics
  const totalCount = queueItems.length;
  const downloadingCount = queueItems.filter(
    (i) => i.request.status === "DOWNLOADING" || i.request.status === "DOWNLOADING_FILE"
  ).length;
  const completedCount = queueItems.filter((i) => i.request.status === "COMPLETED").length;
  const failedCount = queueItems.filter((i) => i.request.status === "FAILED").length;

  // Active items for AutoRefresh
  const hasActiveDownloads = queueItems.some(
    (i) => !["COMPLETED", "FAILED", "CANCELLED"].includes(i.request.status)
  );

  // Manual release search
  let manualSearchItem: any = null;
  let candidates: any[] = [];
  let manualSearchError = "";

  if (manualSearchId) {
    const req = await db
      .select({
        request: requests,
        item: mediaItems,
      })
      .from(requests)
      .innerJoin(mediaItems, eq(requests.mediaItemId, mediaItems.id))
      .where(eq(requests.id, manualSearchId))
      .get();

    if (req) {
      manualSearchItem = req;
      const queryStr =
        req.item.type === "movie"
          ? `${req.item.title} ${
              req.item.releaseDate ? req.item.releaseDate.split("-")[0] : ""
            }`
          : req.item.title;

      try {
        candidates = await searchProwlarr(queryStr, req.item.type);
      } catch (err: any) {
        manualSearchError = err.message || String(err);
      }
    }
  }

  return (
    <div className="space-y-8 pb-16">
      {/* AutoRefresh on-demand */}
      {hasActiveDownloads && !manualSearchId && <AutoRefresh interval={5000} />}

      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          Request & Download Queue
        </h2>
        <p className="text-sm text-[#C2C6D6]">
          Monitor Real-Debrid downloads, trigger retries, or manually search and select release candidates.
        </p>
      </div>

      {/* Success/Error Banners */}
      {success && (
        <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-sm rounded-lg flex items-center gap-3">
          <span className="material-symbols-outlined">check_circle</span>
          <div className="font-semibold">{success}</div>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#131313] border border-[#262626] rounded-xl p-4">
          <div className="text-[#8C909F] text-xs font-bold uppercase">Total Requests</div>
          <div className="text-2xl font-extrabold text-white mt-1">{totalCount}</div>
        </div>
        <div className="bg-[#131313] border border-[#262626] rounded-xl p-4">
          <div className="text-[#8C909F] text-xs font-bold uppercase">Downloading</div>
          <div className="text-2xl font-extrabold text-[#3B82F6] mt-1">{downloadingCount}</div>
        </div>
        <div className="bg-[#131313] border border-[#262626] rounded-xl p-4">
          <div className="text-[#8C909F] text-xs font-bold uppercase">Completed</div>
          <div className="text-2xl font-extrabold text-[#10B981] mt-1">{completedCount}</div>
        </div>
        <div className="bg-[#131313] border border-[#262626] rounded-xl p-4">
          <div className="text-[#8C909F] text-xs font-bold uppercase">Failed</div>
          <div className="text-2xl font-extrabold text-red-500 mt-1">{failedCount}</div>
        </div>
      </div>

      {/* MANUAL RELEASE SEARCH INTERFACE */}
      {manualSearchItem && (
        <div className="bg-[#131313] border border-[#3B82F6]/30 rounded-xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[#3B82F6]/5 pointer-events-none"></div>
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-4">
            <div>
              <span className="text-[10px] bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                Manual Selection Mode
              </span>
              <h3 className="text-lg font-bold text-white mt-1.5">
                Release Candidates for: {manualSearchItem.item.title}
              </h3>
            </div>
            <Link
              href="/queue"
              className="py-1.5 px-4 bg-[#262626] hover:bg-[#323232] border border-[#3a3939] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors self-start shrink-0"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              Close Search
            </Link>
          </div>

          {manualSearchError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg">
              Error fetching candidates: {manualSearchError}
            </div>
          )}

          {candidates.length === 0 ? (
            <div className="p-12 text-center text-[#8C909F]">
              Querying Prowlarr indexers, or no matching release candidates found...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#262626] text-[#8C909F] font-bold uppercase tracking-wider">
                    <th className="pb-3 pr-4">Title / Details</th>
                    <th className="pb-3 px-4">Size</th>
                    <th className="pb-3 px-4">Peers</th>
                    <th className="pb-3 px-4">Indexer</th>
                    <th className="pb-3 pl-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]/50">
                  {candidates.map((candidate, idx) => (
                    <tr key={idx} className="hover:bg-[#1C1B1B]/40 transition-colors">
                      <td className="py-3.5 pr-4 font-medium text-white max-w-md truncate" title={candidate.title}>
                        {candidate.title}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#C2C6D6]">
                        {formatBytes(candidate.size)}
                      </td>
                      <td className="py-3.5 px-4 text-[#8C909F]">
                        <span className="text-[#10B981] font-bold">▲ {candidate.seeders}</span> /{" "}
                        <span className="text-red-400 font-bold">▼ {candidate.peers}</span>
                      </td>
                      <td className="py-3.5 px-4 text-[#8C909F] font-semibold">
                        {candidate.indexer}
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <form action={handleSelectRelease}>
                          <input type="hidden" name="requestId" value={manualSearchId} />
                          <input type="hidden" name="downloadUrl" value={candidate.downloadUrl} />
                          <input type="hidden" name="title" value={candidate.title} />
                          <input type="hidden" name="size" value={candidate.size} />
                          <button
                            type="submit"
                            className="py-1.5 px-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded text-[11px] transition-colors"
                          >
                            Send to Debrid
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* QUEUE ITEMS LIST */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Active & Past Requests</h3>

        {queueItems.length === 0 ? (
          <div className="p-12 text-center bg-[#131313] border border-[#262626] rounded-xl text-[#8C909F]">
            No requests found in the queue. Search for movies or TV shows to request downloads.
          </div>
        ) : (
          <div className="space-y-4">
            {queueItems.map(({ request, item, library }) => {
              const releaseYear = (item.releaseDate || "").split("-")[0];
              const posterUrl = item.posterPath
                ? `https://image.tmdb.org/t/p/w185${item.posterPath}`
                : null;

              // Color classes for request states
              let stateColor = "bg-[#262626] text-[#8C909F]";
              if (request.status === "COMPLETED") {
                stateColor = "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20";
              } else if (["DOWNLOADING", "DOWNLOADING_FILE", "ORGANIZING"].includes(request.status)) {
                stateColor = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
              } else if (["SEARCHING", "REQUESTED"].includes(request.status)) {
                stateColor = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
              } else if (request.status === "FAILED") {
                stateColor = "bg-red-500/10 text-red-400 border border-red-500/20";
              }

              return (
                <div
                  key={request.id}
                  className="bg-[#131313] border border-[#262626] rounded-xl p-5 flex flex-col md:flex-row gap-5 hover:border-[#3b82f6]/30 transition-colors"
                >
                  {/* Left Side: Poster cover */}
                  <Link
                    href={`/library/${item.id}`}
                    className="w-16 h-24 bg-[#1c1b1b] rounded-lg overflow-hidden shrink-0 shadow border border-[#262626]/50 relative"
                  >
                    {posterUrl ? (
                      <img src={posterUrl} alt={item.title} className="object-cover w-full h-full" />
                    ) : (
                      <span className="material-symbols-outlined text-xl absolute inset-0 m-auto text-[#262626]">
                        movie
                      </span>
                    )}
                  </Link>

                  {/* Middle Side: Title, release title, and progress */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start flex-wrap gap-x-3 gap-y-1.5 justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <Link
                            href={`/library/${item.id}`}
                            className="font-bold text-white text-base hover:text-[#3B82F6] transition-colors truncate"
                          >
                            {item.title}
                          </Link>
                          <span className="text-xs text-[#8C909F]">({releaseYear})</span>
                        </div>
                        <p className="text-[10px] text-[#8C909F] font-semibold mt-0.5">
                          {item.type === "movie" ? "Movie" : "TV Series"} • Target Library:{" "}
                          <span className="text-white font-bold">{library?.name || "Default"}</span>
                        </p>
                      </div>

                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${stateColor}`}>
                        {request.status}
                      </span>
                    </div>

                    {/* Active release title details */}
                    {request.releaseTitle && (
                      <div className="text-[11px] text-[#8C909F] font-mono truncate max-w-2xl bg-[#0A0A0A]/40 px-2.5 py-1 rounded border border-[#262626]/40">
                        Release: <span className="text-[#C2C6D6] font-semibold">{request.releaseTitle}</span>
                        {request.releaseSize && ` (${formatBytes(request.releaseSize)})`}
                      </div>
                    )}

                    {/* Progress details */}
                    {request.status !== "COMPLETED" &&
                      request.status !== "FAILED" &&
                      request.status !== "CANCELLED" && (
                        <div className="space-y-1.5 max-w-xl">
                          <div className="w-full bg-[#262626] h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-[#3B82F6] h-full rounded-full transition-all duration-500"
                              style={{ width: `${request.progress}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-mono text-[#8C909F]">
                            <span className="font-semibold text-white">{request.progress}% Complete</span>
                            <div className="flex items-center gap-3">
                              {request.speed && (
                                <span className="flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[11px]">download</span>
                                  {(request.speed / (1024 * 1024)).toFixed(1)} MB/s
                                </span>
                              )}
                              {request.eta && (
                                <span className="flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[11px]">schedule</span>
                                  ETA: {formatEta(request.eta)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Right Side: Actions column */}
                  <div className="flex md:flex-col justify-end md:justify-center items-stretch gap-2 shrink-0 md:border-l border-[#262626] md:pl-5 md:min-w-[140px]">
                    {/* Manual Search overrides */}
                    {(request.status === "REQUESTED" ||
                      request.status === "SEARCHING" ||
                      request.status === "FAILED") && (
                      <Link
                        href={`/queue?manualSearchId=${request.id}`}
                        className="py-1.5 px-3 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/25 border border-[#3B82F6]/20 text-[#3B82F6] font-semibold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">search</span>
                        Manual Search
                      </Link>
                    )}

                    {/* Retry overrides */}
                    {(request.status === "FAILED" || request.status === "CANCELLED") && (
                      <form action={handleRetryRequest}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <button
                          type="submit"
                          className="w-full py-1.5 px-3 bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/20 text-[#10B981] font-semibold text-xs rounded-lg flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
                        >
                          <span className="material-symbols-outlined text-sm">refresh</span>
                          Force Retry
                        </button>
                      </form>
                    )}

                    {/* Cancel button */}
                    {request.status !== "COMPLETED" && (
                      <form action={handleCancelRequest}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <button
                          type="submit"
                          className="w-full py-1.5 px-3 bg-red-950/20 hover:bg-red-950/45 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
                        >
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          Cancel Request
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
