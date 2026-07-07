import { logger } from "../logger";
import { getSetting } from "../settings";

export interface ProwlarrCandidate {
  title: string;
  size: number;
  downloadUrl: string;
  guid: string;
  seeders: number;
  peers: number;
  indexer: string;
  infoHash?: string;
  magnetUrl?: string;
}

export async function searchProwlarr(
  query: string,
  type: "movie" | "series"
): Promise<ProwlarrCandidate[]> {
  const prowlarrUrl = await getSetting<string>("prowlarr_url");
  const prowlarrApiKey = await getSetting<string>("prowlarr_api_key");

  if (!prowlarrUrl || !prowlarrApiKey) {
    console.warn("Prowlarr is not configured. Returning empty search results.");
    return [];
  }

  // Normalize URL to get host and port root, then construct clean search path
  let baseUrl = prowlarrUrl.trim().replace(/\/+$/, "");
  baseUrl = baseUrl
    .replace(/\/search$/, "")
    .replace(/\/v1$/, "")
    .replace(/\/api$/, "")
    .replace(/\/search$/, ""); // Double-pass check

  // Categories: Movies = 2000, TV = 5000
  const categories = type === "movie" ? "2000" : "5000";
  const url = `${baseUrl}/api/v1/search?query=${encodeURIComponent(query)}&categories=${categories}&indexerIds=-2&type=search`;

  // Log the Prowlarr search query command (redacting the middle portion of the API key for security)
  const redactedKey = prowlarrApiKey.length > 8 
    ? `${prowlarrApiKey.substring(0, 4)}...${prowlarrApiKey.substring(prowlarrApiKey.length - 4)}` 
    : "[REDACTED]";
  logger.info(`Prowlarr Search command: curl -X GET "${url}" -H "X-Api-Key: ${redactedKey}"`);

  try {
    const res = await fetch(url, {
      headers: {
        "X-Api-Key": prowlarrApiKey,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(60000), // 60s timeout
    });

    if (!res.ok) {
      throw new Error(`Prowlarr returned status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as any[];
    if (!Array.isArray(data)) return [];

    // Map and filter valid candidates
    const candidates: ProwlarrCandidate[] = data
      .map((item: any) => ({
        title: item.title || "Unknown Release",
        size: item.size || 0,
        downloadUrl: item.downloadUrl || item.magnetUrl || "",
        guid: item.guid || "",
        seeders: typeof item.seeders === "number" ? item.seeders : 0,
        peers: typeof item.peers === "number" ? item.peers : 0,
        indexer: item.indexer || "Unknown Indexer",
        infoHash: item.infoHash || undefined,
        magnetUrl: item.magnetUrl || undefined,
      }))
      .filter((c) => c.downloadUrl);

    // Sort by seeders descending
    return candidates.sort((a, b) => b.seeders - a.seeders);
  } catch (error: any) {
    console.error("Error searching Prowlarr:", error.message || error);
    return [];
  }
}
