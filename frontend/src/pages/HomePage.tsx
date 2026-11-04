import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, History, ChevronRight } from "lucide-react";
import { useTrending, useTopAiring, usePopular } from "@/hooks/useAnime";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { getRecentLocalHistory, isEpisodeFinished } from "@/lib/watchProgress";
import { HeroBanner } from "@/components/anime/HeroBanner";
import { AnimeCarousel } from "@/components/anime/AnimeCarousel";
import { EstimatedSchedule } from "@/components/anime/EstimatedSchedule";
import { formatEpisodeNumber } from "@/lib/utils";

interface ContinueItem {
  id: string | number;
  anime_id: number;
  anime_title: string;
  anime_image: string | null;
  episode_number: number;
  episode_title?: string;
  progress_seconds: number;
  duration_seconds: number;
}

export function HomePage() {
  const { data: trending, loading: trendingLoading } = useTrending();
  const { data: topAiring, loading: topAiringLoading } = useTopAiring();
  const { data: popular, loading: popularLoading } = usePopular();
  const { history } = useWatchHistory();
  const [localHistory, setLocalHistory] = useState(() => getRecentLocalHistory());

  useEffect(() => {
    setLocalHistory(getRecentLocalHistory());
  }, []);

  // Merge local instant progress and cloud history into a unified continue-watching list
  const continueWatchingItems = useMemo<ContinueItem[]>(() => {
    const map = new Map<number, ContinueItem>();

    // 1. Local progress (instant real-time updates across page reloads & guest users)
    for (const item of localHistory) {
      if (item.durationSeconds > 0 && !isEpisodeFinished(item.progressSeconds, item.durationSeconds)) {
        map.set(item.animeId, {
          id: `local-${item.animeId}-${item.episodeNumber}`,
          anime_id: item.animeId,
          anime_title: item.animeTitle || `Anime #${item.animeId}`,
          anime_image: item.animeImage || null,
          episode_number: item.episodeNumber,
          episode_title: `Episode ${item.episodeNumber}`,
          progress_seconds: item.progressSeconds,
          duration_seconds: item.durationSeconds,
        });
      }
    }

    // 2. Cloud database history (for logged in accounts)
    for (const h of history) {
      if (!map.has(h.anime_id) && h.duration_seconds > 0 && !isEpisodeFinished(h.progress_seconds, h.duration_seconds)) {
        map.set(h.anime_id, {
          id: h.id,
          anime_id: h.anime_id,
          anime_title: h.anime_title,
          anime_image: h.anime_image,
          episode_number: h.episode_number,
          episode_title: h.episode_title || `Episode ${h.episode_number}`,
          progress_seconds: h.progress_seconds,
          duration_seconds: h.duration_seconds,
        });
      }
    }

    return Array.from(map.values()).slice(0, 8);
  }, [history, localHistory]);

  return (
    <div className="flex flex-col w-full pb-16 page-enter">
      {/* Featured Anime Slideshow */}
      <HeroBanner trendingList={trending} loading={trendingLoading} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-4 mt-6">
        {/* Continue Watching Section (Instant Local & Cloud Sync) */}
        {continueWatchingItems.length > 0 && (
          <div className="relative my-8 animate-fade-in">
            <div className="flex items-center justify-between mb-4 px-4 md:px-0">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Continue Watching
              </h2>
              <Link
                to="/history"
                className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-semibold transition-colors"
              >
                View All History <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 px-4 md:px-0">
              {continueWatchingItems.map((item) => {
                const progress = item.progress_seconds / item.duration_seconds;
                const progressPct = Math.min(100, Math.max(0, progress * 100));

                return (
                  <Link
                    key={item.id}
                    to={`/watch/${item.anime_id}/${item.episode_number}`}
                    className="group relative flex flex-col bg-card rounded-lg overflow-hidden border border-border/40 shadow-sm card-hover"
                  >
                    <div className="aspect-[16/9] w-full relative overflow-hidden bg-muted">
                      <img
                        src={item.anime_image || "/placeholder-anime.jpg"}
                        alt={item.anime_title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>

                    <div className="p-3">
                      <h3 className="text-xs font-semibold leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                        {item.anime_title}
                      </h3>
                      <p className="text-[10px] font-medium text-muted-foreground mt-1">
                        {formatEpisodeNumber(item.episode_number)} — {item.episode_title}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 bg-secondary w-full">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Anime Rows */}
        <AnimeCarousel title="Trending Now" animeList={trending} loading={trendingLoading} />
        <AnimeCarousel title="Top Airing" animeList={topAiring} loading={topAiringLoading} />
        <AnimeCarousel title="Most Popular" animeList={popular} loading={popularLoading} />

        {/* Estimated Broadcast Schedule */}
        <EstimatedSchedule />
      </div>
    </div>
  );
}

export default HomePage;
