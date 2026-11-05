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
  options?: RequestInit & { timeoutMs?: number },
  attempt = 1
): Promise<T> {
  const timeoutMs = options?.timeoutMs;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  const { timeoutMs: _omitTimeout, headers: extraHeaders, ...restOptions } = options || {};
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...restOptions,
    // Merge headers LAST so auth headers never wipe out Content-Type
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders as Record<string, string> | undefined),
    },
    signal: controller?.signal ?? restOptions.signal,
  });

  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }

  // Transparently retry idempotent GETs when the backend/upstream is briefly busy
  const isGet = !options?.method || options.method.toUpperCase() === "GET";
  const MAX_ATTEMPTS = 3;
  if (isGet && [429, 502, 503].includes(res.status) && attempt < MAX_ATTEMPTS) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "", 10);
    const delayMs = Number.isFinite(retryAfter)
      ? Math.min(retryAfter * 1000, 5000)
      : 1500 * attempt;
    await new Promise((r) => setTimeout(r, delayMs));
    return fetchApi<T>(endpoint, options, attempt + 1);
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
  search: (
    query: string,
    page = 1,
    genres = "",
    orderBy = "",
    status = ""
  ) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("page", String(page));
    if (genres) params.set("genres", genres);
    if (orderBy) params.set("order_by", orderBy);
    if (status) params.set("status", status);
    return fetchApi<ApiResponse<Anime[]>>(`/anime/search?${params.toString()}`);
  },

  trending: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/trending?page=${page}`),

  topAiring: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/top-airing?page=${page}`),

  upcoming: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/upcoming?page=${page}`),

  popular: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/popular?page=${page}`),

  topRated: (page = 1) =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/top-rated?page=${page}`),

  getSchedule: (day = "monday") =>
    fetchApi<ApiResponse<Anime[]>>(`/anime/schedule?day=${encodeURIComponent(day)}`),

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
  getStreamUrl: async (animeId: number, episode: number, fresh = false): Promise<MultiStreamResult> => {
    // Run backend stream resolution and client-side direct resolver concurrently
    const [backendSettled, clientSettled] = await Promise.allSettled([
      fetchApi<MultiStreamResult>(`/stream/${animeId}/${episode}${fresh ? "?fresh=1" : ""}`, { timeoutMs: 15000 }),
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

    // Deduplicate servers: keep at most one stream per distinct provider per category
    const seenServerKeys = new Set<string>();
    const uniqueServers: typeof res.servers = [];
    for (const server of res.servers) {
      const providerKey = `${server.name.replace(/\s*\(.*?\)/g, "").trim().toLowerCase()}-${server.category}`;
      if (!seenServerKeys.has(providerKey)) {
        seenServerKeys.add(providerKey);
        uniqueServers.push(server);
      }
    }
    res.servers = uniqueServers.length > 0 ? uniqueServers : res.servers;

    // Pick best default server: Soft-subbed HLS with English subtitle track first, then any SUB
    const engSubIdx = res.servers.findIndex(
      (s) => (s.category || "SUB") === "SUB" && s.subtitles && s.subtitles.some((sub) => sub.lang === "en")
    );
    if (engSubIdx !== -1) {
      res.default = engSubIdx;
    } else {
      const subIdx = res.servers.findIndex((s) => (s.category || "SUB") === "SUB");
      res.default = subIdx !== -1 ? subIdx : 0;
    }

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
