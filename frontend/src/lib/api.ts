import type {
  Anime,
  ApiResponse,
  Episode,
  MultiStreamResult,
  WatchHistoryEntry,
  WatchlistEntry,
} from "@/types";
import { resolveKaaClient } from "./kaaDirectResolver";

export const BACKEND_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    signal: controller?.signal,
    ...options,
  });

  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Network error" }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

function withAuth(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ============================================
// Anime Endpoints
// ============================================

export const animeApi = {
  search: (query: string, page = 1, genres = "") =>
    fetchApi<ApiResponse<Anime[]>>(
      `/anime/search?q=${encodeURIComponent(query)}&page=${page}${
        genres ? `&genres=${encodeURIComponent(genres)}` : ""
      }`
    ),

  trending: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/trending?page=${page}`),

  topAiring: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/top-airing?page=${page}`),

  popular: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/popular?page=${page}`),

  topRated: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/top-rated?page=${page}`),

  getGenres: () =>
    fetchApi<{ data: { id: number; name: string }[] }>(`/anime/genres`),

  getById: (id: number) =>
    fetchApi<{ data: Anime }>(`/anime/${id}`),

  getEpisodes: (id: number, page = 1) =>
    fetchApi<ApiResponse<Episode[]>>(`/anime/${id}/episodes?page=${page}`),

  getRecommendations: (id: number) =>
    fetchApi<ApiResponse<any[]>>(`/anime/${id}/recommendations`, {
      timeoutMs: 12000,
    }),
};

// ============================================
// Stream Endpoints
// ============================================

export const streamApi = {
  getStreamUrl: async (animeId: number, episode: number): Promise<MultiStreamResult> => {
    // Run backend stream resolution and client-side direct resolver concurrently
    const [backendSettled, clientSettled] = await Promise.allSettled([
      fetchApi<MultiStreamResult>(`/stream/${animeId}/${episode}`, { timeoutMs: 12000 }),
      resolveKaaClient(animeId, episode),
    ]);

    let res: MultiStreamResult = { servers: [], default: 0 };

    if (backendSettled.status === "fulfilled" && backendSettled.value?.servers) {
      res = backendSettled.value;
      if (BACKEND_URL && res.servers) {
        res.servers = res.servers.map((s) => ({
          ...s,
          url: s.url.startsWith("http") ? s.url : `${BACKEND_URL}${s.url}`,
          subtitles: s.subtitles?.map((sub) => ({
            ...sub,
            url: sub.url.startsWith("http") ? sub.url : `${BACKEND_URL}${sub.url}`,
          })),
        }));
      }
    }

    const clientServers =
      clientSettled.status === "fulfilled" && Array.isArray(clientSettled.value)
        ? clientSettled.value
        : [];

    if (clientServers.length > 0) {
      const hasKaa = res.servers?.some((s) => s.id.startsWith("kaa-"));
      if (!hasKaa) {
        // Prepend client-side resolved CatStream servers (fastest & highest quality)
        res.servers = [...clientServers, ...(res.servers || [])];
      }
    }

    if (!res.servers || res.servers.length === 0) {
      return {
        servers: [],
        default: -1,
        message: "No streaming servers found for this episode.",
      };
    }

    res.default = 0;
    return res;
  },

  /** Intro/outro/recap timestamps (seconds) from AniSkip, proxied through our backend. */
  getSkipTimes: (animeId: number, episode: number, duration = 0) =>
    fetchApi<{ found: boolean; skips: SkipInterval[] }>(
      `/stream/skip-times/${animeId}/${episode}?duration=${Math.round(duration)}`,
      { timeoutMs: 8000 }
    ).catch(() => ({ found: false, skips: [] as SkipInterval[] })),
};

export interface SkipInterval {
  type: "op" | "ed" | "recap" | string;
  start: number;
  end: number;
  episodeLength: number;
}

// ============================================
// History Endpoints (requires auth)
// ============================================

export const historyApi = {
  getHistory: (token: string) =>
    fetchApi<WatchHistoryEntry[]>("/history", {
      headers: withAuth(token),
    }),

  saveProgress: (
    token: string,
    data: {
      anime_id: number;
      anime_title: string;
      anime_image: string | null;
      episode_number: number;
      episode_title?: string | null;
      progress_seconds: number;
      duration_seconds: number;
    }
  ) =>
    fetchApi<WatchHistoryEntry>("/history", {
      method: "POST",
      headers: withAuth(token),
      body: JSON.stringify(data),
    }),

  deleteEntry: (token: string, id: string) =>
    fetchApi<void>(`/history/${id}`, {
      method: "DELETE",
      headers: withAuth(token),
    }),

  clearAll: (token: string) =>
    fetchApi<void>("/history", {
      method: "DELETE",
      headers: withAuth(token),
    }),
};

// ============================================
// Watchlist Endpoints (requires auth)
// ============================================

export const watchlistApi = {
  getWatchlist: (token: string) =>
    fetchApi<WatchlistEntry[]>("/watchlist", {
      headers: withAuth(token),
    }),

  addToWatchlist: (
    token: string,
    data: {
      anime_id: number;
      anime_title: string;
      anime_image: string | null;
      anime_type: string | null;
    }
  ) =>
    fetchApi<WatchlistEntry>("/watchlist", {
      method: "POST",
      headers: withAuth(token),
      body: JSON.stringify(data),
    }),

  removeFromWatchlist: (token: string, animeId: number) =>
    fetchApi<void>(`/watchlist/${animeId}`, {
      method: "DELETE",
      headers: withAuth(token),
    }),

  checkInWatchlist: (token: string, animeId: number) =>
    fetchApi<{ exists: boolean }>(`/watchlist/check/${animeId}`, {
      headers: withAuth(token),
    }),
};
