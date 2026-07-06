import { searchTMDB } from "@/server/metadata/tmdb";
import { db } from "@/server/db";
import { mediaItems, requests, mediaFiles, libraries } from "@/server/db/schema";
import { eq, notInArray, sql } from "drizzle-orm";
import Image from "next/image";
import { checkAuth } from "@/server/auth";
import Link from "next/link";
import { handleRequestAction } from "./actions";
import { getSetting } from "@/server/settings";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: "movie" | "series" }>;
}) {
  await checkAuth();
  const { q = "", tab = "movie" } = await searchParams;
  let movieResults: any[] = [];
  let tvResults: any[] = [];
  const tmdbToken = await getSetting<string>("tmdb_api_token");

  if (q.trim() && tmdbToken) {
    // Search both movies and TV shows
    movieResults = (await searchTMDB(q, "movie")) || [];
    tvResults = (await searchTMDB(q, "series")) || [];
  }

  const activeResults = tab === "movie"
    ? movieResults.map((r: any) => ({ ...r, media_type: "movie" as const }))
    : tvResults.map((r: any) => ({ ...r, media_type: "series" as const }));

  const allLibs = await db.select().from(libraries).all();

  // Load existing states to show badges
  const cachedItems = await db.select().from(mediaItems).all();
  const cachedRequests = await db
    .select()
    .from(requests)
    .where(notInArray(requests.status, ["COMPLETED", "FAILED", "CANCELLED"]))
    .all();
  
  // Also see what's downloaded
  const downloadedFiles = await db.select().from(mediaFiles).all();

  // Helper to determine state for a search result
  function getResultState(id: number, type: string): "here" | "wanted" | "info" {
    const mediaItemId = `tmdb-${type}-${id}`;
    
    // Check if downloaded
    const hasDownloaded = downloadedFiles.some((f) => f.mediaItemId === mediaItemId);
    if (hasDownloaded) return "here";

    // Check if wanted
    const hasRequest = cachedRequests.some((r) => r.mediaItemId === mediaItemId);
    if (hasRequest) return "wanted";

    return "info";
  }

  return (
    <div className="space-y-8">
      {/* Page Title & Search Bar */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Discover Media</h2>
        <p className="text-sm text-[#C2C6D6]">Search for movies and TV series to add to your library.</p>
      </div>

      {!tmdbToken && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm rounded-lg flex items-center gap-3 max-w-2xl">
          <span className="material-symbols-outlined text-amber-500">warning</span>
          <div>
            <span className="font-bold">TMDB token is missing.</span> Please configure your TMDB API Read Access Token in{" "}
            <Link href="/settings" className="underline font-semibold hover:text-white transition-colors">
              Settings
            </Link>{" "}
            to enable media search functionality.
          </div>
        </div>
      )}

      <form method="GET" action="/" className="relative max-w-2xl">
        <span className="material-symbols-outlined absolute left-4 top-3.5 text-[#8C909F]">search</span>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search movie or TV series title..."
          className="w-full pl-12 pr-24 py-3 bg-[#131313] border border-[#262626] rounded-xl text-white focus:outline-none focus:border-[#3B82F6] transition-colors shadow-lg"
        />
        <button
          type="submit"
          className="absolute right-2 top-2 py-1.5 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Search
        </button>
      </form>

      {/* Results Section */}
      {q && (
        <div className="space-y-6">
          {/* Tab Filter Header */}
          <div className="flex border-b border-[#262626] gap-2">
            <Link
              href={`/?q=${q}&tab=movie`}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === "movie"
                  ? "border-[#3B82F6] text-[#3B82F6]"
                  : "border-transparent text-[#8C909F] hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">movie</span>
              Movies ({movieResults.length})
            </Link>
            <Link
              href={`/?q=${q}&tab=series`}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === "series"
                  ? "border-[#3B82F6] text-[#3B82F6]"
                  : "border-transparent text-[#8C909F] hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">tv</span>
              TV Series ({tvResults.length})
            </Link>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Search Results for "{q}"</h3>
            
            {activeResults.length === 0 ? (
              <div className="p-8 text-center bg-[#131313] border border-[#262626] rounded-xl text-[#8C909F]">
                No {tab === "movie" ? "movies" : "TV series"} found. Try another search query.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {activeResults.map((result) => {
                  const state = getResultState(result.id, result.media_type);
                  const title = result.title || result.name;
                  const releaseYear = (result.release_date || result.first_air_date || "").split("-")[0];
                  const posterUrl = result.poster_path
                    ? `https://image.tmdb.org/t/p/w342${result.poster_path}`
                    : null;

                  return (
                    <div key={result.id} className="flex flex-col bg-[#131313] border border-[#262626] rounded-xl p-3 hover:border-[#3a3939] transition-colors group">
                      {/* Poster */}
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#1c1b1b] mb-3 shadow-md">
                        {posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={title}
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 text-xs text-[#8C909F]">
                            <span className="material-symbols-outlined text-3xl mb-1 text-[#262626]">movie</span>
                            {title}
                          </div>
                        )}
                        
                        {/* State Badges */}
                        {state === "here" && (
                          <span className="absolute top-2 right-2 bg-[#10B981]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full glow-green">
                            Available
                          </span>
                        )}
                        {state === "wanted" && (
                          <span className="absolute top-2 right-2 bg-[#F59E0B]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full glow-amber">
                            Requested
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-semibold text-sm text-white truncate group-hover:text-[#3B82F6] transition-colors" title={title}>
                            {title}
                          </h4>
                          <div className="flex items-center justify-between text-xs text-[#8C909F] mt-1 font-mono">
                            <span>{releaseYear || "N/A"}</span>
                            <span className="capitalize">{result.media_type === "movie" ? "Movie" : "TV"}</span>
                          </div>
                        </div>

                        {/* Request Action button */}
                        <div className="mt-3">
                          {state === "info" ? (
                            <form action={handleRequestAction} className="space-y-2">
                              <input type="hidden" name="tmdbId" value={result.id} />
                              <input type="hidden" name="mediaType" value={result.media_type} />
                              <input type="hidden" name="query" value={q} />
                              <select
                                name="libraryId"
                                className="w-full bg-[#131313] border border-[#262626] rounded text-white text-[10px] px-2 py-1 focus:outline-none focus:border-[#3B82F6]"
                              >
                                {allLibs
                                  .filter((l) => (result.media_type === "movie" ? l.type === "movie" || l.type === "video" : l.type === "series"))
                                  .map((l) => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                  ))}
                              </select>
                              <button
                                type="submit"
                                className="w-full py-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[11px] font-semibold rounded transition-colors"
                              >
                                Request
                              </button>
                            </form>
                          ) : state === "wanted" ? (
                            <button
                              disabled
                              className="w-full py-1.5 bg-[#262626] text-[#8C909F] text-xs font-semibold rounded cursor-not-allowed text-center"
                            >
                              In Queue
                            </button>
                          ) : (
                            <Link
                              href={`/library`}
                              className="w-full block text-center py-1.5 bg-[#1C1B1B] text-[#10B981] border border-[#10B981]/20 text-xs font-semibold rounded hover:bg-[#10B981]/10 transition-colors"
                            >
                              View Library
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popular / Cached Items */}
      {!q && (
        <div className="space-y-6">
          <div className="p-12 text-center bg-[#131313] border border-[#262626] rounded-2xl max-w-xl mx-auto shadow-2xl">
            <span className="material-symbols-outlined text-5xl text-[#3B82F6] mb-4">search</span>
            <h3 className="text-xl font-bold text-white mb-2">Search to Request Media</h3>
            <p className="text-sm text-[#8C909F] leading-relaxed mb-6">
              Enter any movie or TV series name in the search bar above. Triparr will look it up on TMDB,
              and you can request direct high-speed debrid downloads.
            </p>
            <div className="flex justify-center gap-3 text-xs text-[#8C909F]">
              <span className="px-3 py-1 bg-[#1C1B1B] border border-[#262626] rounded-full">Movies</span>
              <span className="px-3 py-1 bg-[#1C1B1B] border border-[#262626] rounded-full">TV Shows</span>
              <span className="px-3 py-1 bg-[#1C1B1B] border border-[#262626] rounded-full">Anime</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
