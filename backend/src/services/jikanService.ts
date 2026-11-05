import axios from "axios";
import NodeCache from "node-cache";

// Cache for API responses (15 minutes TTL, check period every 1 minute)
const cache = new NodeCache({ stdTTL: 900, checkperiod: 60 });

const JIKAN_BASE_URL = "https://api.jikan.moe/v4";
const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";

// Track if Jikan is currently unreachable so we don't wait 4s on every request during an outage
let jikanDownUntil = 0;

// Jikan rate limiting queue (Jikan rate limits to 3 requests per second)
class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private minInterval = 350;

  enqueue<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      const delay = Math.max(0, this.minInterval - timeSinceLast);

      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      const task = this.queue.shift();
      if (task) {
        this.lastRequestTime = Date.now();
        await task();
      }
    }

    this.processing = false;
  }
}

const jikanQueue = new RequestQueue();

const ANILIST_MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  synonyms
  description(asHtml: false)
  format
  episodes
  status
  averageScore
  popularity
  favourites
  season
  seasonYear
  duration
  source
  genres
  isAdult
  tags {
    name
    rank
    isMediaSpoiler
  }
  startDate {
    year
    month
    day
  }
  endDate {
    year
    month
    day
  }
  coverImage {
    extraLarge
    large
    medium
  }
  bannerImage
  trailer {
    id
    site
  }
  studios(isMain: true) {
    nodes {
      id
      name
    }
  }
`;

function stripHtml(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function mapAniListStatus(status: string | null | undefined): string {
  switch (status) {
    case "RELEASING":
      return "Currently Airing";
    case "FINISHED":
      return "Finished Airing";
    case "NOT_YET_RELEASED":
      return "Not yet aired";
    default:
      return status || "Unknown";
  }
}

function formatAniListDate(dateObj: { year?: number; month?: number; day?: number } | null | undefined): string | null {
  if (!dateObj?.year) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = dateObj.month ? months[dateObj.month - 1] : "";
  const d = dateObj.day ? ` ${dateObj.day},` : "";
  return `${m}${d} ${dateObj.year}`.trim();
}

function mapAniListMediaToJikan(media: any): any {
  const largeImg = media.coverImage?.extraLarge || media.coverImage?.large || "";
  const medImg = media.coverImage?.large || media.coverImage?.medium || largeImg;
  const smallImg = media.coverImage?.medium || medImg;

  const fromStr = formatAniListDate(media.startDate);
  const toStr = formatAniListDate(media.endDate);
  const airedString = fromStr ? (toStr ? `${fromStr} to ${toStr}` : `${fromStr} to ?`) : "N/A";

  const relations: any[] = [];
  if (media.relations?.edges?.length) {
    const grouped: Record<string, any[]> = {};
    for (const edge of media.relations.edges) {
      if (!edge?.node?.idMal) continue;
      const relType = (edge.relationType || "RELATED").replace(/_/g, " ");
      if (!grouped[relType]) grouped[relType] = [];
      grouped[relType].push({
        mal_id: edge.node.idMal,
        type: (edge.node.type || "anime").toLowerCase(),
        name: edge.node.title?.english || edge.node.title?.romaji || "Related Anime",
        url: "",
      });
    }
    for (const [relation, entry] of Object.entries(grouped)) {
      relations.push({ relation, entry });
    }
  }

  return {
    mal_id: media.idMal || media.id,
    anilist_id: media.id,
    title: media.title?.romaji || media.title?.english || "Unknown Title",
    title_english: media.title?.english || null,
    title_japanese: media.title?.native || null,
    title_synonyms: Array.isArray(media.synonyms) ? media.synonyms : [],
    synopsis: stripHtml(media.description),
    type: media.format || "TV",
    episodes: media.episodes || null,
    status: mapAniListStatus(media.status),
    score: media.averageScore ? Number((media.averageScore / 10).toFixed(2)) : null,
    scored_by: media.popularity || null,
    rank: null,
    popularity: media.popularity || null,
    members: media.popularity || null,
    rating: media.isAdult ? "R+ - Mild Nudity" : "PG-13 - Teens 13 or older",
    season: media.season ? media.season.toLowerCase() : null,
    year: media.seasonYear || media.startDate?.year || null,
    studios: (media.studios?.nodes || []).map((s: any) => ({
      mal_id: s.id,
      name: s.name,
      type: "anime",
    })),
    genres: (() => {
      const rawGenres = (media.genres || []).map((g: string, idx: number) => ({
        mal_id: idx + 1,
        name: g,
        type: "anime",
      }));
      const notableThemes = new Set([
        "isekai",
        "reincarnation",
        "time travel",
        "cyberpunk",
        "post-apocalyptic",
        "supernatural",
        "military",
        "magic",
        "school",
        "martial arts",
        "survival",
      ]);
      const tagGenres = (media.tags || [])
        .filter(
          (t: any) =>
            !t.isMediaSpoiler &&
            (t.rank >= 60 || notableThemes.has((t.name || "").toLowerCase()))
        )
        .map((t: any, idx: number) => ({
          mal_id: 1000 + idx,
          name: t.name,
          type: "anime",
        }));
      const merged: any[] = [];
      const seen = new Set<string>();
      for (const g of [...rawGenres, ...tagGenres]) {
        const key = (g.name || "").toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          merged.push(g);
        }
      }
      return merged;
    })(),
    images: {
      jpg: {
        image_url: medImg,
        small_image_url: smallImg,
        large_image_url: largeImg,
      },
      webp: {
        image_url: medImg,
        small_image_url: smallImg,
        large_image_url: largeImg,
      },
    },
    trailer:
      media.trailer?.site === "youtube" && media.trailer?.id
        ? {
            youtube_id: media.trailer.id,
            url: `https://www.youtube.com/watch?v=${media.trailer.id}`,
          }
        : null,
    duration: media.duration ? `${media.duration} min per ep` : null,
    source: media.source ? media.source.replace(/_/g, " ") : null,
    aired: {
      from: fromStr,
      to: toStr,
      string: airedString,
    },
    relations,
  };
}

