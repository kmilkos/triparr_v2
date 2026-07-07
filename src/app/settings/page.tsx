import { getSetting } from "@/server/settings";
import { seedDefaultLibraries } from "@/server/metadata/scanner";
import { checkAuth } from "@/server/auth";
import { db } from "@/server/db";
import { libraries } from "@/server/db/schema";
import { FolderBrowserInput } from "../components/FolderBrowserInput";
import {
  handleSaveSettings,
  handleAddLibrary,
  handleDeleteLibrary,
  handleScan,
  handleSaveFilters
} from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ scan_success?: string; movies?: string; episodes?: string; success?: string; error?: string }>;
}) {
  await checkAuth();
  const params = await searchParams;

  // Ensure default libraries are seeded if empty
  await seedDefaultLibraries();

  // Retrieve tokens settings
  const tmdbToken = (await getSetting<string>("tmdb_api_token")) || "";
  const prowlarrUrl = (await getSetting<string>("prowlarr_url")) || "";
  const prowlarrApiKey = (await getSetting<string>("prowlarr_api_key")) || "";
  const debridToken = (await getSetting<string>("real_debrid_token")) || "";

  // Retrieve existing filters
  const filters = (await getSetting<{
    allowedResolutions?: string[];
    maxMovieSizeGb?: number;
    maxEpisodeSizeGb?: number;
    minSeeders?: number;
    excludedKeywords?: string[];
  }>("release_filters")) || {};

  const allowedResolutions = filters.allowedResolutions || ["2160p", "1080p", "720p"];
  const maxMovieSizeGb = filters.maxMovieSizeGb !== undefined ? filters.maxMovieSizeGb : 30;
  const maxEpisodeSizeGb = filters.maxEpisodeSizeGb !== undefined ? filters.maxEpisodeSizeGb : 10;
  const minSeeders = filters.minSeeders !== undefined ? filters.minSeeders : 5;
  const excludedKeywords = filters.excludedKeywords ? filters.excludedKeywords.join(", ") : "3d, cam, ts, tc, scr, korsub, bdrip";

  // Retrieve current media libraries list
  const currentLibraries = await db.select().from(libraries).all();


  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Configuration Settings</h2>
        <p className="text-sm text-[#C2C6D6]">Manage developer tokens, API connections, and media libraries.</p>
      </div>

      {params.success && (
        <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/30 text-white rounded-lg flex items-center gap-3">
          <span className="material-symbols-outlined text-[#10B981]">check_circle</span>
          <div className="text-sm font-semibold">{params.success}</div>
        </div>
      )}

      {params.error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-white rounded-lg flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500">error</span>
          <div className="text-sm font-semibold">{params.error}</div>
        </div>
      )}

      {params.scan_success && (
        <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/30 text-white rounded-lg flex items-center gap-3">
          <span className="material-symbols-outlined text-[#10B981]">check_circle</span>
          <div className="text-sm">
            <span className="font-bold">Library scan finished!</span> Scanned: {params.movies || 0} movies and {params.episodes || 0} episodes.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings and Library configuration */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main provider tokens */}
          <form action={handleSaveSettings} className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-[#262626]">
              API Settings & Tokens
            </h3>

            {/* TMDB Section */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#8C909F] uppercase">
                TMDB API Read Access Token
              </label>
              <input
                type="password"
                name="tmdb_api_token"
                defaultValue={tmdbToken}
                placeholder="eyJhbGciOi..."
                className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm font-mono focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
            </div>

            {/* Prowlarr Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#8C909F] uppercase">
                  Prowlarr URL
                </label>
                <input
                  type="text"
                  name="prowlarr_url"
                  defaultValue={prowlarrUrl}
                  placeholder="http://localhost:9696/0/api"
                  className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm font-mono focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#8C909F] uppercase">
                  Prowlarr API Key
                </label>
                <input
                  type="password"
                  name="prowlarr_api_key"
                  defaultValue={prowlarrApiKey}
                  placeholder="api_key"
                  className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm font-mono focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </div>
            </div>

            {/* Real-Debrid Section */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#8C909F] uppercase">
                Real-Debrid API Token
              </label>
              <input
                type="password"
                name="real_debrid_token"
                defaultValue={debridToken}
                placeholder="RD_API_TOKEN"
                className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm font-mono focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="py-2 px-6 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm rounded shadow transition-colors"
              >
                Save API Settings
              </button>
            </div>
          </form>

          {/* Release & Download Filters */}
          <form action={handleSaveFilters} className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-[#262626]">
              Release & Download Filters
            </h3>

            {/* Allowed Resolutions */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#8C909F] uppercase">
                Allowed Resolutions
              </label>
              <div className="flex flex-wrap gap-4 text-sm text-white">
                {["2160p", "1080p", "720p", "480p"].map((res) => (
                  <label key={res} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="resolutions"
                      value={res}
                      defaultChecked={allowedResolutions.includes(res)}
                      className="rounded border-[#262626] bg-[#0F0F0F] text-[#3B82F6] focus:ring-0 focus:ring-offset-0"
                    />
                    <span>{res}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Max Sizes & Min Seeders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#8C909F] uppercase">
                  Max Movie Size (GB)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="max_movie_size_gb"
                  defaultValue={maxMovieSizeGb}
                  className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#8C909F] uppercase">
                  Max TV Episode Size (GB)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="max_episode_size_gb"
                  defaultValue={maxEpisodeSizeGb}
                  className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#8C909F] uppercase">
                  Min Seeders
                </label>
                <input
                  type="number"
                  name="min_seeders"
                  defaultValue={minSeeders}
                  className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </div>
            </div>

            {/* Excluded Keywords */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#8C909F] uppercase">
                Excluded Keywords (comma-separated)
              </label>
              <input
                type="text"
                name="excluded_keywords"
                defaultValue={excludedKeywords}
                placeholder="e.g. 3d, cam, ts, tc, scr, korsub"
                className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
              <p className="text-[10px] text-[#8C909F]">Releases matching any of these keywords will be filtered out.</p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="py-2 px-6 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm rounded shadow transition-colors"
              >
                Save Filter Settings
              </button>
            </div>
          </form>

          {/* Multiple Media Libraries Manager */}
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-[#262626]">
              Dynamic Media Libraries
            </h3>

            {/* Existing Libraries List */}
            <div className="space-y-3">
              {currentLibraries.map((lib) => (
                <div key={lib.id} className="flex items-center justify-between gap-4 p-3 bg-[#131313] border border-[#262626] rounded-lg">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{lib.name}</span>
                      <span className="px-1.5 py-0.5 bg-[#262626] text-[#8C909F] text-[9px] font-bold rounded uppercase tracking-wider">
                        {lib.type === "movie" ? "Movies" : lib.type === "series" ? "TV Series" : "Own Videos"}
                      </span>
                    </div>
                    <div className="text-xs text-[#8C909F] font-mono truncate" title={lib.path}>
                      {lib.path}
                    </div>
                  </div>
                  <form action={handleDeleteLibrary}>
                    <input type="hidden" name="libraryId" value={lib.id} />
                    <button
                      type="submit"
                      className="p-1.5 text-[#8C909F] hover:text-red-500 rounded hover:bg-[#1C1B1B] transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </form>
                </div>
              ))}
            </div>

            {/* Add New Library Form */}
            <form action={handleAddLibrary} className="bg-[#131313] border border-[#262626] rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold text-[#8C909F] uppercase tracking-wider">Add Custom Library</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-[#8C909F] uppercase">Library Name</label>
                  <input
                    type="text"
                    name="name"
                    placeholder="e.g. Kids Movies"
                    className="w-full px-3 py-1.5 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-[#8C909F] uppercase">Folder Path</label>
                  <FolderBrowserInput
                    name="path"
                    placeholder="e.g. /opt/triparr/data/Libraries/KidsMovies"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-[#8C909F] uppercase">Content Type</label>
                  <select
                    name="type"
                    className="bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm px-3 py-1.5 focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="movie">Movies</option>
                    <option value="series">TV Series</option>
                    <option value="video">Own Videos</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="py-1.5 px-4 bg-[#262626] hover:bg-[#323232] border border-[#3A3939] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors self-end"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Create Library
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Scan Actions Sidebar */}
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-xs">
              Library Maintenance
            </h3>
            <p className="text-xs text-[#8C909F] leading-relaxed">
              Trigger a manual sync scan to crawl all dynamic media libraries, execute structural checks, parse new files, and automatically sync details with the catalog.
            </p>
            <form action={handleScan}>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#262626] hover:bg-[#323232] border border-[#3a3939] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">sync</span>
                Scan All Libraries
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
