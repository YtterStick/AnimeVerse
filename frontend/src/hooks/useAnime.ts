import { useState, useEffect, useCallback, useRef } from "react";
import { animeApi } from "@/lib/api";
import type { Anime, Episode, ApiResponse, AnimeSeason } from "@/types";

// ─── Client-Side SWR Cache ───────────────────────────────────────────────────
// In-memory cache with 10-minute TTL. Provides instant page loads when
// revisiting anime that were already fetched, without hitting the backend.
const swrCache = new Map<string, { data: unknown; ts: number }>();
const SWR_TTL = 10 * 60 * 1000; // 10 minutes

function getCached<T>(key: string): T | undefined {
  const entry = swrCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > SWR_TTL) {
    swrCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown) {
  swrCache.set(key, { data, ts: Date.now() });
}

function useAnimeQuery<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  deps: unknown[] = [],
  cacheKey?: string
) {
  const cached = cacheKey ? getCached<T>(cacheKey) : undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // If we have a cache hit, show it instantly but still revalidate in background
    if (cacheKey) {
      const hit = getCached<T>(cacheKey);
      if (hit) {
        setData(hit);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }
    setError(null);

    fetcher()
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          if (cacheKey) setCache(cacheKey, res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          // Only show error if we don't have cached data to show
          if (!getCached<T>(cacheKey || "")) {
            setError(err.message);
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

function usePaginatedAnimeQuery<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [pagination, setPagination] = useState<ApiResponse<T>["pagination"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setPagination(res.pagination || null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, pagination, loading, error };
}

export function useTrending() {
  return useAnimeQuery<Anime[]>(() => animeApi.trending(), [], "trending");
}

export function useTopAiring() {
  return useAnimeQuery<Anime[]>(() => animeApi.topAiring(), [], "top-airing");
}

export function useUpcoming() {
  return useAnimeQuery<Anime[]>(() => animeApi.upcoming(), [], "upcoming");
}

export function usePopular() {
  return useAnimeQuery<Anime[]>(() => animeApi.popular(), [], "popular");
}

export function useTopRated() {
  return useAnimeQuery<Anime[]>(() => animeApi.topRated(), [], "top-rated");
}

export function useAnimeSchedule(day: string) {
  return useAnimeQuery<Anime[]>(() => animeApi.getSchedule(day), [day], `schedule:${day}`);
}

export function useAnimeSearch(
  query: string,
  genres = "",
  page = 1,
  category = ""
) {
  return usePaginatedAnimeQuery<Anime[]>(
    () => {
      // If user selected a direct category without extra query or genres
      if (category === "trending" && !query && !genres) {
        return animeApi.trending(page);
      }
      if (category === "top-airing" && !query && !genres) {
        return animeApi.topAiring(page);
      }
      if (category === "upcoming" && !query && !genres) {
        return animeApi.upcoming(page);
      }
      if (category === "popular" && !query && !genres) {
        return animeApi.popular(page);
      }
      if (category === "top-rated" && !query && !genres) {
        return animeApi.topRated(page);
      }

      // If category has genres or custom filter
      let orderBy = "";
      let status = "";
      if (category === "top-rated") orderBy = "score";
      if (category === "trending") orderBy = "trending";
      if (category === "popular") orderBy = "popularity";
      if (category === "top-airing") status = "airing";
      if (category === "upcoming") status = "upcoming";

      return animeApi.search(query, page, genres, orderBy, status);
    },
    [query, genres, page, category]
  );
}

export function useAnimeDetail(id: number) {
  const cacheKey = `anime-detail:${id}`;
  const cached = getCached<Anime>(cacheKey);
  const [anime, setAnime] = useState<Anime | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<number | undefined>(undefined);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Show cached data instantly if available
    const hit = getCached<Anime>(cacheKey);
    if (hit) {
      setAnime(hit);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    animeApi
      .getById(id)
      .then((res) => {
        if (!cancelled) {
          setAnime(res.data);
          setCache(cacheKey, res.data);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          // Auto-retry up to 2 times with exponential backoff before showing error
          if (retryCount < 2) {
            const delay = 1500 * (retryCount + 1);
            retryTimerRef.current = window.setTimeout(() => {
              if (!cancelled) setRetryCount((c) => c + 1);
            }, delay);
            return;
          }
          // Only show error if we don't have cached data to fall back on
          if (!getCached<Anime>(cacheKey)) {
            setError(err.message);
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
  }, [id, retryCount]);

  // Reset retry count when anime id changes
  useEffect(() => {
    setRetryCount(0);
  }, [id]);

  return { anime, loading, error, retry };
}

export function useAnimeEpisodes(id: number) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let active = true;
    setEpisodes([]);
    setLoading(true);
    setError(null);
    setHasMore(false);

    async function loadAll() {
      let pageNum = 1;
      let hasNext = true;
      const all: Episode[] = [];
      const seenKeys = new Set<string>();

      const addUniqueEpisodes = (items: Episode[]) => {
        for (const item of items) {
          const key = `${item.mal_id ?? "no-id"}-${item.episode_number}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          all.push(item);
        }
      };

      while (hasNext && active) {
        try {
          const res = await animeApi.getEpisodes(id, pageNum);
          if (!active) break;

          const eps = res.data.map((ep, idx) => ({
            ...ep,
            episode_number: ep.mal_id || (pageNum - 1) * 100 + idx + 1,
          }));

          if (eps.length === 0) {
            hasNext = false;
            break;
          }

          addUniqueEpisodes(eps);
          setEpisodes([...all]);

          hasNext = (res.pagination?.has_next_page ?? false) && eps.length > 0;
          setHasMore(hasNext);

          if (hasNext) {
            pageNum++;
            // Throttled delay to respect Jikan's rate limit of 3 requests per second
            await new Promise((resolve) => setTimeout(resolve, 450));
          }
        } catch (err) {
          if (active) {
            setError(null);
            hasNext = false;
          }
        }
      }
      if (active) {
        setLoading(false);
      }
    }

    loadAll();

    return () => {
      active = false;
    };
  }, [id]);

  const loadMore = useCallback(() => {
    // Dummy handler since everything is auto-loaded in background
  }, []);

  return { episodes, loading, error, hasMore, loadMore };
}

export function useAnimeRecommendations(id: number) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refetch = useCallback(() => {
    setRetryCount(0);
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    setLoading(true);
    setError(null);

    animeApi
      .getRecommendations(id)
      .then((res) => {
        if (!cancelled) {
          setRecommendations(res.data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (retryCount === 0) {
            retryTimer = window.setTimeout(() => {
              if (!cancelled) {
                setRetryCount(1);
              }
            }, 1200) as unknown as number;
            return;
          }

          setRecommendations([]);
          setError(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [id, retryCount, refreshNonce]);

  useEffect(() => {
    setRetryCount(0);
  }, [id]);

  return { recommendations, loading, error, refetch };
}

export function useAnimeSeasons(id: number) {
  return useAnimeQuery<AnimeSeason[]>(() => animeApi.getSeasons(id), [id], `seasons:${id}`);
}
