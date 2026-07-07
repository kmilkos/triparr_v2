"use client";

import React, { useState, useEffect } from "react";
import { listDirectories } from "../settings/actions";

interface FolderBrowserInputProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}

export function FolderBrowserInput({
  name,
  defaultValue = "",
  placeholder = "e.g. /opt/triparr/data/Libraries/Movies",
}: FolderBrowserInputProps) {
  const [pathValue, setPathValue] = useState(defaultValue);
  const [showModal, setShowModal] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPath = async (target: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await listDirectories(target);
      if (res.success) {
        setCurrentPath(res.currentPath);
        setDirs(res.dirs);
        setParentPath(res.parentPath);
      } else {
        setError(res.error || "Failed to load directory.");
        // If error, still set current path so we see where we are
        setCurrentPath(res.currentPath);
        setDirs([]);
        setParentPath(null);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBrowser = () => {
    setShowModal(true);
    // Use value in input if it exists, otherwise default to current working directory
    loadPath(pathValue || ".");
  };

  const handleNavigate = (subDir: string) => {
    const separator = currentPath.endsWith("/") ? "" : "/";
    loadPath(`${currentPath}${separator}${subDir}`);
  };

  const handleGoUp = () => {
    if (parentPath) {
      loadPath(parentPath);
    }
  };

  const handleSelect = () => {
    setPathValue(currentPath);
    setShowModal(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="text"
          name={name}
          value={pathValue}
          onChange={(e) => setPathValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
          required
        />
        <button
          type="button"
          onClick={handleOpenBrowser}
          className="px-3 py-1.5 bg-[#262626] hover:bg-[#323232] border border-[#3A3939] text-white text-xs font-semibold rounded flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">folder_open</span>
          Browse
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#131313] border border-[#262626] w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-[#262626] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3B82F6]">folder_open</span>
                Browse Directory
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[#8C909F] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Path Navigation Bar */}
            <div className="bg-[#0F0F0F] px-4 py-3 border-b border-[#262626] flex items-center gap-2">
              <button
                type="button"
                onClick={handleGoUp}
                disabled={!parentPath}
                className="p-1 rounded bg-[#262626] hover:bg-[#323232] text-white disabled:opacity-40 disabled:hover:bg-[#262626] transition-colors"
                title="Go Up"
              >
                <span className="material-symbols-outlined text-sm">arrow_upward</span>
              </button>
              <input
                type="text"
                value={currentPath}
                onChange={(e) => loadPath(e.target.value)}
                className="flex-1 bg-[#131313] border border-[#262626] rounded text-white text-xs px-2 py-1 font-mono focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            {/* Directory List Container */}
            <div className="flex-1 overflow-y-auto p-4 min-h-[250px]">
              {loading ? (
                <div className="h-full flex items-center justify-center text-[#8C909F] text-xs">
                  <span className="animate-spin material-symbols-outlined mr-2">sync</span>
                  Loading folders...
                </div>
              ) : error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{error}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadPath("/")}
                    className="self-start px-3 py-1 bg-[#262626] hover:bg-[#323232] text-white text-[10px] rounded transition-colors"
                  >
                    Go to System Root (/)
                  </button>
                </div>
              ) : dirs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#8C909F] text-xs py-8">
                  <span className="material-symbols-outlined text-3xl text-[#262626] mb-2">folder_off</span>
                  No subdirectories found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dirs.map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => handleNavigate(dir)}
                      className="flex items-center gap-3 p-2.5 bg-[#1C1B1B]/40 hover:bg-[#1C1B1B] border border-[#262626]/50 rounded-lg text-left text-xs text-white transition-all group hover:border-[#3B82F6]/50"
                    >
                      <span className="material-symbols-outlined text-[#8C909F] group-hover:text-[#3B82F6] transition-colors">
                        folder
                      </span>
                      <span className="truncate flex-1 font-mono">{dir}</span>
                      <span className="material-symbols-outlined text-[14px] text-[#8C909F] opacity-0 group-hover:opacity-100 transition-opacity">
                        arrow_forward_ios
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#262626] flex justify-between bg-[#0F0F0F]">
              <button
                type="button"
                onClick={() => loadPath("/")}
                className="px-3 py-1.5 bg-[#262626] hover:bg-[#323232] text-white text-xs font-semibold rounded-lg transition-colors"
              >
                System Root
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 bg-[#262626] hover:bg-[#323232] border border-[#3A3939] text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSelect}
                  disabled={loading}
                  className="px-4 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Select Folder
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
