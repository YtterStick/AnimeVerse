import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { historyApi, watchlistApi } from "@/lib/api";
import type { WatchHistoryEntry, WatchlistEntry } from "@/types";

export function useWatchHistory() {
  const { session } = useAuth();
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await historyApi.getHistory(session.access_token);
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch watch history:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!session?.access_token) return;
      try {
        await historyApi.deleteEntry(session.access_token, id);
        setHistory((prev) => prev.filter((h) => h.id !== id));
      } catch (err) {
        console.error("Failed to delete history item:", err);
      }
    },
    [session?.access_token]
  );

  const clearHistory = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      await historyApi.clearAll(session.access_token);
      setHistory([]);
    } catch (err) {
      console.error("Failed to clear watch history:", err);
    }
  }, [session?.access_token]);

  return { history, loading, refetch: fetchHistory, deleteEntry, clearHistory };
}

export function useSaveProgress() {
  const { session } = useAuth();

  const saveProgress = useCallback(
    async (data: {
      anime_id: number;
      anime_title: string;
      anime_image: string | null;
      episode_number: number;
      episode_title?: string | null;
      progress_seconds: number;
      duration_seconds: number;
    }) => {
      const numId = Number(data.anime_id);
      const numEp = Number(data.episode_number);
      if (!numId || isNaN(numId) || numId <= 0 || !numEp || isNaN(numEp) || numEp <= 0) {
        return;
      }
      if (!session?.access_token) return;
      try {
        await historyApi.saveProgress(session.access_token, {
          ...data,
          anime_id: numId,
          episode_number: numEp,
        });
      } catch (err) {
        // Local progress is already persisted every 2s; avoid noisy console errors on transient drops
        const msg = err instanceof Error ? err.message : String(err || "");
        if (!/failed to fetch|network|abort|timeout|connection/i.test(msg)) {
          console.warn("Progress sync skipped:", msg);
        }
      }
    },
    [session?.access_token]
  );

  return { saveProgress, isAuthenticated: !!session };
}

const LOCAL_WATCHLIST_KEY = "aniverse:watchlist";

function getLocalWatchlist(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalWatchlist(items: WatchlistEntry[]) {
  try {
    localStorage.setItem(LOCAL_WATCHLIST_KEY, JSON.stringify(items));
  } catch {
    // quota exceeded or private mode
  }
}

export function useWatchlist() {
  const { session } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(() => getLocalWatchlist());
  const [loading, setLoading] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    if (!session?.access_token) {
      setWatchlist(getLocalWatchlist());
      return;
    }
    setLoading(true);
    try {
      let data = await watchlistApi.getWatchlist(session.access_token);

      // Auto-sync guest items from localStorage if user recently logged in
      const local = getLocalWatchlist();
      if (local.length > 0) {
        for (const localItem of local) {
          if (!data.some((r) => r.anime_id === localItem.anime_id)) {
            try {
              const synced = await watchlistApi.addToWatchlist(session.access_token, {
                anime_id: localItem.anime_id,
                anime_title: localItem.anime_title,
                anime_image: localItem.anime_image,
                anime_type: localItem.anime_type,
              });
              data = [synced, ...data];
            } catch (syncErr) {
              console.warn("Failed to sync guest watchlist item:", syncErr);
            }
          }
        }
        localStorage.removeItem(LOCAL_WATCHLIST_KEY);
      }

      setWatchlist(data);
    } catch (err) {
      console.error("Failed to fetch watchlist:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const addToWatchlist = useCallback(
    async (data: {
      anime_id: number;
      anime_title: string;
      anime_image: string | null;
      anime_type: string | null;
    }) => {
      const newEntry: WatchlistEntry = {
        id: `local_${data.anime_id}`,
        user_id: session?.user?.id || "guest",
        anime_id: data.anime_id,
        anime_title: data.anime_title,
        anime_image: data.anime_image,
        anime_type: data.anime_type,
        added_at: new Date().toISOString(),
      };

      // Optimistic update
      setWatchlist((prev) => {
        if (prev.some((item) => item.anime_id === data.anime_id)) return prev;
        const next = [newEntry, ...prev];
        if (!session?.access_token) {
          saveLocalWatchlist(next);
        }
        return next;
      });

      if (session?.access_token) {
        try {
          const saved = await watchlistApi.addToWatchlist(session.access_token, data);
          // Replace optimistic entry with the persisted row
          setWatchlist((prev) =>
            prev.map((item) => (item.anime_id === data.anime_id ? saved : item))
          );
        } catch (err) {
          console.error("Failed to add to watchlist:", err);
          // Roll back so the UI never shows an item that wasn't saved
          setWatchlist((prev) => prev.filter((item) => item.id !== newEntry.id));
          throw err;
        }
      }
    },
    [session?.access_token, session?.user?.id]
  );

  const removeFromWatchlist = useCallback(
    async (animeId: number) => {
      let removed: WatchlistEntry | undefined;
      // Optimistic update
      setWatchlist((prev) => {
        removed = prev.find((item) => item.anime_id === animeId);
        const next = prev.filter((item) => item.anime_id !== animeId);
        if (!session?.access_token) {
          saveLocalWatchlist(next);
        }
        return next;
      });

      if (session?.access_token) {
        try {
          await watchlistApi.removeFromWatchlist(session.access_token, animeId);
        } catch (err) {
          console.error("Failed to remove from watchlist:", err);
          if (removed) {
            const restore = removed;
            setWatchlist((prev) => [restore, ...prev]);
          }
          throw err;
        }
      }
    },
    [session?.access_token]
  );

  const isInWatchlist = useCallback(
    (animeId: number) => watchlist.some((item) => item.anime_id === animeId),
    [watchlist]
  );

  return {
    watchlist,
    loading,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    refetch: fetchWatchlist,
  };
}
