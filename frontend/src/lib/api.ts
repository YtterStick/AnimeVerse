import type {
  Anime,
  AnimeSeason,
  ApiResponse,
  Episode,
  MultiStreamResult,
  WatchHistoryEntry,
  WatchlistEntry,
} from "@/types";
import { resolveKaaClient } from "./kaaDirectResolver";
import { resolveKnownStream } from "./knownStreamResolver";

export const BACKEND_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

/**
 * In production (Vercel), stream/subtitle/playlist proxying runs on our Vercel Edge
 * Streaming Function (`/api/proxy`) so Render uses 0 MB of video bandwidth.
 * In local Vite dev (`import.meta.env.DEV`), fall back to the local Express backend proxy.
 */
export const STREAM_PROXY_BASE = import.meta.env.DEV
  ? BACKEND_URL
    ? `${BACKEND_URL}/api/stream/proxy`
    : "/api/stream/proxy"
  : "/api/proxy";

function rewriteStreamUrlToEdgeProxy(rawUrl: string): string {
  if (rawUrl.startsWith("/api/stream/proxy")) {
    return `${STREAM_PROXY_BASE}${rawUrl.slice("/api/stream/proxy".length)}`;
  }
  if (BACKEND_URL && rawUrl.startsWith(`${BACKEND_URL}/api/stream/proxy`)) {
    return `${STREAM_PROXY_BASE}${rawUrl.slice(`${BACKEND_URL}/api/stream/proxy`.length)}`;
  }
  if (!rawUrl.startsWith("http") && BACKEND_URL) {
    return `${BACKEND_URL}${rawUrl}`;
  }
  return rawUrl;
}

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

  getById: async (id: number): Promise<{ data: Anime }> => {
    try {
      return await fetchApi<{ data: Anime }>(`/anime/${id}`, { timeoutMs: 9000 });
    } catch (primaryErr) {
      // Direct browser fallback to Jikan / AniList (residential IP, open CORS) so a Render 503 never breaks anime pages
      try {
        const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${id}`, {
          signal: AbortSignal.timeout(7000),
        });
        if (jikanRes.ok) {
          const json = await jikanRes.json();
          if (json?.data) return { data: json.data as Anime };
        }
      } catch {
        // Fall through to AniList browser fallback
      }

      try {
        const alRes = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            query: `query ($idMal: Int) {
              Media(idMal: $idMal, type: ANIME) {
                id idMal format episodes status averageScore popularity season seasonYear
                description(asHtml: false)
                genres synonyms
                nextAiringEpisode { episode }
                title { romaji english native }
                coverImage { extraLarge large medium }
                studios(isMain: true) { nodes { id name } }
              }
            }`,
            variables: { idMal: id },
          }),
          signal: AbortSignal.timeout(7000),
        });
        if (alRes.ok) {
          const alJson = await alRes.json();
          const m = alJson?.data?.Media;
          if (m) {
            const img = m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium || "";
            const totalEps =
              m.episodes ||
              (m.nextAiringEpisode?.episode && m.nextAiringEpisode.episode > 1
                ? m.nextAiringEpisode.episode - 1
                : null);
            return {
              data: {
                mal_id: m.idMal || id,
                url: "",
                images: {
                  jpg: { image_url: img, small_image_url: img, large_image_url: img },
                  webp: { image_url: img, small_image_url: img, large_image_url: img },
                },
                trailer: { youtube_id: null, url: null, embed_url: null },
                title: m.title?.romaji || m.title?.english || `Anime #${id}`,
                title_english: m.title?.english || null,
                title_japanese: m.title?.native || null,
                type: m.format || "TV",
                source: "Original",
                episodes: totalEps,
                status: m.status === "RELEASING" ? "Currently Airing" : "Finished Airing",
                airing: m.status === "RELEASING",
                aired: { from: null, to: null, string: "" },
                duration: "24 min per ep",
                rating: "PG-13",
                score: m.averageScore ? Number((m.averageScore / 10).toFixed(2)) : null,
                scored_by: m.popularity || null,
                rank: null,
                popularity: m.popularity || null,
                members: m.popularity || null,
                favorites: null,
                synopsis: m.description ? String(m.description).replace(/<[^>]+>/g, "") : null,
                background: null,
                season: m.season ? String(m.season).toLowerCase() : null,
                year: m.seasonYear || null,
                studios: (m.studios?.nodes || []).map((s: any) => ({ mal_id: s.id, type: "anime", name: s.name })),
                genres: (m.genres || []).map((g: string, i: number) => ({ mal_id: i + 1, type: "anime", name: g })),
                themes: [],
                demographics: [],
              } as Anime,
            };
          }
        }
      } catch {
        // Ignore secondary fallback error
      }

      throw primaryErr;
    }
  },

  getEpisodes: async (id: number, page: number | string = "all"): Promise<ApiResponse<Episode[]>> => {
    try {
      return await fetchApi<ApiResponse<Episode[]>>(`/anime/${id}/episodes?page=${page}`, {
        timeoutMs: 10000,
      });
    } catch (primaryErr) {
      // Direct browser fallback to AniList episode count + titles so episode navigation always loads
      try {
        const alRes = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            query: `query ($idMal: Int) {
              Media(idMal: $idMal, type: ANIME) {
                episodes
                nextAiringEpisode { episode }
                streamingEpisodes { title }
              }
            }`,
            variables: { idMal: id },
          }),
          signal: AbortSignal.timeout(7000),
        });
        if (alRes.ok) {
          const alJson = await alRes.json();
          const m = alJson?.data?.Media;
          if (m) {
            const titleMap = new Map<number, string>();
            for (const se of m.streamingEpisodes || []) {
              const match = String(se.title || "").match(/Episode\s+(\d+)\s*[-–:]?\s*(.*)/i);
              if (match) {
                const epNum = parseInt(match[1], 10);
                if (!isNaN(epNum)) titleMap.set(epNum, match[2]?.trim() || `Episode ${epNum}`);
              }
            }
            const airedCount = m.nextAiringEpisode?.episode
              ? Math.max(1, m.nextAiringEpisode.episode - 1)
              : m.episodes || titleMap.size || 12;
            const total = Math.max(airedCount, titleMap.size, 1);
            const eps: Episode[] = [];
            for (let i = 1; i <= total; i++) {
              eps.push({
                mal_id: i,
                title: titleMap.get(i) || `Episode ${i}`,
                title_japanese: null,
                title_romanji: null,
                aired: null,
                filler: false,
                recap: false,
                episode_number: i,
              });
            }
            return {
              data: eps,
              pagination: {
                last_visible_page: 1,
                has_next_page: false,
                current_page: 1,
                items: { count: eps.length, total: eps.length, per_page: eps.length },
              },
            };
          }
        }
      } catch {
        // Ignore fallback error
      }
      throw primaryErr;
    }
  },

  getRecommendations: (id: number) =>
    fetchApi<ApiResponse<any[]>>(`/anime/${id}/recommendations`, {
      timeoutMs: 12000,
    }),

  getSeasons: (id: number) =>
    fetchApi<ApiResponse<AnimeSeason[]>>(`/anime/${id}/seasons`, {
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
      if (res.servers) {
        res.servers = res.servers.map((s) => ({
          ...s,
          url: rewriteStreamUrlToEdgeProxy(s.url),
          thumbnails: s.thumbnails ? rewriteStreamUrlToEdgeProxy(s.thumbnails) : s.thumbnails,
          subtitles: s.subtitles?.map((sub) => ({
            ...sub,
            url: rewriteStreamUrlToEdgeProxy(sub.url),
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
