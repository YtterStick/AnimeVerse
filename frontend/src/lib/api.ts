import type {
  Anime,
  AnimeSeason,
  ApiResponse,
  Episode,
  MultiStreamResult,
  VideoReport,
  WatchHistoryEntry,
  WatchlistEntry,
} from "@/types";
import { anilistBrowserFallback } from "./anilistBrowserFallback";
import { resolveKaaClient } from "./kaaDirectResolver";
import { resolveKnownStream } from "./knownStreamResolver";

const DEFAULT_PRODUCTION_BACKEND = "https://animeverse-z6p4.onrender.com";
const DEFAULT_CLOUDFLARE_STREAM_PROXY = "https://aniverse-stream.andreidilag12.workers.dev";

export const BACKEND_URL = (
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : DEFAULT_PRODUCTION_BACKEND)
).replace(/\/+$/, "");
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

/**
 * In production (Cloudflare Pages), stream/subtitle/playlist proxying routes through our
 * Cloudflare Worker (`VITE_STREAM_PROXY_URL` or default `aniverse-stream` worker) for unlimited bandwidth.
 * In local Vite dev (`import.meta.env.DEV`), falls back to the local Express backend proxy unless overridden.
 */
const CONFIGURED_STREAM_PROXY = (import.meta.env.VITE_STREAM_PROXY_URL || "").replace(/\/+$/, "");
export const STREAM_PROXY_BASE = CONFIGURED_STREAM_PROXY
  ? CONFIGURED_STREAM_PROXY
  : import.meta.env.DEV
    ? BACKEND_URL
      ? `${BACKEND_URL}/api/stream/proxy`
      : "/api/stream/proxy"
    : DEFAULT_CLOUDFLARE_STREAM_PROXY;

/**
 * Tracks whether Render recently timed out or returned 502/503 while waking up.
 * While `Date.now() < renderColdUntil`, read-only anime/stream calls bypass the
 * 3.8s wait and resolve directly in ~0.5s via AniList/Jikan/Worker while `/api/health`
 * finishes waking Render in the background.
 */
let renderColdUntil = 0;
let lastWakeTriggerAt = 0;

function markRenderColdAndWake(): void {
  const now = Date.now();
  renderColdUntil = now + 25_000;
  if (now - lastWakeTriggerAt > 20_000) {
    lastWakeTriggerAt = now;
    const wakeUrl = `${API_BASE}/health`;
    fetch(wakeUrl, { cache: "no-store" }).catch(() => {});
  }
}

const RENDER_BASE = BACKEND_URL || DEFAULT_PRODUCTION_BACKEND;
const RENDER_STREAM_PROXY = `${RENDER_BASE}/api/stream/proxy`;

