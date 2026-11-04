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
      if (!session?.access_token) return;
      try {
        await historyApi.saveProgress(session.access_token, data);
      } catch (err) {
        console.error("Failed to save progress:", err);
      }
    },
    [session?.access_token]
  );

  return { saveProgress, isAuthenticated: !!session };
}

export function useWatchlist() {
  const { session } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await watchlistApi.getWatchlist(session.access_token);
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
      if (!session?.access_token) return;
      try {
        await watchlistApi.addToWatchlist(session.access_token, data);
        await fetchWatchlist();
      } catch (err) {
        console.error("Failed to add to watchlist:", err);
      }
    },
    [session?.access_token, fetchWatchlist]
  );

  const removeFromWatchlist = useCallback(
    async (animeId: number) => {
      if (!session?.access_token) return;
      try {
        await watchlistApi.removeFromWatchlist(session.access_token, animeId);
        setWatchlist((prev) => prev.filter((item) => item.anime_id !== animeId));
      } catch (err) {
        console.error("Failed to remove from watchlist:", err);
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
