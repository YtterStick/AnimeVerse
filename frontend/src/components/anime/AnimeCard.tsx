import { Link } from "react-router-dom";
import { Star, Play, CalendarDays } from "lucide-react";
import type { Anime } from "@/types";
import { formatScore } from "@/lib/utils";
import { useTitleLanguage } from "@/contexts/TitleLanguageContext";

interface AnimeCardProps {
  anime: Anime;
}

export function AnimeCard({ anime }: AnimeCardProps) {
  const { formatTitle } = useTitleLanguage();
  const title = formatTitle(anime);
  const image = anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url;
  const score = anime.score;
  const type = anime.type;
  const isUpcoming =
    anime.status === "Not yet aired" ||
    anime.status === "Upcoming" ||
    anime.status === "NOT_YET_RELEASED";

  return (
    <Link
      to={`/anime/${anime.mal_id}`}
      className="group relative flex flex-col w-full bg-card rounded-xl overflow-hidden shadow-md card-hover border border-border/40"
    >
      {/* Poster Image Container */}
      <div className="aspect-[2/3] w-full relative overflow-hidden bg-muted">
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Dark overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
          {type && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-black/75 text-white border border-white/10 backdrop-blur-sm">
              {type}
            </span>
          )}
          {score !== null && score > 0 ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 bg-primary text-white border border-primary/20 shadow-md backdrop-blur-sm">
              <Star className="w-3 h-3 fill-white" />
              {formatScore(score)}
            </span>
          ) : isUpcoming ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 bg-amber-500/90 text-black border border-amber-400/40 shadow-md backdrop-blur-sm">
              <CalendarDays className="w-3 h-3 text-black" />
              {anime.year ? `${anime.season ? `${anime.season} ` : ""}${anime.year}` : "Upcoming"}
            </span>
          ) : null}
        </div>
      </div>

      {/* Info Content */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors duration-200">
          {title}
        </h3>
        {anime.genres && anime.genres.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
            {anime.genres.slice(0, 2).map((g) => g.name).join(" • ")}
          </p>
        )}
      </div>
    </Link>
  );
}

export default AnimeCard;
