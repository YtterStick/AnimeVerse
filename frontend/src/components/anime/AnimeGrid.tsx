import type { Anime } from "@/types";
import { AnimeCard } from "./AnimeCard";
import { SkeletonCard } from "../shared/SkeletonCard";

interface AnimeGridProps {
  animeList: Anime[] | null;
  loading: boolean;
}

export function AnimeGrid({ animeList, loading }: AnimeGridProps) {
  if (loading || animeList === null) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (animeList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-lg font-medium text-muted-foreground">No anime found matching your criteria.</p>
        <p className="text-sm text-muted-foreground/60 mt-1">Try tweaking your search term or exploring trending titles.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 animate-fade-in">
      {animeList.map((anime) => (
        <AnimeCard key={anime.mal_id} anime={anime} />
      ))}
    </div>
  );
}

export default AnimeGrid;
