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

/**
 * Remove an episode from local progress and history.
 */
export function removeLocalEpisodeProgress(animeId: number, episodeNumber: number): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${animeId}:${episodeNumber}`);
    const rawList = localStorage.getItem(RECENT_LIST_KEY);
    if (rawList) {
      const list: LocalWatchProgress[] = JSON.parse(rawList);
      const filtered = list.filter(
        (item) => !(item.animeId === animeId && item.episodeNumber === episodeNumber)
      );
      localStorage.setItem(RECENT_LIST_KEY, JSON.stringify(filtered));
    }
  } catch {
    // Ignore
  }
}

/**
 * Clear all local watch history.
 */
export function clearAllLocalHistory(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(STORAGE_KEY_PREFIX) ||
          key.startsWith(LAST_WATCHED_PREFIX) ||
          key === RECENT_LIST_KEY)
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

/**
 * Check whether a specific episode is considered finished / watched
 * or retrieve its partial progress percentage (0 to 1).
 */
export function getEpisodeWatchStatus(
  animeId: number,
  episodeNumber: number,
  historyRecords?: Array<{
    anime_id: number;
    episode_number: number;
    progress_seconds: number;
    duration_seconds?: number;
  }>
): {
  isWatched: boolean;
  progressPercent: number;
} {
  if (!animeId || !episodeNumber) return { isWatched: false, progressPercent: 0 };

  // 1. Check direct localStorage entry
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${animeId}:${episodeNumber}`);
    if (raw) {
      const parsed: LocalWatchProgress = JSON.parse(raw);
      if (
        typeof parsed.progressSeconds === "number" &&
        typeof parsed.durationSeconds === "number"
      ) {
        const { progressSeconds, durationSeconds } = parsed;
        if (durationSeconds > 0) {
          const ratio = progressSeconds / durationSeconds;
          if (
            ratio >= 0.85 ||
            durationSeconds - progressSeconds <= 45 ||
            isEpisodeFinished(progressSeconds, durationSeconds)
          ) {
            return { isWatched: true, progressPercent: 1 };
          }
          if (progressSeconds > 5) {
            return {
              isWatched: false,
              progressPercent: Math.min(1, Math.max(0, ratio)),
            };
          }
        }
      }
    }
  } catch {
    // Ignore parse error
  }

  // 2. Check manual watched toggle
  try {
    const marked = localStorage.getItem(`aniverse:watched:${animeId}:${episodeNumber}`);
    if (marked === "true") {
      return { isWatched: true, progressPercent: 1 };
    }
  } catch {
    // Ignore
  }

  // 3. Check remote history records
  if (historyRecords && historyRecords.length > 0) {
    const record = historyRecords.find(
      (h) => h.anime_id === animeId && h.episode_number === episodeNumber
    );
    if (record) {
      const dur = record.duration_seconds || 1440;
      const ratio = record.progress_seconds / dur;
      if (
        ratio >= 0.85 ||
        dur - record.progress_seconds <= 45 ||
        isEpisodeFinished(record.progress_seconds, dur)
      ) {
        return { isWatched: true, progressPercent: 1 };
      }
      if (record.progress_seconds > 5) {
        return {
          isWatched: false,
          progressPercent: Math.min(1, Math.max(0, ratio)),
        };
      }
    }
  }

  return { isWatched: false, progressPercent: 0 };
}

/**
 * Manually mark an episode as watched or unwatched.
 */
export function markEpisodeWatched(
  animeId: number,
  episodeNumber: number,
  watched = true
): void {
  try {
    if (watched) {
      localStorage.setItem(`aniverse:watched:${animeId}:${episodeNumber}`, "true");
      saveLocalEpisodeProgress({
        animeId,
        episodeNumber,
        progressSeconds: 1440,
        durationSeconds: 1440,
      });
    } else {
      localStorage.removeItem(`aniverse:watched:${animeId}:${episodeNumber}`);
      removeLocalEpisodeProgress(animeId, episodeNumber);
    }
  } catch {
    // Ignore
  }
}


