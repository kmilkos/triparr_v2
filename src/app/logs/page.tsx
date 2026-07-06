import { checkAuth } from "@/server/auth";
import { redirect } from "next/navigation";
import * as fs from "fs";
import * as path from "path";

const LOG_FILE_PATH = path.resolve("./data/triparr.log");

async function handleClearLogs() {
  "use server";
  await checkAuth();
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      fs.writeFileSync(LOG_FILE_PATH, `[${new Date().toISOString()}] [INFO] Log cleared.\n`, "utf8");
    }
  } catch (err) {
    console.error("Failed to clear log file:", err);
  }
  redirect("/logs?success=Logs cleared");
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  await checkAuth();
  const params = await searchParams;

  let logContent = "No logs found. Start requesting media to populate logs!";
  
  if (fs.existsSync(LOG_FILE_PATH)) {
    try {
      const fullContent = fs.readFileSync(LOG_FILE_PATH, "utf8");
      const lines = fullContent.trim().split("\n");
      // Grab last 300 lines for the log console
      logContent = lines.slice(-300).reverse().join("\n");
    } catch (err: any) {
      logContent = `Error reading log file: ${err.message}`;
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">System Logs</h2>
          <p className="text-sm text-[#C2C6D6]">Monitor background downloader activity, indexer searches, and Real-Debrid sync logs.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <form>
            <button
              type="submit"
              className="py-2 px-4 bg-[#262626] hover:bg-[#323232] border border-[#3a3939] text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh Logs
            </button>
          </form>

          <form action={handleClearLogs}>
            <button
              type="submit"
              className="py-2 px-4 bg-red-950/40 hover:bg-red-900/40 border border-red-500/30 text-red-300 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Clear Logs
            </button>
          </form>
        </div>
      </div>

      {params.success && (
        <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/30 text-white rounded-lg flex items-center gap-3 max-w-md">
          <span className="material-symbols-outlined text-[#10B981]">check_circle</span>
          <div className="text-sm font-semibold">{params.success}</div>
        </div>
      )}

      {/* Terminal log panel */}
      <div className="glass-card rounded-xl border border-[#262626] overflow-hidden flex flex-col h-[650px] shadow-2xl">
        {/* Terminal Header */}
        <div className="bg-[#131313] border-b border-[#262626] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/70 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500/70 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-green-500/70 inline-block"></span>
            <span className="text-xs font-mono text-[#8C909F] ml-2">triparr.log — Console Output</span>
          </div>
          <span className="text-[10px] font-mono text-[#8C909F] bg-[#1C1B1B] px-2 py-0.5 rounded border border-[#262626]">
            Showing last 300 entries (latest first)
          </span>
        </div>

        {/* Console view */}
        <div className="flex-1 p-6 bg-[#070708] overflow-y-auto font-mono text-xs leading-relaxed text-[#D2D2D2] select-text">
          <pre className="whitespace-pre-wrap break-all select-text selection:bg-[#3B82F6] selection:text-white">
            {logContent}
          </pre>
        </div>
      </div>
    </div>
  );
}
