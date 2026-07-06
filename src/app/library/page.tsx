import { getLibraryItems } from "@/server/requests";
import Link from "next/link";
import { checkAuth } from "@/server/auth";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: "all" | "here" | "wanted" | "info"; q?: string }>;
}) {
  await checkAuth();
  const { filter = "all", q = "" } = await searchParams;

  const items = await getLibraryItems(filter, q);

  // Tab count indicators
  const allItems = await getLibraryItems("all", q);
  const countAll = allItems.length;
  const countHere = allItems.filter((i) => i.state === "here").length;
  const countWanted = allItems.filter((i) => i.state === "wanted").length;
  const countInfo = allItems.filter((i) => i.state === "info").length;

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Local Library</h2>
          <p className="text-sm text-[#C2C6D6]">Browse and filter your downloaded media catalog.</p>
        </div>
        <Link
          href="/"
          className="self-start sm:self-center py-2 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Request Media
        </Link>
      </div>

      {/* Filters and search block */}
      <div className="flex flex-col md:flex-row gap-4 justify-between border-b border-[#262626] pb-4">
        {/* State Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/library?filter=all&q=${q}`}
            className={`px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors border ${
              filter === "all"
                ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                : "bg-[#131313] border-[#262626] text-[#8C909F] hover:text-white"
            }`}
          >
            All ({countAll})
          </Link>
          <Link
            href={`/library?filter=here&q=${q}`}
            className={`px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors border ${
              filter === "here"
                ? "bg-[#10B981] border-[#10B981] text-white"
                : "bg-[#131313] border-[#262626] text-[#8C909F] hover:text-white"
            }`}
          >
            Available ({countHere})
          </Link>
          <Link
            href={`/library?filter=wanted&q=${q}`}
            className={`px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors border ${
              filter === "wanted"
                ? "bg-[#F59E0B] border-[#F59E0B] text-white"
                : "bg-[#131313] border-[#262626] text-[#8C909F] hover:text-white"
            }`}
          >
            Requested ({countWanted})
          </Link>
          <Link
            href={`/library?filter=info&q=${q}`}
            className={`px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors border ${
              filter === "info"
                ? "bg-[#262626] border-[#3a3939] text-white"
                : "bg-[#131313] border-[#262626] text-[#8C909F] hover:text-white"
            }`}
          >
            Library Info ({countInfo})
          </Link>
        </div>

        {/* Search Input */}
        <form method="GET" action="/library" className="relative w-full md:w-80">
          <input type="hidden" name="filter" value={filter} />
          <span className="material-symbols-outlined absolute left-3 top-2 text-[#8C909F] text-lg">search</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search local library..."
            className="w-full pl-10 pr-4 py-1.5 bg-[#131313] border border-[#262626] rounded text-white text-xs focus:outline-none focus:border-[#3B82F6]"
          />
        </form>
      </div>

      {/* Grid listing */}
      {items.length === 0 ? (
        <div className="p-16 text-center bg-[#131313] border border-[#262626] rounded-xl text-[#8C909F]">
          <span className="material-symbols-outlined text-4xl mb-2 text-[#262626]">folder</span>
          <p className="text-sm">No items found in this section.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {items.map((item) => {
            const releaseYear = (item.releaseDate || "").split("-")[0];
            const posterUrl = item.posterPath
              ? `https://image.tmdb.org/t/p/w342${item.posterPath}`
              : null;

            return (
              <Link
                key={item.id}
                href={`/library/${item.id}`}
                className="flex flex-col bg-[#131313] border border-[#262626] rounded-xl p-3 hover:border-[#3a3939] transition-colors group"
              >
                {/* Poster */}
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#1c1b1b] mb-3 shadow-md">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={item.title}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 text-xs text-[#8C909F]">
                      <span className="material-symbols-outlined text-3xl mb-1 text-[#262626]">movie</span>
                      {item.title}
                    </div>
                  )}

                  {/* Badges */}
                  {item.state === "here" && (
                    <span className="absolute top-2 right-2 bg-[#10B981]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full glow-green">
                      Available
                    </span>
                  )}
                  {item.state === "wanted" && (
                    <span className="absolute top-2 right-2 bg-[#F59E0B]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full glow-amber">
                      {item.activeRequest?.status === "DOWNLOADING"
                        ? `Downloading ${item.activeRequest.progress || 0}%`
                        : "Requested"}
                    </span>
                  )}
                  {item.state === "info" && (
                    <span className="absolute top-2 right-2 bg-[#262626]/90 text-[#8C909F] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#3a3939]">
                      Info Only
                    </span>
                  )}
                </div>

                {/* Info details */}
                <h4 className="font-semibold text-sm text-white truncate group-hover:text-[#3B82F6] transition-colors" title={item.title}>
                  {item.title}
                </h4>
                <div className="flex items-center justify-between text-xs text-[#8C909F] mt-1 font-mono">
                  <span>{releaseYear || "N/A"}</span>
                  <span className="capitalize">{item.type === "movie" ? "Movie" : "TV"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
