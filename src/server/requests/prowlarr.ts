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

  // Normalize URL and ensure it has api/v1
  let baseUrl = prowlarrUrl.trim().replace(/\/+$/, "");
  baseUrl = baseUrl.replace(/\/0\/api$/, "").replace(/\/api$/, "");
  if (!baseUrl.includes("/api/v1")) {
    baseUrl = `${baseUrl}/api/v1`;
  }

  // Categories: Movies = 2000, TV = 5000
  const categories = type === "movie" ? "2000" : "5000";
  const url = `${baseUrl}/search?query=${encodeURIComponent(query)}&categories=${categories}&type=search`;

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