function normalizeJikanAnime(item: any): any {
  if (!item || typeof item !== "object") return item;
  if (Array.isArray(item.themes) || Array.isArray(item.demographics)) {
    const existing = new Set((item.genres || []).map((g: any) => (g.name || "").toLowerCase()));
    const extras = [...(item.themes || []), ...(item.demographics || [])];
    const combined = [...(item.genres || [])];
    for (const extra of extras) {
      const nameKey = (extra.name || "").toLowerCase();
      if (nameKey && !existing.has(nameKey)) {
        existing.add(nameKey);
        combined.push(extra);
      }
    }
    item.genres = combined;
  }
  return item;
}

function normalizeJikanPayload<T>(raw: T): T {
  if (!raw || typeof raw !== "object") return raw;
  const anyRaw = raw as any;
  if (Array.isArray(anyRaw.data)) {
    anyRaw.data = anyRaw.data.map(normalizeJikanAnime);
  } else if (anyRaw.data && typeof anyRaw.data === "object") {
    anyRaw.data = normalizeJikanAnime(anyRaw.data);
  }
  return anyRaw as T;
}

// Long-lived "last known good" cache (24h). Served when every upstream fails so users
// never see raw network errors during short AniList/Jikan hiccups.
const staleCache = new NodeCache({ stdTTL: 86_400, checkperiod: 600, maxKeys: 5000 });

// De-duplicate identical concurrent requests (rapid clicks / reloads hit upstream only once)
const inFlight = new Map<string, Promise<any>>();

// When AniList returns 429, pause all AniList calls until this timestamp
let aniListCooldownUntil = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class UpstreamUnavailableError extends Error {
  status = 503;
  constructor() {
    super("Anime data source is temporarily busy. Please try again in a few seconds.");
  }
}

