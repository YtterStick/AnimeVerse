import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchlist } from "@/hooks/useWatchHistory";
import { AnimeGrid } from "@/components/anime/AnimeGrid";
import { Button } from "@/components/ui/button";
import { Heart, Lock } from "lucide-react";
import type { Anime } from "@/types";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { Skeleton } from "@/components/ui/skeleton";

export function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();
  const { watchlist, loading: watchlistLoading } = useWatchlist();

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full space-y-6 flex-1">
        <Skeleton className="h-8 w-1/4 bg-card" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // 1. Guard check for unauthenticated users
  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 w-full flex-1 flex flex-col items-center justify-center text-center space-y-5 page-enter">
        <div className="w-16 h-16 rounded-full bg-secondary/80 flex items-center justify-center border border-border">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white">Watchlist Private</h1>
          <p className="text-sm text-muted-foreground/80 max-w-sm">
            Please sign in to your account to view or add series to your personal watchlist database.
          </p>
        </div>
        <Button asChild className="rounded-full bg-primary hover:bg-primary/95 text-white font-semibold px-6 shadow-lg shadow-primary/10">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  // 2. Normalize database watchlists records to Anime cards type layout
  const normalizedAnimeList: Anime[] = watchlist.map((item) => ({
    mal_id: item.anime_id,
    title: item.anime_title,
    title_english: null,
    title_japanese: null,
    synopsis: null,
    type: item.anime_type,
    episodes: null,
    status: null,
    score: null,
    scored_by: null,
    rank: null,
    popularity: null,
    members: null,
    rating: null,
    season: null,
    year: null,
    studios: [],
    genres: [],
    images: {
      jpg: {
        image_url: item.anime_image || "",
        small_image_url: "",
        large_image_url: item.anime_image || "",
      },
      webp: {
        image_url: item.anime_image || "",
        small_image_url: "",
        large_image_url: item.anime_image || "",
      },
    },
    trailer: null,
    duration: null,
    source: null,
    aired: null,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full space-y-6 flex-1 flex flex-col page-enter">
      <div className="border-b border-border/20 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
          <Heart className="w-7 h-7 text-primary fill-primary" />
          My Watchlist
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Your bookmarked anime series, movies, and upcoming airings.
        </p>
      </div>

      <div className="flex-1">
        {watchlistLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <AnimeGrid animeList={normalizedAnimeList} loading={false} />
        )}
      </div>
    </div>
  );
}

export default WatchlistPage;
