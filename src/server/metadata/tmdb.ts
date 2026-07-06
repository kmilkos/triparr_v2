import { getSetting } from "../settings";

export interface TMDBMovie {
  id: number;
  imdb_id?: string;
  title: string;
  original_title: string;
  tagline?: string;
  overview: string;
  release_date: string;
  runtime: number;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  genres: Array<{ id: number; name: string }>;
  production_companies: Array<{ id: number; name: string }>;
  credits?: {
    cast: Array<{ id: number; name: string; character: string; profile_path: string; order: number }>;
    crew: Array<{ id: number; name: string; job: string; profile_path: string }>;
  };
}

export interface TMDBShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  genres: Array<{ id: number; name: string }>;
  production_companies: Array<{ id: number; name: string }>;
  status: string;
  credits?: {
    cast: Array<{ id: number; name: string; character: string; profile_path: string; order: number }>;
    crew: Array<{ id: number; name: string; job: string; profile_path: string }>;
  };
  seasons: Array<{
    id: number;
    season_number: number;
    name: string;
    overview: string;
    episode_count: number;
    poster_path: string;
    air_date: string;
  }>;
}

export interface TMDBSeason {
  season_number: number;
  episodes: Array<{
    id: number;
    episode_number: number;
    name: string;
    overview: string;
    runtime: number;
    still_path: string;
    air_date: string;
    vote_average: number;
  }>;
}

async function fetchFromTMDB<T>(endpoint: string): Promise<T | null> {
  const token = await getSetting<string>("tmdb_api_token");
  if (!token) {
    console.warn("TMDB API Read Access Token is not configured. Skipping TMDB fetch.");
    return null;
  }

  try {
    const url = `https://api.themoviedb.org/3${endpoint}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`TMDB error fetching ${endpoint}: ${response.statusText}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`Network error calling TMDB:`, error);
    return null;
  }
}

export async function searchTMDB(query: string, type: "movie" | "series") {
  const path = type === "movie" ? "/search/movie" : "/search/tv";
  const encodedQuery = encodeURIComponent(query);
  const result = await fetchFromTMDB<{ results: any[] }>(`${path}?query=${encodedQuery}`);
  return result?.results || [];
}

export async function getMovieMetadata(tmdbId: number): Promise<TMDBMovie | null> {
  return fetchFromTMDB<TMDBMovie>(`/movie/${tmdbId}?append_to_response=credits`);
}

export async function getTVMetadata(tmdbId: number): Promise<TMDBShow | null> {
  return fetchFromTMDB<TMDBShow>(`/tv/${tmdbId}?append_to_response=credits`);
}

export async function getTVSeasonMetadata(tmdbId: number, seasonNumber: number): Promise<TMDBSeason | null> {
  return fetchFromTMDB<TMDBSeason>(`/tv/${tmdbId}/season/${seasonNumber}`);
}