async function queryAniList(query: string, variables: Record<string, any>): Promise<any> {
  const MAX_ATTEMPTS = 3;
  let lastErr: any;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const wait = aniListCooldownUntil - Date.now();
    if (wait > 0) await sleep(Math.min(wait, 4000));

    try {
      const response = await axios.post(
        ANILIST_GRAPHQL_URL,
        { query, variables },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 7000,
        }
      );
      return response.data?.data;
    } catch (err: any) {
      lastErr = err;
      const status = err.response?.status;
      if (status === 429) {
        const retryAfter = parseInt(err.response?.headers?.["retry-after"] || "2", 10);
        const backoffMs = Math.min(Math.max(retryAfter, 1) * 1000, 4000);
        aniListCooldownUntil = Date.now() + backoffMs;
        console.warn(`[AniList] 429 rate limited, retry ${attempt}/${MAX_ATTEMPTS} in ${backoffMs}ms`);
        continue;
      }
      const transient =
        !err.response || status >= 500 || err.code === "ECONNABORTED" || err.code === "ETIMEDOUT";
      if (transient && attempt < MAX_ATTEMPTS) {
        await sleep(400 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function executeJikanRequest<T>(
  endpoint: string,
  params: Record<string, any> = {},
  fallbackFn?: () => Promise<T>
): Promise<T> {
  const cacheKey = `jikan:${endpoint}?${JSON.stringify(params)}`;
  const cachedData = cache.get<T>(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const pending = inFlight.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const task = (async (): Promise<T> => {
    const store = (data: T) => {
      cache.set(cacheKey, data);
      staleCache.set(cacheKey, data);
      return data;
    };

    // 1) AniList primary (fast, reachable from Render)
    if (fallbackFn) {
      try {
        return store(await fallbackFn());
      } catch (fbErr: any) {
        console.warn(`[MetadataService] AniList failed for ${endpoint}:`, fbErr.message);
      }
    }

    // 2) Jikan secondary — skipped while it is known to be unreachable from this host
    if (Date.now() >= jikanDownUntil) {
      try {
        const data = await jikanQueue.enqueue(async () => {
          const response = await axios.get(`${JIKAN_BASE_URL}${endpoint}`, {
            params,
            timeout: 4000,
          });
          return normalizeJikanPayload(response.data as T);
        });
        return store(data);
      } catch (error: any) {
        const status = error.response?.status;
        if (!error.response || status === 429 || status >= 500) {
          // Mark Jikan as down for 5 minutes so we don't wait on it again
          jikanDownUntil = Date.now() + 300_000;
        }
        console.warn(`[MetadataService] Jikan failed for ${endpoint}:`, error.code || status);
      }
    }

    // 3) Last known good data
    const stale = staleCache.get<T>(cacheKey);
    if (stale) {
      console.warn(`[MetadataService] Serving stale cache for ${endpoint}`);
      return stale;
    }

    throw new UpstreamUnavailableError();
  })();

  inFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlight.delete(cacheKey);
  }
}

export const GENRE_MAP: Record<string, number> = {
  Action: 1,
  Adventure: 2,
  Comedy: 4,
  Drama: 8,
  Fantasy: 10,
  Horror: 14,
  Mystery: 7,
  Romance: 22,
  "Sci-Fi": 24,
  "Slice of Life": 36,
  Sports: 30,
  Supernatural: 37,
  Suspense: 41,
  Psychological: 40,
  Mecha: 18,
  Music: 19,
  Isekai: 62,
};

export const ID_TO_GENRE: Record<number, string> = {
  1: "Action",
  2: "Adventure",
  4: "Comedy",
  8: "Drama",
  10: "Fantasy",
  14: "Horror",
  7: "Mystery",
  22: "Romance",
  24: "Sci-Fi",
  36: "Slice of Life",
  30: "Sports",
  37: "Supernatural",
  41: "Suspense",
  40: "Psychological",
  18: "Mecha",
  19: "Music",
  62: "Isekai",
};

export const ANILIST_BASE_GENRES = new Set([
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
]);

async function fetchAniListMediaList(
  sort: string[],
  page: number,
  perPage = 25,
  extraVars: Record<string, any> = {}
) {
  const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $search: String, $genre_in: [String], $tag_in: [String]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          perPage
          currentPage
          lastPage
          hasNextPage
        }
        media(type: ANIME, isAdult: false, sort: $sort, status: $status, search: $search, genre_in: $genre_in, tag_in: $tag_in) {
          ${ANILIST_MEDIA_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList(query, {
    page,
    perPage,
    sort,
    ...extraVars,
  });

  const pageInfo = data?.Page?.pageInfo || {};
  const rawMedia = data?.Page?.media || [];
  const mediaList = rawMedia.filter((m: any) => m && (m.idMal || m.id));

  const itemsCount = mediaList.length;
  // Next page is definitively present only when a full page of items was returned and AniList confirms hasNextPage
  const hasNextPage = itemsCount === perPage && Boolean(pageInfo.hasNextPage);

  let lastVisiblePage = page;
  if (!hasNextPage) {
    lastVisiblePage = Math.max(1, page);
  } else if (pageInfo.total && pageInfo.total > 0 && pageInfo.total < 5000) {
    // If exact total is known and under AniList's 5000 estimation ceiling
    lastVisiblePage = Math.max(page, Math.ceil(pageInfo.total / perPage));
  } else {
    // For large collections or uncapped queries, expose page + 1 dynamically
    lastVisiblePage = page + 1;
  }

  return {
    data: mediaList.map(mapAniListMediaToJikan),
    pagination: {
      last_visible_page: lastVisiblePage,
      has_next_page: hasNextPage,
      current_page: pageInfo.currentPage || page,
      items: {
        count: itemsCount,
        total: pageInfo.total && pageInfo.total < 5000 ? pageInfo.total : undefined,
        per_page: pageInfo.perPage || perPage,
      },
    },
  };
}

async function fetchAniListSchedule(day: string) {
  const DAY_INDEX: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDayIdx = DAY_INDEX[day.toLowerCase()] ?? 1;
  const now = new Date();
  const currentDayIdx = now.getUTCDay();

  let diff = targetDayIdx - currentDayIdx;
  const targetDate = new Date(now);
  targetDate.setUTCDate(now.getUTCDate() + diff);
  targetDate.setUTCHours(0, 0, 0, 0);

  const startTimestamp = Math.floor(targetDate.getTime() / 1000) - 86400;
  const endTimestamp = startTimestamp + 2 * 86400;

  const query = `
    query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          airingAt
          timeUntilAiring
          episode
          media {
            ${ANILIST_MEDIA_FIELDS}
            countryOfOrigin
          }
        }
      }
    }
  `;

  const data = await queryAniList(query, { start: startTimestamp, end: endTimestamp });
  const rawSchedules = data?.Page?.airingSchedules || [];
  const dayNamePrefix = day.slice(0, 3).toLowerCase();

  const filtered = rawSchedules
    .filter((item: any) => {
      if (!item?.media?.idMal && !item?.media?.id) return false;
      if (item?.media?.isAdult) return false;
      if (item?.media?.countryOfOrigin && item?.media?.countryOfOrigin !== "JP") return false;
      const d = new Date(item.airingAt * 1000);
      const jstDay = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Tokyo" }).toLowerCase();
      return jstDay === dayNamePrefix;
    })
    .map((item: any) => {
      const d = new Date(item.airingAt * 1000);
      const timeJST = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      });
      const dayJST = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Tokyo" });
      const base = mapAniListMediaToJikan(item.media);

      return {
        ...base,
        broadcast: {
          day: dayJST,
          time: timeJST,
          timezone: "Asia/Tokyo",
          string: `${dayJST} at ${timeJST} (JST)`,
        },
        airing_at: item.airingAt,
        episode: item.episode,
      };
    });

  return {
    data: filtered,
    pagination: {
      last_visible_page: 1,
      has_next_page: false,
      current_page: 1,
      items: {
        count: filtered.length,
        total: filtered.length,
        per_page: 50,
      },
    },
  };
}

export const jikanService = {
  // Search for anime (supports text query and multi-genre filtering)
  searchAnime: async (
    query: string,
    page = 1,
    genres = "",
    orderBy = "",
    status = ""
  ) => {
    const trimmed = query.trim();
    const tokens = genres
      ? genres
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const genreIds: number[] = [];
    const genreNames: string[] = [];

    for (const t of tokens) {
      const num = parseInt(t, 10);
      if (!isNaN(num) && ID_TO_GENRE[num]) {
        genreIds.push(num);
        genreNames.push(ID_TO_GENRE[num]);
      } else if (GENRE_MAP[t]) {
        genreIds.push(GENRE_MAP[t]);
        genreNames.push(t);
      } else if (t) {
        genreNames.push(t);
      }
    }

    const jikanParams: Record<string, any> = { page, limit: 25 };
    if (trimmed) {
      jikanParams.q = trimmed;
    } else if (orderBy === "score") {
      jikanParams.order_by = "score";
      jikanParams.sort = "desc";
    } else {
      jikanParams.order_by = "popularity";
      jikanParams.sort = "desc";
    }

    if (status === "airing") {
      jikanParams.status = "airing";
    } else if (status === "upcoming") {
      jikanParams.status = "upcoming";
    }

    if (genreIds.length > 0) {
      jikanParams.genres = genreIds.join(",");
    }

    const extraVars: Record<string, any> = {};
    if (trimmed) extraVars.search = trimmed;
    if (status === "airing") {
      extraVars.status = "RELEASING";
    } else if (status === "upcoming") {
      extraVars.status = "NOT_YET_RELEASED";
    }

    const anilistGenreIn: string[] = [];
    const anilistTagIn: string[] = [];

    for (const name of genreNames) {
      if (ANILIST_BASE_GENRES.has(name)) {
        anilistGenreIn.push(name);
      } else if (name.toLowerCase() === "suspense") {
        anilistGenreIn.push("Thriller");
      } else {
        // Tag/theme on AniList (e.g. "Isekai")
        anilistTagIn.push(name);
      }
    }

    if (anilistGenreIn.length > 0) extraVars.genre_in = anilistGenreIn;
    if (anilistTagIn.length > 0) extraVars.tag_in = anilistTagIn;

    const aniListSort =
      orderBy === "score"
        ? ["SCORE_DESC", "POPULARITY_DESC"]
        : orderBy === "trending"
        ? ["TRENDING_DESC", "POPULARITY_DESC"]
        : ["POPULARITY_DESC", "SCORE_DESC"];

    return executeJikanRequest<any>(
      "/anime",
      jikanParams,
      () =>
        fetchAniListMediaList(
          aniListSort,
          page,
          25,
          extraVars
        )
    );
  },

  // Get top rated anime
  getTopRated: async (page = 1) => {
    return executeJikanRequest<any>(
      "/top/anime",
      { page, limit: 25 },
      () => fetchAniListMediaList(["SCORE_DESC", "POPULARITY_DESC"], page, 25)
    );
  },

  // Get currently airing (Trending / Season Now)
  getTrending: async (page = 1) => {
    return executeJikanRequest<any>(
      "/seasons/now",
      { page, limit: 25 },
      () => fetchAniListMediaList(["TRENDING_DESC", "POPULARITY_DESC"], page, 25, { status: "RELEASING" })
    );
  },

  // Get top airing
  getTopAiring: async (page = 1) => {
    return executeJikanRequest<any>(
      "/top/anime",
      { filter: "airing", page, limit: 25 },
      () => fetchAniListMediaList(["SCORE_DESC", "POPULARITY_DESC"], page, 25, { status: "RELEASING" })
    );
  },

  // Get upcoming anime releases
  getUpcoming: async (page = 1) => {
    return executeJikanRequest<any>(
      "/seasons/upcoming",
      { page, limit: 25 },
      () =>
        fetchAniListMediaList(
          ["POPULARITY_DESC", "TRENDING_DESC"],
          page,
          25,
          { status: "NOT_YET_RELEASED" }
        )
    );
  },

  // Get popular anime
  getPopular: async (page = 1) => {
    return executeJikanRequest<any>(
      "/top/anime",
      { filter: "bypopularity", page, limit: 25 },
      () => fetchAniListMediaList(["POPULARITY_DESC"], page, 25)
    );
  },

  // Get airing schedule for a given day (e.g. monday, tuesday, etc.)
  getSchedule: async (day = "monday") => {
    const normalizedDay = day.toLowerCase();
    return executeJikanRequest<any>(
      "/schedules",
      { filter: normalizedDay, sfw: true },
      () => fetchAniListSchedule(normalizedDay)
    );
  },

  // Get single anime details by MAL ID
  getAnimeDetails: async (id: number) => {
    return executeJikanRequest<any>(
      `/anime/${id}/full`,
      {},
      async () => {
        const query = `
          query ($idMal: Int) {
            Media(idMal: $idMal, type: ANIME) {
              ${ANILIST_MEDIA_FIELDS}
              relations {
                edges {
                  relationType(version: 2)
                  node {
                    id
                    idMal
                    type
                    title {
                      romaji
                      english
                    }
                  }
                }
              }
            }
          }
        `;
        const data = await queryAniList(query, { idMal: id });
        if (!data?.Media) {
          throw new Error(`Anime ${id} not found`);
        }
        return { data: mapAniListMediaToJikan(data.Media) };
      }
    );
  },

  // Get episode list for an anime
  getAnimeEpisodes: async (id: number, page = 1) => {
    return executeJikanRequest<any>(
      `/anime/${id}/episodes`,
      { page },
      async () => {
        const query = `
          query ($idMal: Int) {
            Media(idMal: $idMal, type: ANIME) {
              id
              idMal
              episodes
              nextAiringEpisode {
                episode
              }
              streamingEpisodes {
                title
                thumbnail
              }
            }
          }
        `;
        const data = await queryAniList(query, { idMal: id });
        const media = data?.Media;
        if (!media) {
          return {
            data: [],
            pagination: { last_visible_page: 1, has_next_page: false, current_page: page },
          };
        }

        // Parse titles from streamingEpisodes if available
        const titleMap = new Map<number, string>();
        for (const se of media.streamingEpisodes || []) {
          const m = String(se.title || "").match(/Episode\s+(\d+)\s*[-â€“:]?\s*(.*)/i);
          if (m) {
            const epNum = parseInt(m[1], 10);
            const epTitle = m[2]?.trim() || `Episode ${epNum}`;
            if (!isNaN(epNum)) {
              titleMap.set(epNum, epTitle);
            }
          }
        }

        const airedCount = media.nextAiringEpisode?.episode
          ? Math.max(1, media.nextAiringEpisode.episode - 1)
          : media.episodes || titleMap.size || 12;

        const totalEpisodes = Math.min(Math.max(airedCount, titleMap.size), 1200);
        const perPage = 100;
        const startEp = (page - 1) * perPage + 1;
        const endEp = Math.min(page * perPage, totalEpisodes);
        const lastPage = Math.max(1, Math.ceil(totalEpisodes / perPage));

        const episodes: any[] = [];
        for (let epNum = startEp; epNum <= endEp; epNum++) {
          episodes.push({
            mal_id: epNum,
            episode_number: epNum,
            title: titleMap.get(epNum) || `Episode ${epNum}`,
            title_japanese: null,
            title_romanji: null,
            aired: null,
            filler: false,
            recap: false,
          });
        }

        return {
          data: episodes,
          pagination: {
            last_visible_page: lastPage,
            has_next_page: page < lastPage,
            current_page: page,
          },
        };
      }
    );
  },

  // Get recommendations for an anime
  getAnimeRecommendations: async (id: number) => {
    return executeJikanRequest<any>(
      `/anime/${id}/recommendations`,
      {},
      async () => {
        const query = `
          query ($idMal: Int) {
            Media(idMal: $idMal, type: ANIME) {
              recommendations(perPage: 15, sort: [RATING_DESC]) {
                nodes {
                  rating
                  mediaRecommendation {
                    id
                    idMal
                    title {
                      romaji
                      english
                    }
                    coverImage {
                      extraLarge
                      large
                      medium
                    }
                  }
                }
              }
            }
          }
        `;
        const data = await queryAniList(query, { idMal: id });
        const nodes = data?.Media?.recommendations?.nodes || [];
        const mapped = nodes
          .filter((n: any) => n?.mediaRecommendation?.idMal)
          .map((n: any) => {
            const rec = n.mediaRecommendation;
            const img = rec.coverImage?.extraLarge || rec.coverImage?.large || rec.coverImage?.medium || "";
            return {
              entry: {
                mal_id: rec.idMal,
                title: rec.title?.english || rec.title?.romaji || "Anime",
                images: {
                  jpg: { image_url: img, small_image_url: img, large_image_url: img },
                  webp: { image_url: img, small_image_url: img, large_image_url: img },
                },
              },
              votes: n.rating || 1,
            };
          });
        return { data: mapped };
      }
    );
  },
};
