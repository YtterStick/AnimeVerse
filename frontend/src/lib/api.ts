import type {
  Anime,
  AnimeSeason,
  ApiResponse,
  Episode,
  MultiStreamResult,
  SkipInterval,
  VideoReport,
  WatchHistoryEntry,
  WatchlistEntry,
} from "@/types";
import { anilistBrowserFallback } from "./anilistBrowserFallback";
import { resolveKaaClient } from "./kaaDirectResolver";
import { resolveKnownStream } from "./knownStreamResolver";
import { resolveExternalEnglishSubtitles } from "./subtitleFallbackResolver";
import { supabase, isSupabaseConfigured } from "./supabase";
import { resolveZokoClient } from "./zokoDirectResolver";

export type { SkipInterval };

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
  if (now - lastWakeTriggerAt > 45_000) {
    lastWakeTriggerAt = now;
    const wakeUrl = `${API_BASE}/health`;
    fetch(wakeUrl, { cache: "no-store" }).catch(() => {});
  }
}

function isTransientBackendError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || "");
  return (
    err instanceof TypeError ||
    (err instanceof DOMException && err.name === "AbortError") ||
    /failed to fetch|network|abort|timeout|load failed|connection|API error:\s*(?:5\d\d|429)/i.test(
      msg
    )
  );
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

/**
 * Extracts the upstream target hostname from a proxied URL (?url=https://...).
 */
