import { getSetting } from "../settings";
import * as http from "http";
import * as https from "https";

function httpGetBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location;
        if (redirectUrl.startsWith("magnet:") || /^[0-9a-fA-F]{40}$/.test(redirectUrl)) {
          reject({ name: "MagnetRedirect", magnet: redirectUrl });
          return;
        }
        const nextUrl = new URL(redirectUrl, url).toString();
        resolve(httpGetBuffer(nextUrl));
        return;
      }

      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`HTTP Status Code: ${res.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

const RD_API_BASE = "https://api.real-debrid.com/rest/1.0";

async function rdFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getSetting<string>("real_debrid_token");
  if (!token) {
    throw new Error("Real-Debrid API token is not configured.");
  }

  const url = `${RD_API_BASE}${path}`;
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    signal: AbortSignal.timeout(10000), // 10s timeout
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Real-Debrid API error (${response.status}): ${response.statusText}. Details: ${errorText}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function addMagnetToDebrid(magnetUrl: string): Promise<string> {
  let magnet = magnetUrl.trim();
  // If it's a raw info hash (40-char hex), construct magnet URL
  if (/^[0-9a-fA-F]{40}$/.test(magnet)) {
    magnet = `magnet:?xt=urn:btih:${magnet}`;
  }

  const formData = new URLSearchParams();
  formData.append("magnet", magnet);

  const res = await rdFetch<{ id: string }>(`/torrents/addMagnet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!res.id) {
    throw new Error("Failed to add magnet: Real-Debrid did not return a torrent ID.");
  }

  return res.id;
}

export async function addTorrentToDebrid(fileBuffer: Buffer): Promise<string> {
  const res = await rdFetch<{ id: string }>(`/torrents/addTorrent`, {
    method: "PUT",
    body: fileBuffer as any,
  });

  if (!res.id) {
    throw new Error("Failed to add torrent file: Real-Debrid did not return a torrent ID.");
  }

  return res.id;
}

export async function addTorrentOrMagnetToDebrid(urlOrHash: string): Promise<string> {
  const target = urlOrHash.trim();

  if (target.startsWith("magnet:") || /^[0-9a-fA-F]{40}$/.test(target)) {
    return addMagnetToDebrid(target);
  }

  console.log(`Downloading torrent file using native HTTP from: ${target}`);
  try {
    const buffer = await httpGetBuffer(target);
    console.log(`Submitting torrent file to Real-Debrid...`);
    return addTorrentToDebrid(buffer);
  } catch (err: any) {
    if (err && err.name === "MagnetRedirect" && err.magnet) {
      console.log(`HTTP redirected to a magnet link: ${err.magnet}. Submitting magnet to Real-Debrid...`);
      return addMagnetToDebrid(err.magnet);
    }
    throw err;
  }
}

export async function selectDebridFiles(torrentId: string): Promise<void> {
  // 1. Get info to inspect files
  const info = await rdFetch<any>(`/torrents/info/${torrentId}`);
  if (!info || !info.files) return;

  // Real-Debrid requires selecting which files to download.
  // We want to download the main video files. We will filter out small files
  // and select files with common video extensions.
  const videoExtensions = [".mkv", ".mp4", ".avi", ".m4v", ".mov", ".wmv"];
  const selectedIds: number[] = info.files
    .filter((file: any) => {
      const ext = (file.path || "").toLowerCase();
      const isVideo = videoExtensions.some((v) => ext.endsWith(v));
      // Exclude small files like samples/previews (usually < 20MB)
      const isNotSample = file.bytes > 1024 * 1024 * 20;
      return isVideo && isNotSample;
    })
    .map((file: any) => file.id);

  // If no files match, fallback to selecting all files
  const filesParam = selectedIds.length > 0 ? selectedIds.join(",") : "all";

  const formData = new URLSearchParams();
  formData.append("files", filesParam);

  await rdFetch<void>(`/torrents/selectFiles/${torrentId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });
}

export async function getDebridTorrentStatus(torrentId: string): Promise<{
  status: "waiting_files_selection" | "downloading" | "downloaded" | "error" | "other";
  progress: number;
  speed: number;
  eta: number;
  downloadLinks: string[];
}> {
  const info = await rdFetch<any>(`/torrents/info/${torrentId}`);
  if (!info) {
    throw new Error(`Torrent ${torrentId} not found on Real-Debrid.`);
  }

  // Real-Debrid status mapping:
  // - magnet_error / error: download failed
  // - waiting_files_selection: file selection needed
  // - queued / downloading: active download
  // - downloaded: download complete on Real-Debrid servers
  let computedStatus: "waiting_files_selection" | "downloading" | "downloaded" | "error" | "other" = "other";
  
  if (info.status === "waiting_files_selection") {
    computedStatus = "waiting_files_selection";
  } else if (info.status === "downloading" || info.status === "queued" || info.status === "compressing" || info.status === "uploading") {
    computedStatus = "downloading";
  } else if (info.status === "downloaded") {
    computedStatus = "downloaded";
  } else if (info.status === "magnet_error" || info.status === "error" || info.status === "dead") {
    computedStatus = "error";
  }

  return {
    status: computedStatus,
    progress: typeof info.progress === "number" ? info.progress : 0,
    speed: typeof info.speed === "number" ? info.speed : 0,
    eta: typeof info.eta === "number" ? info.eta : 0,
    downloadLinks: Array.isArray(info.links) ? info.links : [],
  };
}

export async function unrestrictLink(link: string): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("link", link);

  const res = await rdFetch<{ download: string }>(`/unrestrict/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!res.download) {
    throw new Error("Failed to unrestrict link: Real-Debrid did not return a download URL.");
  }

  return res.download;
}
