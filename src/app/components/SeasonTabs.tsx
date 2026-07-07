"use client";

import React, { useState } from "react";

interface Episode {
  id: string;
  episodeNumber: number;
  title: string;
  overview?: string;
  file?: {
    videoResolution?: string;
    size: number;
    container?: string;
    videoCodec?: string;
  } | null;
}

interface Season {
  id: string;
  title: string;
  episodes: Episode[];
}

interface SeasonTabsProps {
  seasons: Season[];
}

export function SeasonTabs({ seasons }: SeasonTabsProps) {
  const [activeSeasonId, setActiveSeasonId] = useState(seasons[0]?.id || "");

  const activeSeason = seasons.find((s) => s.id === activeSeasonId) || seasons[0];

  if (!seasons.length) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-[#262626]">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-[#8C909F] uppercase tracking-wider">Seasons & Episodes</h3>
        <span className="text-[10px] font-mono text-[#8C909F] bg-[#131313] px-2 py-0.5 border border-[#262626] rounded">
          {activeSeason?.episodes.length || 0} Episodes
        </span>
      </div>

      {/* Tabs Header */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#262626] pb-2">
        {seasons.map((season) => (
          <button
            key={season.id}
            type="button"
            onClick={() => setActiveSeasonId(season.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSeasonId === season.id
                ? "bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/15"
                : "bg-[#131313] border border-[#262626] text-[#8C909F] hover:text-white hover:border-[#3A3939]"
            }`}
          >
            {season.title}
          </button>
        ))}
      </div>

      {/* Tab Content (Episodes List) */}
      {activeSeason && (
        <div className="bg-[#131313] border border-[#262626] rounded-xl overflow-hidden divide-y divide-[#262626]">
          {activeSeason.episodes.map((ep) => (
            <div key={ep.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-[#1C1B1B]/10 transition-colors">
              <div className="space-y-1">
                <div className="text-xs font-bold text-white">
                  Episode {ep.episodeNumber}: {ep.title}
                </div>
                {ep.overview && (
                  <p className="text-[11px] text-[#8C909F] leading-relaxed max-w-2xl">
                    {ep.overview}
                  </p>
                )}
              </div>

              {/* Episode File Details */}
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
      )}
    </div>
  );
}