function isWorkerRateLimitedPlaylist(targetUrl: string): boolean {
  return (
    STREAM_PROXY_BASE.includes("workers.dev") &&
    targetUrl.includes("krussdomi") &&
    /(?:\.m3u8(?:[?#]|$)|\/playlist\/|\/manifest\/)/i.test(targetUrl)
  );
}

/**
 * Builds a proxied stream/playlist/subtitle URL.
 * Krussdomi playlist endpoints rate-limit Cloudflare Worker IPs, so playlists go through
 * Render (~3 KB) with segProxy pointing all heavy video chunks to Cloudflare Worker (0 MB on Render).
 */
export function buildStreamProxyUrl(
  targetUrl: string,
  options?: { audio?: string; quality?: string; referer?: string }
): string {
  const useRenderPlaylist = isWorkerRateLimitedPlaylist(targetUrl);
  const base = useRenderPlaylist ? RENDER_STREAM_PROXY : STREAM_PROXY_BASE;
  let full = `${base}?url=${encodeURIComponent(targetUrl)}`;
  if (options?.audio) full += `&audio=${encodeURIComponent(options.audio)}`;
  if (options?.quality) full += `&quality=${encodeURIComponent(options.quality)}`;
  if (options?.referer) full += `&referer=${encodeURIComponent(options.referer)}`;
  if (useRenderPlaylist) {
    full += `&segProxy=${encodeURIComponent(STREAM_PROXY_BASE)}`;
  }
  return full;
}

function rewriteStreamUrlToEdgeProxy(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  // 1. AnimeHeaven (animeheaven.me) blocks cross-site browser requests (400 Bad Request)
  // and caps fetch()-based proxies to a 600KB teaser clip.
  // Route through Render Node/Express backend which serves the full 1080p video reliably.
  if (rawUrl.includes("animeheaven")) {
    if (rawUrl.startsWith("/api/stream/proxy")) {
      return `${RENDER_BASE}${rawUrl}`;
    }
    if (rawUrl.startsWith("http")) {
      if (rawUrl.includes("/api/stream/proxy")) {
        return rawUrl;
      }
      return `${RENDER_STREAM_PROXY}?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent("https://animeheaven.me/")}`;
    }
  }

  // 2. All other providers, HLS video segments, storyboards (advancedairesearchlab.xyz / babybayw.xyz),
  // and subtitles route through Cloudflare Worker (STREAM_PROXY_BASE), keeping Krussdomi .m3u8 playlists
  // on Render with segProxy pointing video chunks back to Cloudflare Worker.
  const proxyPrefixes = [
    "/api/stream/proxy",
    ...(BACKEND_URL ? [`${BACKEND_URL}/api/stream/proxy`] : []),
    `${RENDER_BASE}/api/stream/proxy`,
  ];
  for (const prefix of proxyPrefixes) {
    if (rawUrl.startsWith(prefix)) {
      const suffix = rawUrl.slice(prefix.length);
      try {
        const parsed = new URL(rawUrl, RENDER_BASE);
        const innerTarget = parsed.searchParams.get("url") || "";
        if (isWorkerRateLimitedPlaylist(innerTarget)) {
          if (parsed.searchParams.has("segProxy")) {
            return `${RENDER_STREAM_PROXY}${suffix}`;
          }
          const joiner = suffix.includes("?") ? "&" : "?";
          return `${RENDER_STREAM_PROXY}${suffix}${joiner}segProxy=${encodeURIComponent(STREAM_PROXY_BASE)}`;
        }
      } catch {
        // Fallback to direct Worker rewrite
      }
      return `${STREAM_PROXY_BASE}${suffix}`;
    }
  }

  if (!rawUrl.startsWith("http") && BACKEND_URL) {
    return `${BACKEND_URL}${rawUrl}`;
  }
  return rawUrl;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { timeoutMs?: number; maxAttempts?: number },
  attempt = 1
): Promise<T> {
  const timeoutMs = options?.timeoutMs;
  const maxAttempts = options?.maxAttempts ?? 3;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  const {
    timeoutMs: _omitTimeout,
    maxAttempts: _omitMaxAttempts,
    headers: extraHeaders,
    ...restOptions
  } = options || {};

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...restOptions,
      // Merge headers LAST so auth headers never wipe out Content-Type
      headers: {
        "Content-Type": "application/json",
        ...(extraHeaders as Record<string, string> | undefined),
      },
      signal: controller?.signal ?? restOptions.signal,
    });
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }

  // Transparently retry idempotent GETs when maxAttempts > 1
  const isGet = !options?.method || options.method.toUpperCase() === "GET";
  if (isGet && [429, 502, 503].includes(res.status) && attempt < maxAttempts) {
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

async function withBrowserFallback<T>(
  endpoint: string,
  fallback: () => Promise<T>,
  timeoutMs = 3800
): Promise<T> {
  if (Date.now() < renderColdUntil) {
    return fallback();
  }

  try {
    return await fetchApi<T>(endpoint, { timeoutMs, maxAttempts: 1 });
  } catch {
    markRenderColdAndWake();
    return fallback();
  }
}

function withAuth(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ============================================
// Anime Endpoints (Render Cache -> Direct Browser AniList/Jikan Fallback)
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
    return withBrowserFallback<ApiResponse<Anime[]>>(
      `/anime/search?${params.toString()}`,
      () => anilistBrowserFallback.search(query, page, genres, orderBy, status)
    );
  },

  trending: (page = 1) =>
    withBrowserFallback<ApiResponse<Anime[]>>(
      `/anime/trending?page=${page}`,
      () => anilistBrowserFallback.trending(page)
    ),

  topAiring: (page = 1) =>
    withBrowserFallback<ApiResponse<Anime[]>>(
      `/anime/top-airing?page=${page}`,
      () => anilistBrowserFallback.topAiring(page)
    ),

  upcoming: (page = 1) =>
    withBrowserFallback<ApiResponse<Anime[]>>(
      `/anime/upcoming?page=${page}`,
      () => anilistBrowserFallback.upcoming(page)
    ),

  popular: (page = 1) =>
    withBrowserFallback<ApiResponse<Anime[]>>(
      `/anime/popular?page=${page}`,
      () => anilistBrowserFallback.popular(page)
    ),

  topRated: (page = 1) =>
    withBrowserFallback<ApiResponse<Anime[]>>(
      `/anime/top-rated?page=${page}`,
      () => anilistBrowserFallback.topRated(page)
    ),

  getSchedule: (day = "monday") =>
    withBrowserFallback<ApiResponse<Anime[]>>(
      `/anime/schedule?day=${encodeURIComponent(day)}`,
      () => anilistBrowserFallback.schedule(day)
    ),

  getGenres: () =>
    withBrowserFallback<{ data: { id: number; name: string }[] }>(
      `/anime/genres`,
      () => anilistBrowserFallback.genres()
    ),

  getById: (id: number): Promise<{ data: Anime }> =>
    withBrowserFallback<{ data: Anime }>(
      `/anime/${id}`,
      () => anilistBrowserFallback.byId(id),
      4200
    ),

  getEpisodes: (id: number, page: number | string = "all"): Promise<ApiResponse<Episode[]>> =>
    withBrowserFallback<ApiResponse<Episode[]>>(
      `/anime/${id}/episodes?page=${page}`,
      () => anilistBrowserFallback.episodes(id),
      4500
    ),

  getRecommendations: (id: number) =>
    withBrowserFallback<ApiResponse<any[]>>(
      `/anime/${id}/recommendations`,
      () => anilistBrowserFallback.recommendations(id),
      4200
    ),

  getSeasons: (id: number) =>
    withBrowserFallback<ApiResponse<AnimeSeason[]>>(
      `/anime/${id}/seasons`,
      () => anilistBrowserFallback.seasons(id),
      4200
    ),
};

// ============================================
// Stream Endpoints
// ============================================

async function fetchAniSkipDirect(
  animeId: number,
  episode: number,
  duration = 0
): Promise<{ found: boolean; skips: SkipInterval[] }> {
  try {
    const len = Math.max(0, Math.round(duration));
    const url = `https://api.aniskip.com/v2/skip-times/${animeId}/${episode}?types[]=op&types[]=ed&types[]=recap&types[]=mixed-op&types[]=mixed-ed&episodeLength=${len}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return { found: false, skips: [] };
    const json = await res.json();
    const rawResults: any[] = json?.results || [];
    const bestByType = new Map<string, any>();

    for (const r of rawResults) {
      const type = String(r.skipType || "").replace("mixed-", "");
      const start = Number(r.interval?.startTime) || 0;
      const end = Number(r.interval?.endTime) || 0;
      const span = end - start;
      if ((type === "op" || type === "ed") && (span < 45 || span > 130)) continue;
      if (type === "op" && episode === 1 && start < 30) continue;

      const current = bestByType.get(type);
      if (!current) {
        bestByType.set(type, r);
      } else {
        const curSpan =
          (Number(current.interval?.endTime) || 0) -
          (Number(current.interval?.startTime) || 0);
        if (Math.abs(span - 89.5) < Math.abs(curSpan - 89.5)) {
          bestByType.set(type, r);
        }
      }
    }

    const skips: SkipInterval[] = Array.from(bestByType.values()).map((r) => ({
      type: String(r.skipType).replace("mixed-", ""),
      start: Number(r.interval?.startTime) || 0,
      end: Number(r.interval?.endTime) || 0,
      episodeLength: Number(r.episodeLength) || 0,
    }));

    return { found: skips.length > 0, skips };
  } catch {
    return { found: false, skips: [] };
  }
}

export const streamApi = {
  getStreamUrl: async (
    animeId: number,
    episode: number,
    fresh = false
  ): Promise<MultiStreamResult> => {
    // 1. Resolve directly in the browser + Vercel Edge first (uses 0 bytes on Render)
    const clientServers = await resolveKaaClient(animeId, episode).catch(() => []);

    // 2. Only query Render's backup scrapers if client resolution found nothing or user clicked Retry
    let backendValue: MultiStreamResult | null = null;
    if (clientServers.length === 0 || fresh) {
      backendValue = await fetchApi<MultiStreamResult>(
        `/stream/${animeId}/${episode}${fresh ? "?fresh=1" : ""}`,
        { timeoutMs: 8500, maxAttempts: 1 }
      ).catch(() => {
        markRenderColdAndWake();
        return null;
      });
    }

    let res: MultiStreamResult = { servers: [], default: 0 };

    if (backendValue?.servers) {
      res = {
        ...backendValue,
        servers: backendValue.servers.map((s) => ({
          ...s,
          url: rewriteStreamUrlToEdgeProxy(s.url),
          thumbnails: s.thumbnails ? rewriteStreamUrlToEdgeProxy(s.thumbnails) : s.thumbnails,
          subtitles: s.subtitles?.map((sub) => ({
            ...sub,
            url: rewriteStreamUrlToEdgeProxy(sub.url),
          })),
        })),
      };
    }

    if (clientServers.length > 0) {
      const hasKaa = res.servers?.some((s) => s.id.startsWith("kaa-"));
      if (!hasKaa) {
        // Prepend client-side resolved CatStream servers (fastest & highest quality)
        res.servers = [...clientServers, ...(res.servers || [])];
      }
    }

    // Fallback: If neither backend nor KAA returned streams, check verified known client-side streams
    if (!res.servers || res.servers.length === 0) {
      const known = resolveKnownStream(animeId, episode);
      if (known && known.length > 0) {
        res.servers = known;
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
      (s) =>
        (s.category || "SUB") === "SUB" &&
        s.subtitles &&
        s.subtitles.some((sub) => sub.lang === "en")
    );
    if (engSubIdx !== -1) {
      res.default = engSubIdx;
    } else {
      const subIdx = res.servers.findIndex((s) => (s.category || "SUB") === "SUB");
      res.default = subIdx !== -1 ? subIdx : 0;
    }

    return res;
  },

  /** Intro/outro/recap timestamps (seconds) directly from AniSkip (0 bytes on Render). */
  getSkipTimes: async (animeId: number, episode: number, duration = 0) => {
    return fetchAniSkipDirect(animeId, episode, duration);
  },
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

// ============================================
// Video Reports Endpoints (Public Submit / Admin Manage)
// ============================================

export const reportsApi = {
  submitReport: (
    data: {
      anime_id: number;
      anime_title: string;
      anime_image?: string | null;
      episode_number: number;
      server_name: string;
      category: string;
      reason: string;
      details?: string;
    },
    token?: string | null
  ) =>
    fetchApi<{ data: VideoReport; message: string }>("/reports", {
      method: "POST",
      headers: token ? withAuth(token) : undefined,
      body: JSON.stringify(data),
      timeoutMs: 12000,
      maxAttempts: 2,
    }),

  getReports: (token: string) =>
    fetchApi<{ data: VideoReport[] }>("/reports", {
      headers: withAuth(token),
      timeoutMs: 12000,
      maxAttempts: 2,
    }),

  updateStatus: (token: string, id: string, status: "open" | "resolved") =>
    fetchApi<{ data: VideoReport }>(`/reports/${id}`, {
      method: "PATCH",
      headers: withAuth(token),
      body: JSON.stringify({ status }),
      timeoutMs: 12000,
      maxAttempts: 2,
    }),

  deleteReport: (token: string, id: string) =>
    fetchApi<{ message: string; remaining: number }>(`/reports/${id}`, {
      method: "DELETE",
      headers: withAuth(token),
      timeoutMs: 12000,
      maxAttempts: 2,
    }),
};
