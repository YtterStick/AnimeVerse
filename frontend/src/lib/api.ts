import type {
  Anime,
  ApiResponse,
  Episode,
  MultiStreamResult,
  WatchHistoryEntry,
  WatchlistEntry,
} from "@/types";

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
  search: (query: string, page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(
      `/anime/search?q=${encodeURIComponent(query)}&page=${page}`
    ),

  trending: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/trending?page=${page}`),

  topAiring: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/top-airing?page=${page}`),

  popular: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/popular?page=${page}`),

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
  getStreamUrl: async (animeId: number, episode: number) => {
    const res = await fetchApi<MultiStreamResult>(`/stream/${animeId}/${episode}`);
    if (BACKEND_URL && res?.servers) {
      res.servers = res.servers.map((s) => ({
        ...s,
        url: s.url.startsWith("http") ? s.url : `${BACKEND_URL}${s.url}`,
        subtitles: s.subtitles?.map((sub) => ({
          ...sub,
          url: sub.url.startsWith("http") ? sub.url : `${BACKEND_URL}${sub.url}`,
        })),
      }));
    }
    return res;
  },
};

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
