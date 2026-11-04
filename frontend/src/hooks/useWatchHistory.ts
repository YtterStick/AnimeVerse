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

  return { history, loading, refetch: fetchHistory };
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
