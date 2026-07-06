import { db } from "../db";
import { requests, mediaItems, libraries } from "../db/schema";
import { eq, notInArray, and } from "drizzle-orm";
import { getSetting, setSetting } from "../settings";
import * as fs from "fs";
import * as path from "path";
import { scanLibrary, seedDefaultLibraries } from "../metadata/scanner";

// Set up fallback folders if not configured
async function initializeWorkerFolders() {
  await seedDefaultLibraries();
  console.log("Worker default libraries seeded & verified.");
}

async function processActiveRequests() {
  const activeRequests = await db
    .select()
    .from(requests)
    .where(notInArray(requests.status, ["COMPLETED", "FAILED", "CANCELLED"]))
    .all();

  if (activeRequests.length === 0) return;

  console.log(`Worker: Processing ${activeRequests.length} active request(s)...`);

  for (const req of activeRequests) {
    try {
      const item = await db.select().from(mediaItems).where(eq(mediaItems.id, req.mediaItemId)).get();
      if (!item) continue;

      if (req.status === "REQUESTED") {
        console.log(`Request ${req.id}: Searching indexers...`);
        await db.update(requests)
          .set({ status: "SEARCHING", updatedAt: new Date().toISOString() })
          .where(eq(requests.id, req.id))
          .run();
      } else if (req.status === "SEARCHING") {
        console.log(`Request ${req.id}: Release candidates found, submitting to Debrid...`);
        await db.update(requests)
          .set({
            status: "DOWNLOADING",
            releaseTitle: `${item.title} ${item.releaseDate ? `(${item.releaseDate.split("-")[0]})` : ""} 1080p Web-DL HEVC x265`,
            releaseSize: 1024 * 1024 * 1400, // 1.4 GB
            progress: 5,
            speed: 1024 * 1024 * 12, // 12 MB/s
            eta: 120,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(requests.id, req.id))
          .run();
      } else if (req.status === "DOWNLOADING") {
        const nextProgress = Math.min((req.progress || 0) + Math.floor(Math.random() * 20) + 10, 100);
        if (nextProgress < 100) {
          console.log(`Request ${req.id}: Downloading (${nextProgress}%)...`);
          await db.update(requests)
            .set({
              progress: nextProgress,
              eta: Math.max(0, req.eta ? req.eta - 10 : 0),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(requests.id, req.id))
            .run();
        } else {
          console.log(`Request ${req.id}: Download finished. Organizing files...`);
          await db.update(requests)
            .set({ status: "ORGANIZING", progress: 100, updatedAt: new Date().toISOString() })
            .where(eq(requests.id, req.id))
            .run();
        }
      } else if (req.status === "ORGANIZING") {
        // Resolve target library folder dynamically
        let targetFolder = "";
        
        if (req.libraryId) {
          const lib = await db.select().from(libraries).where(eq(libraries.id, req.libraryId)).get();
          if (lib) {
            targetFolder = lib.path;
          }
        }
        
        if (!targetFolder) {
          // Fallback to defaults
          const defaults = await seedDefaultLibraries();
          const matched = defaults.find((l) => l.type === item.type);
          targetFolder = matched?.path || path.resolve(`./data/Libraries/${item.type === "movie" ? "Movies" : "TVSeries"}`);
        }

        let destFile = "";
        const cleanTitleName = item.title.replace(/[^a-zA-Z0-9 ]/g, "");
        const yearSuffix = item.releaseDate ? ` (${item.releaseDate.split("-")[0]})` : "";

        if (item.type === "movie") {
          const itemDir = path.join(targetFolder, `${cleanTitleName}${yearSuffix}`);
          if (!fs.existsSync(itemDir)) fs.mkdirSync(itemDir, { recursive: true });
          destFile = path.join(itemDir, `${cleanTitleName}${yearSuffix}.mkv`);
          fs.writeFileSync(destFile, "dummy movie file data");
        } else {
          const itemDir = path.join(targetFolder, cleanTitleName, "Season 01");
          if (!fs.existsSync(itemDir)) fs.mkdirSync(itemDir, { recursive: true });
          destFile = path.join(itemDir, `${cleanTitleName} - S01E01 - Episode 1.mkv`);
          fs.writeFileSync(destFile, "dummy tv series episode file data");
        }

        console.log(`Request ${req.id}: File written to ${destFile}. Running scanner...`);
        
        await scanLibrary();

        await db.update(requests)
          .set({ status: "COMPLETED", updatedAt: new Date().toISOString() })
          .where(eq(requests.id, req.id))
          .run();

        console.log(`Request ${req.id}: Processing complete!`);
      }
    } catch (err) {
      console.error(`Error processing request ${req.id}:`, err);
    }
  }
}

async function startWorker() {
  await initializeWorkerFolders();
  console.log("Worker started. Running loop every 5 seconds...");
  
  setInterval(async () => {
    try {
      await processActiveRequests();
    } catch (err) {
      console.error("Error in worker loop:", err);
    }
  }, 5000);
}

if (require.main === module) {
  startWorker().catch((err) => {
    console.error("Worker process error:", err);
    process.exit(1);
  });
}

export { startWorker, processActiveRequests };
