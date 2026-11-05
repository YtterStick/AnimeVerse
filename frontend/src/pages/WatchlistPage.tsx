import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchlist } from "@/hooks/useWatchHistory";
import { AnimeGrid } from "@/components/anime/AnimeGrid";
import { Button } from "@/components/ui/button";
import { Heart, Compass, Sparkles } from "lucide-react";
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

  // Normalize watchlist records to Anime cards type layout
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
      <div className="border-b border-border/20 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Heart className="w-7 h-7 text-primary fill-primary" />
            My Watchlist
            {watchlist.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {watchlist.length} {watchlist.length === 1 ? "anime" : "titles"}
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Your saved anime series, movies, and upcoming airings.
          </p>
        </div>

        {!user && watchlist.length > 0 && (
          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 border border-border/60 rounded-full px-3 py-1 self-start sm:self-auto">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Saved on this device. Sign in to sync across devices.</span>
          </div>
        )}
      </div>

      <div className="flex-1">
        {watchlistLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : normalizedAnimeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-secondary/60 flex items-center justify-center border border-border/40">
              <Heart className="w-8 h-8 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-white">Your Watchlist is Empty</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Explore anime series in Discover or Search and click &ldquo;Add to Watchlist&rdquo; to save them here.
              </p>
            </div>
            <Button asChild className="rounded-full bg-primary hover:bg-primary/90 text-white font-semibold px-6 shadow-md shadow-primary/20">
              <Link to="/search" className="flex items-center gap-2">
                <Compass className="w-4 h-4" />
                <span>Discover Anime</span>
              </Link>
            </Button>
          </div>
        ) : (
          <AnimeGrid animeList={normalizedAnimeList} loading={false} />
        )}
      </div>
    </div>
  );
}

export default WatchlistPage;
