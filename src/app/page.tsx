import { searchTMDB, getTrending, getPopularMovies, getPopularSeries, getUpcomingMovies, getUpcomingSeries, getMovieGenres, getSeriesGenres, discoverByGenre, discoverByCompanyOrNetwork } from "@/server/metadata/tmdb";
import { db } from "@/server/db";
import { mediaItems, requests, mediaFiles, libraries } from "@/server/db/schema";
import { eq, notInArray, desc, sql } from "drizzle-orm";
import { checkAuth } from "@/server/auth";
import Link from "next/link";
import { handleRequestAction, handleCancelRequestAction } from "./actions";
import { getSetting } from "@/server/settings";

const POPULAR_STUDIOS = [
  { id: 420, name: "Marvel", logo: "🦸‍♂️" },
  { id: 3, name: "Pixar", logo: "💡" },
  { id: 2, name: "Disney", logo: "🏰" },
  { id: 174, name: "Warner Bros.", logo: "🛡️" },
  { id: 33, name: "Universal", logo: "🌍" },
  { id: 4, name: "Paramount", logo: "🏔️" },
  { id: 2251, name: "Sony Pictures", logo: "🎥" },
];

const POPULAR_NETWORKS = [
  { id: 49, name: "HBO", logo: "📺" },
  { id: 213, name: "Netflix", logo: "🔴" },
  { id: 2739, name: "Disney+", logo: "⭐" },
  { id: 1024, name: "Amazon Prime", logo: "📦" },
  { id: 2552, name: "Apple TV+", logo: "🍎" },
  { id: 29, name: "AMC", logo: "🧟" },
  { id: 4, name: "BBC", logo: "🇬🇧" },
];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tab?: "movie" | "series";
    genreId?: string;
    genreName?: string;
    studioId?: string;
    studioName?: string;
    networkId?: string;
    networkName?: string;
  }>;
}) {
  await checkAuth();
  const params = await searchParams;
  const {
    q = "",
    tab = "movie",
    genreId,
    genreName,
    studioId,
    studioName,
    networkId,
    networkName,
  } = params;

  const tmdbToken = await getSetting<string>("tmdb_api_token");

  // Fetch search or filter results if filtering is active
  let filterResults: any[] = [];
  let filterTitle = "";
  let isFiltering = false;

  if (tmdbToken) {
    if (q.trim()) {
      // standard search handled separately
    } else if (genreId) {
      isFiltering = true;
      filterTitle = `Genre: ${genreName}`;
      filterResults = await discoverByGenre(parseInt(genreId, 10), tab);
    } else if (studioId) {
      isFiltering = true;
      filterTitle = `Studio: ${studioName}`;
      filterResults = await discoverByCompanyOrNetwork(parseInt(studioId, 10), "movie");
    } else if (networkId) {
      isFiltering = true;
      filterTitle = `Network: ${networkName}`;
      filterResults = await discoverByCompanyOrNetwork(parseInt(networkId, 10), "series");
    }
  }

  // Load existing states to show badges
  const downloadedFiles = await db.select().from(mediaFiles).all();
  const cachedRequests = await db
    .select()
    .from(requests)
    .where(notInArray(requests.status, ["COMPLETED", "FAILED", "CANCELLED"]))
    .all();

  // Helper to determine state for a search result
  function getResultState(id: number, type: string): "here" | "wanted" | "info" {
    const mediaItemId = `tmdb-${type}-${id}`;
    const hasDownloaded = downloadedFiles.some((f) => f.mediaItemId === mediaItemId || (f.episodeId && f.episodeId.includes(mediaItemId)));
    if (hasDownloaded) return "here";
    const hasRequest = cachedRequests.some((r) => r.mediaItemId === mediaItemId);
    if (hasRequest) return "wanted";
    return "info";
  }

  function getResultRequest(id: number, type: string) {
    const mediaItemId = `tmdb-${type}-${id}`;
    return cachedRequests.find((r) => r.mediaItemId === mediaItemId);
  }

  // Search Results
  let searchMovieResults: any[] = [];
  let searchTVResults: any[] = [];
  if (q.trim() && tmdbToken) {
    searchMovieResults = await searchTMDB(q, "movie");
    searchTVResults = await searchTMDB(q, "series");
  }

  const activeSearchResults = tab === "movie"
    ? searchMovieResults.map((r: any) => ({ ...r, media_type: "movie" as const }))
    : searchTVResults.map((r: any) => ({ ...r, media_type: "series" as const }));

  const allLibs = await db.select().from(libraries).all();

  // Dashboard Data (loaded if not searching or filtering)
  const showDashboard = !q.trim() && !genreId && !studioId && !networkId;
  let trending: any[] = [];
  let popularMovies: any[] = [];
  let popularSeries: any[] = [];
  let upcomingMovies: any[] = [];
  let upcomingSeries: any[] = [];
  let movieGenres: any[] = [];
  let tvGenres: any[] = [];
  let recentlyAdded: any[] = [];
  let activeQueueRequests: any[] = [];

  if (showDashboard && tmdbToken) {
    [
      trending,
      popularMovies,
      popularSeries,
      upcomingMovies,
      upcomingSeries,
      movieGenres,
      tvGenres,
      recentlyAdded,
      activeQueueRequests,
    ] = await Promise.all([
      getTrending(),
      getPopularMovies(),
      getPopularSeries(),
      getUpcomingMovies(),
      getUpcomingSeries(),
      getMovieGenres(),
      getSeriesGenres(),
      db.select().from(mediaItems).orderBy(desc(mediaItems.addedAt)).limit(10).all(),
      db
        .select({
          request: requests,
          item: mediaItems,
        })
        .from(requests)
        .innerJoin(mediaItems, eq(requests.mediaItemId, mediaItems.id))
        .all(),
    ]);
  }
  const resultsToRender = q ? activeSearchResults : filterResults.map(r => ({ ...r, media_type: tab }));

  return (
    <div className="space-y-10 pb-16">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">
            {isFiltering ? filterTitle : "Discover Media"}
          </h2>
          <p className="text-sm text-[#C2C6D6]">
            {isFiltering ? `Browse catalog matching ${filterTitle}` : "Explore trending releases, genres, and request high-speed direct downloads."}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Main Search Bar */}
          <form method="GET" action="/" className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-4 top-2.5 text-[#8C909F] text-lg">search</span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search movie or TV series..."
              className="w-full bg-[#131313] text-white text-xs pl-11 pr-4 py-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-[#3B82F6] placeholder-[#8C909F] shadow-inner transition-colors"
            />
          </form>

          {/* Clear Filter button */}
          {isFiltering && (
            <Link
              href="/"
              className="py-2.5 px-4 bg-[#262626] hover:bg-[#323232] border border-[#3a3939] text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to Dashboard
            </Link>
          )}
        </div>
      </div>

      {!tmdbToken && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm rounded-lg flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-500">warning</span>
          <div>
            <span className="font-bold">TMDB token is missing.</span> Please configure your TMDB API Read Access Token in{" "}
            <Link href="/settings" className="underline font-semibold hover:text-white transition-colors">
              Settings
            </Link>{" "}
            to enable media search & catalog browsing.
          </div>
        </div>
      )}

      {/* RENDER MODE 1: SEARCH OR FILTER ACTIVE */}
      {(q || isFiltering) && (
        <div className="space-y-6">
          {/* Tab Filter Header for Search / Genres */}
          {!studioId && !networkId && (
            <div className="flex border-b border-[#262626] gap-2">
              <Link
                href={q ? `/?q=${q}&tab=movie` : `/?genreId=${genreId}&genreName=${genreName}&tab=movie`}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  tab === "movie"
                    ? "border-[#3B82F6] text-[#3B82F6]"
                    : "border-transparent text-[#8C909F] hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">movie</span>
                Movies
              </Link>
              <Link
                href={q ? `/?q=${q}&tab=series` : `/?genreId=${genreId}&genreName=${genreName}&tab=series`}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  tab === "series"
                    ? "border-[#3B82F6] text-[#3B82F6]"
                    : "border-transparent text-[#8C909F] hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">tv</span>
                TV Series
              </Link>
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              {q ? `Search Results for "${q}"` : `${filterTitle} (${tab === "movie" ? "Movies" : "TV Series"})`}
            </h3>
            {resultsToRender.length === 0 ? (
              <div className="p-12 text-center bg-[#131313] border border-[#262626] rounded-xl text-[#8C909F]">
                No items found. Try a different category or search query.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {resultsToRender.map((result: any) => {
                  const mType = result.media_type || tab;
                  const state = getResultState(result.id, mType);
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

                        {/* Badges */}
                        {state === "here" && (
                          <span className="absolute top-2 right-2 bg-[#10B981]/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full glow-green">
                            Available
                          </span>
                        )}
                        {state === "wanted" && (
                          <span className="absolute top-2 right-2 bg-[#F59E0B]/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full glow-amber">
                            Requested
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-semibold text-sm text-white truncate group-hover:text-[#3B82F6] transition-colors" title={title}>
                            {title}
                          </h4>
                          <div className="flex items-center justify-between text-xs text-[#8C909F] mt-1 font-mono">
                            <span>{releaseYear || "N/A"}</span>
                            <span className="capitalize">{mType === "movie" ? "Movie" : "TV"}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-3">
                          {state === "info" ? (
                            <form action={handleRequestAction} className="space-y-2">
                              <input type="hidden" name="tmdbId" value={result.id} />
                              <input type="hidden" name="mediaType" value={mType} />
                              <input type="hidden" name="query" value={q} />
                              <select
                                name="libraryId"
                                className="w-full bg-[#131313] border border-[#262626] rounded text-white text-[10px] px-2 py-1 focus:outline-none focus:border-[#3B82F6]"
                              >
                                {allLibs
                                  .filter((l) => (mType === "movie" ? l.type === "movie" || l.type === "video" : l.type === "series"))
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
                            <div className="space-y-1.5">
                              <div className="text-[10px] text-center text-[#F59E0B] font-bold bg-[#F59E0B]/10 border border-[#F59E0B]/20 py-1 rounded">
                                Requested ({getResultRequest(result.id, mType)?.status})
                              </div>
                              <form action={handleCancelRequestAction}>
                                <input type="hidden" name="requestId" value={getResultRequest(result.id, mType)?.id} />
                                <input type="hidden" name="redirectUrl" value={`/?q=${encodeURIComponent(q)}`} />
                                <button
                                  type="submit"
                                  className="w-full py-1 bg-red-950/30 hover:bg-red-900/45 border border-red-500/20 text-red-400 text-[10px] font-bold rounded flex items-center justify-center gap-1 transition-all active:scale-95"
                                >
                                  <span className="material-symbols-outlined text-xs">cancel</span>
                                  Cancel Request
                                </button>
                              </form>
                            </div>
                          ) : (
                            <Link
                              href={`/library/tmdb-${mType}-${result.id}`}
                              className="w-full block text-center py-1.5 bg-[#1C1B1B] text-[#10B981] border border-[#10B981]/20 text-xs font-semibold rounded hover:bg-[#10B981]/10 transition-colors"
                            >
                              View Details
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

      {/* RENDER MODE 2: DASHBOARD HOME (Netflix/Plex Style) */}
      {showDashboard && tmdbToken && (
        <div className="space-y-12">
          
          {/* A. ACTIVE REQUESTS QUEUE ROW */}
          {activeQueueRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] inline-block animate-pulse"></span>
                Active Requests Queue
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                {activeQueueRequests.map(({ request, item }) => (
                  <div
                    key={request.id}
                    className="flex-shrink-0 w-80 bg-[#131313] border border-[#262626] rounded-xl p-4 flex flex-col justify-between gap-4 hover:border-[#3b82f6]/50 transition-colors group"
                  >
                    <Link href={`/library/${item.id}`} className="flex items-start gap-4 min-w-0">
                      <div className="w-16 h-24 relative bg-[#1c1b1b] rounded overflow-hidden shrink-0 shadow">
                        {item.posterPath ? (
                          <img src={`https://image.tmdb.org/t/p/w185${item.posterPath}`} alt={item.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <span className="material-symbols-outlined text-lg absolute inset-0 m-auto text-[#262626]">movie</span>
                        )}
                      </div>
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate group-hover:text-[#3B82F6] transition-colors">{item.title}</div>
                        <div className="text-[10px] text-[#8C909F] capitalize font-semibold">{item.type === "movie" ? "Movie" : "TV Series"} • <span className="text-[#F59E0B] font-mono">{request.status}</span></div>
                        
                        <div className="space-y-1">
                          <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#3B82F6] h-full rounded-full" style={{ width: `${request.progress || 0}%` }}></div>
                          </div>
                          <div className="flex justify-between text-[9px] text-[#8C909F] font-mono">
                            <span>{request.progress}% Complete</span>
                            {request.speed && <span>{(request.speed / (1024 * 1024)).toFixed(1)} MB/s</span>}
                          </div>
                        </div>
                      </div>
                    </Link>

                    <form action={handleCancelRequestAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="redirectUrl" value="/" />
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        Cancel Request
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B. RECENTLY ADDED */}
          {recentlyAdded.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#10B981] text-lg">verified</span>
                Recently Added
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                {recentlyAdded.map((item) => (
                  <Link
                    key={item.id}
                    href={`/library/${item.id}`}
                    className="flex-shrink-0 w-36 bg-[#131313] border border-[#262626] rounded-xl p-2.5 hover:border-[#3a3939] transition-colors group text-center"
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1c1b1b] mb-2 shadow relative">
                      {item.posterPath ? (
                        <img src={`https://image.tmdb.org/t/p/w185${item.posterPath}`} alt={item.title} className="object-cover w-full h-full" />
                      ) : (
                        <span className="material-symbols-outlined text-lg absolute inset-0 m-auto text-[#262626]">movie</span>
                      )}
                      <span className="absolute bottom-1 right-1 bg-[#10B981]/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                        Added
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white truncate" title={item.title}>{item.title}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* C. TRENDING */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-lg font-bold">trending_up</span>
              Trending Today
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {trending.slice(0, 15).map((item) => {
                const title = item.title || item.name;
                const mType = item.media_type;
                const state = getResultState(item.id, mType);
                return (
                  <Link
                    key={item.id}
                    href={state === "here" ? `/library/tmdb-${mType}-${item.id}` : `/library/tmdb-${mType}-${item.id}`}
                    className="flex-shrink-0 w-36 bg-[#131313] border border-[#262626] rounded-xl p-2.5 hover:border-[#3a3939] transition-colors relative"
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1c1b1b] mb-2 shadow relative">
                      {item.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w185${item.poster_path}`} alt={title} className="object-cover w-full h-full" />
                      ) : (
                        <span className="material-symbols-outlined text-lg absolute inset-0 m-auto text-[#262626]">movie</span>
                      )}
                      {state === "here" && (
                        <span className="absolute top-1.5 right-1.5 bg-[#10B981]/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">Available</span>
                      )}
                      {state === "wanted" && (
                        <span className="absolute top-1.5 right-1.5 bg-[#F59E0B]/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">Requested</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-white truncate" title={title}>{title}</div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* D. POPULAR MOVIES */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">star</span>
              Popular Movies
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {popularMovies.slice(0, 15).map((item) => {
                const state = getResultState(item.id, "movie");
                return (
                  <Link
                    key={item.id}
                    href={`/library/tmdb-movie-${item.id}`}
                    className="flex-shrink-0 w-36 bg-[#131313] border border-[#262626] rounded-xl p-2.5 hover:border-[#3a3939] transition-colors"
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1c1b1b] mb-2 shadow relative">
                      {item.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w185${item.poster_path}`} alt={item.title} className="object-cover w-full h-full" />
                      ) : (
                        <span className="material-symbols-outlined text-lg absolute inset-0 m-auto text-[#262626]">movie</span>
                      )}
                      {state === "here" && (
                        <span className="absolute top-1.5 right-1.5 bg-[#10B981]/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">Available</span>
                      )}
                      {state === "wanted" && (
                        <span className="absolute top-1.5 right-1.5 bg-[#F59E0B]/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">Requested</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-white truncate" title={item.title}>{item.title}</div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* E. UPCOMING MOVIES */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-500 text-lg">schedule</span>
              Upcoming Movies
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {upcomingMovies.slice(0, 15).map((item) => {
                const state = getResultState(item.id, "movie");
                return (
                  <Link
                    key={item.id}
                    href={`/library/tmdb-movie-${item.id}`}
                    className="flex-shrink-0 w-36 bg-[#131313] border border-[#262626] rounded-xl p-2.5 hover:border-[#3a3939] transition-colors"
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1c1b1b] mb-2 shadow relative">
                      {item.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w185${item.poster_path}`} alt={item.title} className="object-cover w-full h-full" />
                      ) : (
                        <span className="material-symbols-outlined text-lg absolute inset-0 m-auto text-[#262626]">movie</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-white truncate" title={item.title}>{item.title}</div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* F. POPULAR TV SERIES */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-lg">tv</span>
              Popular TV Series
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {popularSeries.slice(0, 15).map((item) => {
                const state = getResultState(item.id, "series");
                return (
                  <Link
                    key={item.id}
                    href={`/library/tmdb-series-${item.id}`}
                    className="flex-shrink-0 w-36 bg-[#131313] border border-[#262626] rounded-xl p-2.5 hover:border-[#3a3939] transition-colors"
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1c1b1b] mb-2 shadow relative">
                      {item.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w185${item.poster_path}`} alt={item.name} className="object-cover w-full h-full" />
                      ) : (
                        <span className="material-symbols-outlined text-lg absolute inset-0 m-auto text-[#262626]">movie</span>
                      )}
                      {state === "here" && (
                        <span className="absolute top-1.5 right-1.5 bg-[#10B981]/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">Available</span>
                      )}
                      {state === "wanted" && (
                        <span className="absolute top-1.5 right-1.5 bg-[#F59E0B]/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">Requested</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-white truncate" title={item.name}>{item.name}</div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* G. UPCOMING SERIES */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-lg">live_tv</span>
              Upcoming & Airing Series
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {upcomingSeries.slice(0, 15).map((item) => {
                const state = getResultState(item.id, "series");
                return (
                  <Link
                    key={item.id}
                    href={`/library/tmdb-series-${item.id}`}
                    className="flex-shrink-0 w-36 bg-[#131313] border border-[#262626] rounded-xl p-2.5 hover:border-[#3a3939] transition-colors"
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1c1b1b] mb-2 shadow relative">
                      {item.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w185${item.poster_path}`} alt={item.name} className="object-cover w-full h-full" />
                      ) : (
                        <span className="material-symbols-outlined text-lg absolute inset-0 m-auto text-[#262626]">movie</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-white truncate" title={item.name}>{item.name}</div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* H. MOVIE & SERIES GENRES (Grid rows) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Movie Genres */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white">Movie Genres</h3>
              <div className="grid grid-cols-3 gap-2">
                {movieGenres.slice(0, 9).map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/?genreId=${genre.id}&genreName=${encodeURIComponent(genre.name)}&tab=movie`}
                    className="p-3 bg-[#131313] border border-[#262626] rounded-xl text-center text-xs font-semibold text-white hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-colors"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Series Genres */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white">Series Genres</h3>
              <div className="grid grid-cols-3 gap-2">
                {tvGenres.slice(0, 9).map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/?genreId=${genre.id}&genreName=${encodeURIComponent(genre.name)}&tab=series`}
                    className="p-3 bg-[#131313] border border-[#262626] rounded-xl text-center text-xs font-semibold text-white hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-colors"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* I. STUDIOS & NETWORKS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Studios */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white">Studios</h3>
              <div className="grid grid-cols-4 gap-2">
                {POPULAR_STUDIOS.map((studio) => (
                  <Link
                    key={studio.id}
                    href={`/?studioId=${studio.id}&studioName=${encodeURIComponent(studio.name)}`}
                    className="p-4 bg-[#131313] border border-[#262626] rounded-xl text-center hover:border-[#3b82f6] transition-colors"
                  >
                    <div className="text-2xl mb-1">{studio.logo}</div>
                    <div className="text-[10px] font-bold text-[#8C909F] uppercase">{studio.name}</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Networks */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white">Networks</h3>
              <div className="grid grid-cols-4 gap-2">
                {POPULAR_NETWORKS.map((network) => (
                  <Link
                    key={network.id}
                    href={`/?networkId=${network.id}&networkName=${encodeURIComponent(network.name)}`}
                    className="p-4 bg-[#131313] border border-[#262626] rounded-xl text-center hover:border-[#3b82f6] transition-colors"
                  >
                    <div className="text-2xl mb-1">{network.logo}</div>
                    <div className="text-[10px] font-bold text-[#8C909F] uppercase">{network.name}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