export function extractProxyTargetHost(proxyUrl: string): string | null {
  try {
    const parsed = new URL(proxyUrl, RENDER_BASE);
    const target = parsed.searchParams.get("url");
    if (!target) return null;
    return new URL(target).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Rewrites a Cloudflare Worker proxy URL to the Render backup stream proxy (?url=...).
 * Returns null if the URL is already targeting the Render/local proxy or lacks a target url.
 */
export function toRenderFallbackProxyUrl(proxyUrl: string): string | null {
  try {
    const parsed = new URL(proxyUrl, RENDER_BASE);
    if (parsed.pathname.includes("/api/stream/proxy")) {
      return null;
    }
    const target = parsed.searchParams.get("url");
    if (!target) return null;
    const isWorkerOrigin =
      parsed.hostname.endsWith("workers.dev") ||
      (Boolean(STREAM_PROXY_BASE) && proxyUrl.startsWith(STREAM_PROXY_BASE));
    if (!isWorkerOrigin) return null;
    return `${RENDER_STREAM_PROXY}?${parsed.searchParams.toString()}`;
  } catch {
    return null;
  }
}

function rewriteStreamUrlToEdgeProxy(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  // 1. AnimeHeaven (animeheaven.me) blocks cross-site browser requests (400 Bad Request)
  // and caps fetch()-based proxies to a 600KB teaser clip.
  // In production with Cloudflare Worker (which uses raw TLS sockets + Render 307 fallback),
  // route AnimeHeaven through STREAM_PROXY_BASE so Render uses 0 MB of video bandwidth.
  if (rawUrl.includes("animeheaven")) {
    if (!STREAM_PROXY_BASE.includes("workers.dev")) {
      if (rawUrl.startsWith("/api/stream/proxy")) {
        return `${RENDER_BASE}${rawUrl}`;
      }
      if (rawUrl.startsWith("http")) {
        if (rawUrl.includes("/api/stream/proxy")) {
          return rawUrl;
        }
        return `${RENDER_STREAM_PROXY}?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent("https://animeheaven.me/")}`;
      }
    } else if (rawUrl.startsWith("http") && !rawUrl.includes("/api/stream/proxy")) {
      return `${STREAM_PROXY_BASE}?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent("https://animeheaven.me/")}`;
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

type SkipLookupResult = { found: boolean; skips: SkipInterval[] };
const skipTimesCache = new Map<string, { expiresAt: number; data: SkipLookupResult }>();
const skipTimesInFlight = new Map<string, Promise<SkipLookupResult>>();
const SKIP_FOUND_TTL_MS = 6 * 60 * 60 * 1000;
const SKIP_MISS_TTL_MS = 30 * 60 * 1000;

function readSkipCache(cacheKey: string): SkipLookupResult | null {
  const now = Date.now();
  const mem = skipTimesCache.get(cacheKey);
  if (mem && mem.expiresAt > now) return mem.data;

  try {
    const raw = window.sessionStorage?.getItem(`aniverse:skip:${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt: number; data: SkipLookupResult };
    if (parsed?.expiresAt > now && parsed.data) {
      skipTimesCache.set(cacheKey, parsed);
      return parsed.data;
    }
  } catch {
    // Ignore storage unavailability
  }
  return null;
}

function writeSkipCache(cacheKey: string, data: SkipLookupResult): void {
  const ttl = data.found ? SKIP_FOUND_TTL_MS : SKIP_MISS_TTL_MS;
  const entry = { expiresAt: Date.now() + ttl, data };
  skipTimesCache.set(cacheKey, entry);
  try {
    window.sessionStorage?.setItem(`aniverse:skip:${cacheKey}`, JSON.stringify(entry));
  } catch {
    // Ignore storage quota errors
  }
}

async function fetchAniSkipDirect(
  animeId: number,
  episode: number,
  duration = 0
): Promise<SkipLookupResult> {
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

function buildEdgeWithRenderBackup(targetUrl: string, referer?: string): string[] {
  const primary = buildStreamProxyUrl(targetUrl, referer ? { referer } : undefined);
  const backup = toRenderFallbackProxyUrl(primary);
  return backup ? [primary, backup] : [primary];
}

function isItalianHardsubServer(serverId: string): boolean {
  return serverId.startsWith("animeunity-") || serverId.startsWith("stellar-");
}

function hasEnglishSubtitles(server: MultiStreamResult["servers"][number]): boolean {
  return Boolean(
    server.subtitles?.some(
      (sub) => sub.lang === "en" || /english/i.test(sub.label || "")
    )
  );
}

export const streamApi = {
  getStreamUrl: async (
    animeId: number,
    episode: number,
    fresh = false
  ): Promise<MultiStreamResult> => {
    const zokoOptions = {
      buildProxyUrls: buildEdgeWithRenderBackup,
      buildStreamProxyUrl: (targetUrl: string, referer?: string) =>
        buildStreamProxyUrl(targetUrl, referer ? { referer } : undefined),
      fresh,
    };

    // 1. Resolve KAA directly in the browser + Cloudflare Worker first (0 bytes on Render)
    const clientServers = await resolveKaaClient(animeId, episode).catch(() => []);

    // 2. When KAA returns nothing (or user clicked Retry), resolve ZokoAnime cleanly via Worker
    // before falling back to Render so shows like Special A get clean non-Italian SUB+DUB quickly.
    let zokoServers: MultiStreamResult["servers"] = [];
    let backendValue: MultiStreamResult | null = null;

    if (fresh) {
      [zokoServers, backendValue] = await Promise.all([
        resolveZokoClient(animeId, episode, zokoOptions).catch(() => []),
        fetchApi<MultiStreamResult>(
          `/stream/${animeId}/${episode}?fresh=1`,
          { timeoutMs: 8500, maxAttempts: 1 }
        ).catch(() => {
          markRenderColdAndWake();
          return null;
        }),
      ]);
    } else if (clientServers.length === 0) {
      zokoServers = await resolveZokoClient(animeId, episode, zokoOptions).catch(() => []);
      if (zokoServers.length === 0) {
        backendValue = await fetchApi<MultiStreamResult>(
          `/stream/${animeId}/${episode}`,
          { timeoutMs: 8500, maxAttempts: 1 }
        ).catch(() => {
          markRenderColdAndWake();
          return null;
        });
      }
    }

    let res: MultiStreamResult = { servers: [], default: 0 };

    const backendServers = (backendValue?.servers || []).map((s) => ({
      ...s,
      url: rewriteStreamUrlToEdgeProxy(s.url),
      thumbnails: s.thumbnails ? rewriteStreamUrlToEdgeProxy(s.thumbnails) : s.thumbnails,
      subtitles: s.subtitles?.map((sub) => ({
        ...sub,
        url: rewriteStreamUrlToEdgeProxy(sub.url),
      })),
    }));

    const nonItalianBackend = backendServers.filter((s) => !isItalianHardsubServer(s.id));
    const italianBackend = backendServers.filter((s) => isItalianHardsubServer(s.id));
    const hasKaa = backendServers.some((s) => s.id.startsWith("kaa-"));
    const mergedClean = [
      ...(hasKaa ? [] : clientServers),
      ...nonItalianBackend,
      ...zokoServers,
    ];

    res.servers = [...mergedClean, ...italianBackend];

    // Fallback: If live resolvers and backend yielded no streams, check verified known client-side streams
    if (res.servers.length === 0) {
      const known = resolveKnownStream(animeId, episode);
      if (known && known.length > 0) {
        res.servers = known;
      }
    }

    if (res.servers.length === 0) {
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

    // If no SUB server has English subtitles (or burned-in English hard-subs like AnimeHeaven),
    // fetch fallback English text subtitles from AnimeTosho (.srt/.ass -> WebVTT) cleanly.
    const hasEnglishSubSupport = res.servers.some(
      (s) =>
        (s.category || "SUB") === "SUB" &&
        (s.id.startsWith("animeheaven-") || hasEnglishSubtitles(s))
    );

    if (!hasEnglishSubSupport) {
      const fallbackSubs = await resolveExternalEnglishSubtitles(animeId, episode, {
        buildProxyUrls: buildEdgeWithRenderBackup,
      }).catch(() => []);

      if (fallbackSubs.length > 0) {
        res.servers = res.servers.map((server) =>
          (server.category || "SUB") === "SUB" &&
          !server.id.startsWith("animeheaven-") &&
          (!server.subtitles || server.subtitles.length === 0)
            ? { ...server, subtitles: fallbackSubs }
            : server
        );
      }
    }

    // Pick best default server: clean non-Italian English soft-subbed SUB > any non-Italian SUB > any SUB
    const cleanEngSubIdx = res.servers.findIndex(
      (s) =>
        (s.category || "SUB") === "SUB" &&
        !isItalianHardsubServer(s.id) &&
        hasEnglishSubtitles(s)
    );
    const cleanSubIdx = res.servers.findIndex(
      (s) => (s.category || "SUB") === "SUB" && !isItalianHardsubServer(s.id)
    );
    const fallbackEngSubIdx = res.servers.findIndex(
      (s) => (s.category || "SUB") === "SUB" && hasEnglishSubtitles(s)
    );
    const anySubIdx = res.servers.findIndex((s) => (s.category || "SUB") === "SUB");

    if (cleanEngSubIdx !== -1) res.default = cleanEngSubIdx;
    else if (cleanSubIdx !== -1) res.default = cleanSubIdx;
    else if (fallbackEngSubIdx !== -1) res.default = fallbackEngSubIdx;
    else res.default = anySubIdx !== -1 ? anySubIdx : 0;

    return res;
  },

  /**
   * Intro/outro/recap timestamps (seconds), cached per episode and routed through the backend
   * 200-status wrapper when warm so AniSkip 404 misses never spam DevTools console errors.
   */
  getSkipTimes: async (
    animeId: number,
    episode: number,
    duration = 0
  ): Promise<SkipLookupResult> => {
    const cacheKey = `${animeId}:${episode}`;
    const cached = readSkipCache(cacheKey);
    if (cached) return cached;

    const existing = skipTimesInFlight.get(cacheKey);
    if (existing) return existing;

    const len = Math.max(0, Math.round(duration));
    const task = (async (): Promise<SkipLookupResult> => {
      if (Date.now() >= renderColdUntil) {
        try {
          const data = await fetchApi<SkipLookupResult>(
            `/stream/skip-times/${animeId}/${episode}?duration=${len}`,
            { timeoutMs: 3200, maxAttempts: 1 }
          );
          if (data && Array.isArray(data.skips)) {
            writeSkipCache(cacheKey, data);
            return data;
          }
        } catch (err) {
          if (isTransientBackendError(err)) {
            markRenderColdAndWake();
          }
        }
      }

      const direct = await fetchAniSkipDirect(animeId, episode, len);
      writeSkipCache(cacheKey, direct);
      return direct;
    })().finally(() => {
      skipTimesInFlight.delete(cacheKey);
    });

    skipTimesInFlight.set(cacheKey, task);
    return task;
  },
};

// ============================================
// History Endpoints (requires auth)
// ============================================

async function getSupabaseSessionUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

async function getHistoryDirectSupabase(): Promise<WatchHistoryEntry[]> {
  try {
    const userId = await getSupabaseSessionUserId();
    if (!userId) return [];
    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", userId)
      .order("watched_at", { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data as WatchHistoryEntry[];
  } catch {
    return [];
  }
}

async function saveProgressDirectSupabase(data: {
  anime_id: number;
  anime_title: string;
  anime_image: string | null;
  episode_number: number;
  episode_title?: string | null;
  progress_seconds: number;
  duration_seconds: number;
}): Promise<WatchHistoryEntry | null> {
  try {
    const userId = await getSupabaseSessionUserId();
    if (!userId) return null;
    const safeTitle = data.anime_title.trim() || `Anime #${data.anime_id}`;
    const { data: saved, error } = await supabase
      .from("watch_history")
      .upsert(
        {
          user_id: userId,
          anime_id: data.anime_id,
          anime_title: safeTitle,
          anime_image: data.anime_image || null,
          episode_number: data.episode_number,
          episode_title: data.episode_title || `Episode ${data.episode_number}`,
          progress_seconds: data.progress_seconds || 0,
          duration_seconds: data.duration_seconds || 0,
          watched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,anime_id,episode_number" }
      )
      .select()
      .single();
    if (error) return null;
    return saved as WatchHistoryEntry;
  } catch {
    return null;
  }
}

async function withHistoryFallback<T>(
  renderRequest: () => Promise<T>,
  supabaseFallback: () => Promise<T>
): Promise<T> {
  if (Date.now() < renderColdUntil) {
    return supabaseFallback();
  }
  try {
    return await renderRequest();
  } catch (err) {
    if (isTransientBackendError(err)) {
      markRenderColdAndWake();
      return supabaseFallback();
    }
    throw err;
  }
}

export const historyApi = {
  getHistory: (token: string): Promise<WatchHistoryEntry[]> =>
    withHistoryFallback(
      () =>
        fetchApi<WatchHistoryEntry[]>("/history", {
          headers: withAuth(token),
          timeoutMs: 4500,
          maxAttempts: 1,
        }),
      getHistoryDirectSupabase
    ),

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
  ): Promise<WatchHistoryEntry | null> =>
    withHistoryFallback(
      () =>
        fetchApi<WatchHistoryEntry>("/history", {
          method: "POST",
          headers: withAuth(token),
          body: JSON.stringify(data),
          timeoutMs: 4500,
          maxAttempts: 1,
        }),
      () => saveProgressDirectSupabase(data)
    ),

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
