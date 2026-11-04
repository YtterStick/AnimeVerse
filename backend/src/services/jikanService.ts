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
    genres: (media.genres || []).map((g: string, idx: number) => ({
      mal_id: idx + 1,
      name: g,
      type: "anime",
    })),
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

async function queryAniList(query: string, variables: Record<string, any>): Promise<any> {
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

  // If Jikan recently timed out, go straight to fallback to keep UI instant
  if (Date.now() < jikanDownUntil && fallbackFn) {
    const fbData = await fallbackFn();
    cache.set(cacheKey, fbData);
    return fbData;
  }

  try {
    const data = await jikanQueue.enqueue(async () => {
      const doubleCheck = cache.get<T>(cacheKey);
      if (doubleCheck) return doubleCheck;

      const response = await axios.get(`${JIKAN_BASE_URL}${endpoint}`, {
        params,
        timeout: 4000,
      });
      return response.data as T;
    });

    cache.set(cacheKey, data);
    return data;
  } catch (error: any) {
    const isRateLimited = error.response?.status === 429;
    const isTimeout = error.code === "ETIMEDOUT" || error.code === "ECONNABORTED";
    const isServerError = !error.response || error.response?.status >= 500;

    if (isRateLimited || isTimeout || isServerError) {
      // Mark Jikan as down/rate-limited for 60s so all queries use instant AniList fallback
      jikanDownUntil = Date.now() + 60_000;
    }
    if (fallbackFn) {
      try {
        console.warn(`[MetadataService] Jikan returned ${error.response?.status || error.code} on ${endpoint}, using AniList fallback`);
        const fbData = await fallbackFn();
        cache.set(cacheKey, fbData);
        return fbData;
      } catch (fbErr: any) {
        console.error(`[MetadataService] AniList fallback also failed:`, fbErr.message);
      }
    }
    throw error;
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

async function fetchAniListMediaList(
  sort: string[],
  page: number,
  perPage = 25,
  extraVars: Record<string, any> = {}
) {
  const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $search: String, $genre_in: [String]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          perPage
          currentPage
          lastPage
          hasNextPage
        }
        media(type: ANIME, isAdult: false, sort: $sort, status: $status, search: $search, genre_in: $genre_in) {
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
  const mediaList = (data?.Page?.media || []).filter((m: any) => m.idMal);

  return {
    data: mediaList.map(mapAniListMediaToJikan),
    pagination: {
      last_visible_page: pageInfo.lastPage || 1,
      has_next_page: Boolean(pageInfo.hasNextPage),
      current_page: pageInfo.currentPage || page,
      items: {
        count: mediaList.length,
        total: pageInfo.total || mediaList.length,
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
  searchAnime: async (query: string, page = 1, genres = "") => {
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
    } else {
      jikanParams.order_by = "popularity";
      jikanParams.sort = "desc";
    }

    if (genreIds.length > 0) {
      jikanParams.genres = genreIds.join(",");
    }

    const extraVars: Record<string, any> = {};
    if (trimmed) extraVars.search = trimmed;
    if (genreNames.length > 0) extraVars.genre_in = genreNames;

    return executeJikanRequest<any>(
      "/anime",
      jikanParams,
      () =>
        fetchAniListMediaList(
          ["POPULARITY_DESC", "SCORE_DESC"],
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
          const m = String(se.title || "").match(/Episode\s+(\d+)\s*[-–:]?\s*(.*)/i);
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
