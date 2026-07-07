import { logger } from "../logger";
import * as http from "http";
import * as https from "https";
import { db } from "../db";
import { requests, mediaItems, libraries } from "../db/schema";
import { eq, notInArray } from "drizzle-orm";
import { getSetting } from "../settings";
import * as fs from "fs";
import * as path from "path";
import { scanLibrary, seedDefaultLibraries } from "../metadata/scanner";
import { searchProwlarr } from "../requests/prowlarr";
import {
  addTorrentOrMagnetToDebrid,
  selectDebridFiles,
  getDebridTorrentStatus,
  unrestrictLink
} from "../requests/debrid";
import { Readable } from "stream";
import { finished } from "stream/promises";

const failedReleaseTitles = new Set<string>();

// Helper to download a file from a URL using streaming (native http/https to bypass Next.js fetch)
function downloadFile(url: string, destPath: string): Promise<void> {
  const tmpPath = destPath + ".tmp";
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`Failed to download file: Status Code ${res.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(tmpPath);
      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        try {
          fs.renameSync(tmpPath, destPath);
          resolve();
        } catch (renameErr) {
          reject(renameErr);
        }
      });

      fileStream.on("error", (err) => {
        fs.unlink(tmpPath, () => {}); // Clean up temp file on error
        reject(err);
      });
    });

    req.on("error", (err) => {
      fs.unlink(tmpPath, () => {});
      reject(err);
    });
  });
}

// Set up fallback folders if not configured
async function initializeWorkerFolders() {
  await seedDefaultLibraries();
  logger.info("Worker default libraries seeded & verified.");
}

async function processActiveRequests() {
  const activeRequests = await db
    .select()
    .from(requests)
    .where(notInArray(requests.status, ["COMPLETED", "FAILED", "CANCELLED"]))
    .all();

  if (activeRequests.length === 0) return;

  const prowlarrUrl = await getSetting<string>("prowlarr_url");
  const debridToken = await getSetting<string>("real_debrid_token");
  const isMockMode = !prowlarrUrl || !debridToken;

  if (isMockMode) {
    logger.info(`Worker [MOCK MODE]: Processing ${activeRequests.length} active request(s)...`);
  } else {
    logger.info(`Worker [LIVE MODE]: Processing ${activeRequests.length} active request(s)...`);
  }

  for (const req of activeRequests) {
    try {
      const item = await db.select().from(mediaItems).where(eq(mediaItems.id, req.mediaItemId)).get();
      if (!item) continue;

      // --- MOCK MODE FLOW ---
      if (isMockMode) {
        if (req.status === "REQUESTED") {
          logger.info(`Request ${req.id} (Mock): Searching indexers...`);
          await db.update(requests)
            .set({ status: "SEARCHING", updatedAt: new Date().toISOString() })
            .where(eq(requests.id, req.id))
            .run();
        } else if (req.status === "SEARCHING") {
          logger.info(`Request ${req.id} (Mock): Release candidates found, submitting to Debrid...`);
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
            logger.info(`Request ${req.id} (Mock): Downloading (${nextProgress}%)...`);
            await db.update(requests)
              .set({
                progress: nextProgress,
                eta: Math.max(0, req.eta ? req.eta - 10 : 0),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(requests.id, req.id))
              .run();
          } else {
            logger.info(`Request ${req.id} (Mock): Download finished. Organizing files...`);
            await db.update(requests)
              .set({ status: "ORGANIZING", progress: 100, updatedAt: new Date().toISOString() })
              .where(eq(requests.id, req.id))
              .run();
          }
        } else if (req.status === "ORGANIZING") {
          let targetFolder = "";
          if (req.libraryId) {
            const lib = await db.select().from(libraries).where(eq(libraries.id, req.libraryId)).get();
            if (lib) targetFolder = lib.path;
          }
          if (!targetFolder) {
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

          logger.info(`Request ${req.id} (Mock): File written to ${destFile}. Running scanner...`);
          await scanLibrary();
          await db.update(requests)
            .set({ status: "COMPLETED", updatedAt: new Date().toISOString() })
            .where(eq(requests.id, req.id))
            .run();
        }
        continue;
      }

      // --- LIVE REAL-DEBRID & PROWLARR FLOW ---
      if (req.status === "REQUESTED") {
        logger.info(`Request ${req.id}: Querying Prowlarr indexers for "${item.title}"...`);
        const queryStr = item.type === "movie" 
          ? `${item.title} ${item.releaseDate ? item.releaseDate.split("-")[0] : ""}`
          : item.title;

        let candidates = await searchProwlarr(queryStr, item.type);
        candidates = candidates.filter((c) => !failedReleaseTitles.has(c.title));

        const filters = await getSetting<{
          allowedResolutions?: string[];
          maxMovieSizeGb?: number;
          maxEpisodeSizeGb?: number;
          minSeeders?: number;
          excludedKeywords?: string[];
        }>("release_filters");

        if (filters) {
          const {
            allowedResolutions = [],
            maxMovieSizeGb = 0,
            maxEpisodeSizeGb = 0,
            minSeeders = 0,
            excludedKeywords = [],
          } = filters;

          const beforeCount = candidates.length;
          candidates = candidates.filter((candidate) => {
            const titleLower = candidate.title.toLowerCase();

            // 1. Excluded Keywords
            for (const kw of excludedKeywords) {
              if (titleLower.includes(kw)) {
                logger.info(`Request ${req.id} (Filters): Candidate "${candidate.title}" excluded because it matched keyword "${kw}"`);
                return false;
              }
            }

            // 2. Minimum Seeders
            if (minSeeders > 0 && candidate.seeders < minSeeders) {
              logger.info(`Request ${req.id} (Filters): Candidate "${candidate.title}" excluded because seeders (${candidate.seeders}) < minSeeders (${minSeeders})`);
              return false;
            }

            // 3. Maximum Size
            const sizeGb = candidate.size / (1024 * 1024 * 1024);
            const maxSize = item.type === "movie" ? maxMovieSizeGb : maxEpisodeSizeGb;
            if (maxSize > 0 && sizeGb > maxSize) {
              logger.info(`Request ${req.id} (Filters): Candidate "${candidate.title}" excluded because size (${sizeGb.toFixed(2)} GB) > maxSize (${maxSize} GB)`);
              return false;
            }

            // 4. Allowed Resolutions
            if (allowedResolutions.length > 0) {
              const resolutionPatterns: Record<string, string[]> = {
                "2160p": ["2160p", "2160", "4k", "uhd"],
                "1080p": ["1080p", "1080", "fhd"],
                "720p": ["720p", "720", "hd"],
                "480p": ["480p", "480", "sd"],
              };

              let matchesAnyAllowed = false;
              for (const allowedRes of allowedResolutions) {
                const patterns = resolutionPatterns[allowedRes] || [allowedRes];
                if (patterns.some((p) => titleLower.includes(p))) {
                  matchesAnyAllowed = true;
                  break;
                }
              }

              if (!matchesAnyAllowed) {
                logger.info(`Request ${req.id} (Filters): Candidate "${candidate.title}" excluded because it does not match allowed resolutions [${allowedResolutions.join(", ")}]`);
                return false;
              }
            }

            return true;
          });

          logger.info(`Request ${req.id} (Filters): Filtered out ${beforeCount - candidates.length} candidates out of ${beforeCount}.`);
        }

        if (candidates.length === 0) {
          const errMsg = "No torrent candidates found on Prowlarr indexers.";
          logger.warn(`Request ${req.id}: ${errMsg}`);
          await db.update(requests)
            .set({
              status: "FAILED",
              error: errMsg,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(requests.id, req.id))
            .run();
          continue;
        }

        // Try candidates one-by-one until one successfully submits to Real-Debrid
        let submitted = false;
        for (let i = 0; i < candidates.length; i++) {
          const candidate = candidates[i];
          
          // Introduce a short 500ms delay between candidate calls to prevent API rate limiting
          if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          logger.info(`Request ${req.id}: Candidate ${i + 1}/${candidates.length} - "${candidate.title}" (${(candidate.size / (1024 * 1024 * 1024)).toFixed(2)} GB). Submitting to Real-Debrid...`);
          try {
            const debridId = await addTorrentOrMagnetToDebrid(candidate.downloadUrl);
            await db.update(requests)
              .set({
                status: "SEARCHING",
                debridId,
                releaseTitle: candidate.title,
                releaseSize: candidate.size,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(requests.id, req.id))
              .run();
            submitted = true;
            logger.info(`Request ${req.id}: Successfully submitted candidate "${candidate.title}" to Real-Debrid.`);
            break;
          } catch (err: any) {
            const errStr = String(err.message || err);
            
            // Handle rate limiting (429) - pause and retry the same candidate
            if (errStr.includes("429") || errStr.includes("too_many_requests")) {
              logger.warn(`Request ${req.id}: Real-Debrid rate limit (429) hit. Pausing for 5 seconds before retrying candidate "${candidate.title}"...`);
              await new Promise((resolve) => setTimeout(resolve, 5000));
              i--; // Decrement index to retry the same candidate in the next loop iteration
              continue;
            }

            if (errStr.includes("451") || errStr.includes("infringing_file")) {
              logger.warn(`Request ${req.id}: Candidate "${candidate.title}" was rejected by Real-Debrid as infringing file (DMCA). Trying next candidate...`);
            } else {
              logger.error(`Request ${req.id}: Real-Debrid submission failed for "${candidate.title}":`, err);
              if (errStr.includes("401") || errStr.includes("403") || errStr.includes("token")) {
                throw err; // Propagate auth token errors to pause processing
              }
            }
          }
        }

        if (!submitted) {
          const errMsg = `All ${candidates.length} candidate releases were rejected or failed to submit to Real-Debrid.`;
          logger.error(`Request ${req.id}: ${errMsg}`);
          await db.update(requests)
            .set({
              status: "FAILED",
              error: errMsg,
              updatedAt: new Date().toISOString()
            })
            .where(eq(requests.id, req.id))
            .run();
        }

      } else if (req.status === "SEARCHING") {
        if (!req.debridId) {
          await db.update(requests)
            .set({ status: "FAILED", error: "Missing Real-Debrid ID in SEARCHING state." })
            .where(eq(requests.id, req.id))
            .run();
          continue;
        }

        logger.info(`Request ${req.id}: Selecting files on Real-Debrid for ID: ${req.debridId}...`);
        await selectDebridFiles(req.debridId);
        
        await db.update(requests)
          .set({
            status: "DOWNLOADING",
            progress: 0,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(requests.id, req.id))
          .run();

      } else if (req.status === "DOWNLOADING") {
        if (!req.debridId) {
          await db.update(requests)
            .set({ status: "FAILED", error: "Missing Real-Debrid ID in DOWNLOADING state." })
            .where(eq(requests.id, req.id))
            .run();
          continue;
        }

        const rdStatus = await getDebridTorrentStatus(req.debridId);
        
        if (rdStatus.status === "waiting_files_selection") {
          logger.info(`Request ${req.id}: Real-Debrid is waiting for file selection.`);
          await selectDebridFiles(req.debridId);
        } else if (rdStatus.status === "downloading") {
          logger.info(`Request ${req.id}: Real-Debrid downloading progress: ${rdStatus.progress}% (${(rdStatus.speed / (1024 * 1024)).toFixed(2)} MB/s)`);
          await db.update(requests)
            .set({
              progress: rdStatus.progress,
              speed: rdStatus.speed,
              eta: rdStatus.eta,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(requests.id, req.id))
            .run();
        } else if (rdStatus.status === "downloaded") {
          logger.info(`Request ${req.id}: Real-Debrid download complete! Restricting links...`);
          
          await db.update(requests)
            .set({
              status: "ORGANIZING",
              progress: 100,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(requests.id, req.id))
            .run();

          // Move download operation to background execution to avoid blocking the main worker loop
          const links = rdStatus.downloadLinks;
          const targetLibId = req.libraryId;

          (async () => {
            try {
              let targetFolder = "";
              if (targetLibId) {
                const lib = await db.select().from(libraries).where(eq(libraries.id, targetLibId)).get();
                if (lib) targetFolder = lib.path;
              }
              if (!targetFolder) {
                const defaults = await seedDefaultLibraries();
                const matched = defaults.find((l) => l.type === item.type);
                targetFolder = matched?.path || path.resolve(`./data/Libraries/${item.type === "movie" ? "Movies" : "TVSeries"}`);
              }

              const cleanTitleName = item.title.replace(/[^a-zA-Z0-9 ]/g, "");
              const yearSuffix = item.releaseDate ? ` (${item.releaseDate.split("-")[0]})` : "";

              for (const link of links) {
                logger.info(`Request ${req.id}: Unrestricting link: ${link}`);
                const directUrl = await unrestrictLink(link);
                const originalFilename = decodeURIComponent(directUrl.split("/").pop() || "download.mkv");
                const ext = path.extname(originalFilename);

                let destFile = "";
                if (item.type === "movie") {
                  const itemDir = path.join(targetFolder, `${cleanTitleName}${yearSuffix}`);
                  destFile = path.join(itemDir, `${cleanTitleName}${yearSuffix}${ext}`);
                } else {
                  // Guess season / episode info from filename, fallback to S01E01
                  const match = originalFilename.match(/[sS](\d+)[eE](\d+)/i);
                  const seasonNum = match ? parseInt(match[1], 10) : 1;
                  const episodeNum = match ? parseInt(match[2], 10) : 1;

                  const seasonStr = `Season ${seasonNum.toString().padStart(2, "0")}`;
                  const itemDir = path.join(targetFolder, cleanTitleName, seasonStr);
                  destFile = path.join(itemDir, `${cleanTitleName} - S${seasonNum.toString().padStart(2, "0")}E${episodeNum.toString().padStart(2, "0")}${ext}`);
                }

                logger.info(`Request ${req.id}: Downloading direct link ${directUrl} -> ${destFile}`);
                await downloadFile(directUrl, destFile);
              }

              logger.info(`Request ${req.id}: All files downloaded. Scanning library...`);
              await scanLibrary();

              await db.update(requests)
                .set({ status: "COMPLETED", updatedAt: new Date().toISOString() })
                .where(eq(requests.id, req.id))
                .run();
              
              logger.info(`Request ${req.id}: Live download and library import completed!`);

            } catch (err: any) {
              logger.error(`Request ${req.id} post-download processing failed:`, err);
              if (req.releaseTitle) {
                failedReleaseTitles.add(req.releaseTitle);
              }
              
              const errStr = String(err.message || err).toLowerCase();
              const isPermanent = errStr.includes("eacces") || errStr.includes("eperm") || errStr.includes("permission denied") || errStr.includes("enospc");

              await db.update(requests)
                .set({
                  status: isPermanent ? "FAILED" : "REQUESTED",
                  debridId: isPermanent ? req.debridId : null,
                  releaseTitle: isPermanent ? req.releaseTitle : null,
                  releaseSize: isPermanent ? req.releaseSize : null,
                  progress: 0,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(requests.id, req.id))
                .run();
            }
          })();

        } else if (rdStatus.status === "error") {
          logger.error(`Request ${req.id}: Real-Debrid reported an error.`);
          if (req.releaseTitle) {
            failedReleaseTitles.add(req.releaseTitle);
          }
          await db.update(requests)
            .set({
              status: "REQUESTED",
              debridId: null,
              releaseTitle: null,
              releaseSize: null,
              progress: 0,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(requests.id, req.id))
            .run();
        }
      }
    } catch (err) {
      logger.error(`Error processing request ${req.id}:`, err);
    }
  }
}

async function startWorker() {
  await initializeWorkerFolders();
  logger.info("Worker started. Running loop every 5 seconds...");
  
  setInterval(async () => {
    try {
      await processActiveRequests();
    } catch (err) {
      logger.error("Error in worker loop:", err);
    }
  }, 5000);
}

if (require.main === module) {
  startWorker().catch((err) => {
    logger.error("Worker process error:", err);
    process.exit(1);
  });
}

export { startWorker, processActiveRequests };
