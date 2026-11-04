/**
 * Local Watch Progress & Resume Cache
 *
 * Provides instantaneous, synchronous progress recovery across page reloads
 * and offline/unauthenticated viewing sessions.
 */

export interface LocalWatchProgress {
  animeId: number;
  animeTitle?: string;
  animeImage?: string | null;
  episodeNumber: number;
  progressSeconds: number;
  durationSeconds: number;
  updatedAt: number;
}

const STORAGE_KEY_PREFIX = "aniverse:progress:";
const LAST_WATCHED_PREFIX = "aniverse:lastWatched:";
const RECENT_LIST_KEY = "aniverse:recentProgress";

/**
 * Check if the episode is considered fully watched (e.g. within 30s of ending or >95%).
 * Completed episodes should not auto-resume in the middle of ending credits.
 */
export function isEpisodeFinished(progress: number, duration: number): boolean {
  if (!duration || duration <= 0) return false;
  if (duration - progress < 30) return true;
  if (duration > 60 && progress / duration > 0.95) return true;
  return false;
}

/**
 * Retrieve saved progress for a specific episode synchronously.
 */
export function getLocalEpisodeProgress(
  animeId: number,
  episodeNumber: number
): LocalWatchProgress | null {
  if (!animeId || !episodeNumber) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${animeId}:${episodeNumber}`);
    if (!raw) return null;
    const parsed: LocalWatchProgress = JSON.parse(raw);
    if (typeof parsed.progressSeconds !== "number" || parsed.progressSeconds <= 3) {
      return null;
    }
    // If finished, reset so user starts at beginning
    if (isEpisodeFinished(parsed.progressSeconds, parsed.durationSeconds)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save progress for a specific episode synchronously into localStorage.
 */
export function saveLocalEpisodeProgress(data: {
  animeId: number;
  episodeNumber: number;
  progressSeconds: number;
  durationSeconds: number;
  animeTitle?: string;
  animeImage?: string | null;
}): void {
  const { animeId, episodeNumber, progressSeconds, durationSeconds, animeTitle, animeImage } = data;
  if (!animeId || !episodeNumber) return;

  const entry: LocalWatchProgress = {
    animeId,
    episodeNumber,
    progressSeconds: Math.floor(progressSeconds),
    durationSeconds: Math.floor(durationSeconds),
    animeTitle,
    animeImage,
    updatedAt: Date.now(),
  };

  try {
    // 1. Per-episode key for instant lookup on refresh
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${animeId}:${episodeNumber}`,
      JSON.stringify(entry)
    );

    // 2. Per-anime last-watched episode pointer
    localStorage.setItem(
      `${LAST_WATCHED_PREFIX}${animeId}`,
      JSON.stringify(entry)
    );

    // 3. Maintain global recent watch list (capped at 30 items)
    const rawList = localStorage.getItem(RECENT_LIST_KEY);
    let list: LocalWatchProgress[] = rawList ? JSON.parse(rawList) : [];
    list = list.filter((item) => !(item.animeId === animeId && item.episodeNumber === episodeNumber));
    list.unshift(entry);
    if (list.length > 30) list = list.slice(0, 30);
    localStorage.setItem(RECENT_LIST_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors in private browsing
  }
}

/**
 * Retrieve the last watched episode and progress for an anime.
 */
export function getLocalLastWatched(animeId: number): LocalWatchProgress | null {
  if (!animeId) return null;
  try {
    const raw = localStorage.getItem(`${LAST_WATCHED_PREFIX}${animeId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Retrieve recent watch history list (fallback / guest mode).
 */
export function getRecentLocalHistory(): LocalWatchProgress[] {
  try {
    const raw = localStorage.getItem(RECENT_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

