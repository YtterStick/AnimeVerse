import { useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, Play, Star, ChevronRight } from "lucide-react";
import { useAnimeSchedule } from "@/hooks/useAnime";
import { formatScore } from "@/lib/utils";
import { useTitleLanguage } from "@/contexts/TitleLanguageContext";
import type { Anime } from "@/types";

const DAYS = [
  { id: "monday", label: "MON", full: "Monday" },
  { id: "tuesday", label: "TUE", full: "Tuesday" },
  { id: "wednesday", label: "WED", full: "Wednesday" },
  { id: "thursday", label: "THU", full: "Thursday" },
  { id: "friday", label: "FRI", full: "Friday" },
  { id: "saturday", label: "SAT", full: "Saturday" },
  { id: "sunday", label: "SUN", full: "Sunday" },
];

function getTodayDayId(): string {
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIdx = new Date().getDay();
  return dayNames[dayIdx] || "monday";
}

export function EstimatedSchedule() {
  const { formatTitle } = useTitleLanguage();
  const todayId = getTodayDayId();
  const [selectedDay, setSelectedDay] = useState<string>(todayId);
  const { data: animeList, loading } = useAnimeSchedule(selectedDay);

  const activeDayObj = DAYS.find((d) => d.id === selectedDay) || DAYS[0];

  return (
    <div className="w-full space-y-5 my-10 animate-fade-in">
      {/* Header with Title and Day Navigation */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/30 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Estimated Schedule
            </h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              Airing
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
            <span>Upcoming anime releases and scheduled broadcast times</span>
            <span className="hidden sm:inline-block text-border">•</span>
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-primary/80">
              <Clock className="w-3 h-3" /> Asia/Tokyo (JST)
            </span>
          </p>
        </div>

        {/* Days of the Week Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar scrollbar-none">
          {DAYS.map((day) => {
            const isSelected = day.id === selectedDay;
            const isToday = day.id === todayId;

            return (
              <button
                key={day.id}
                type="button"
                onClick={() => setSelectedDay(day.id)}
                className={`relative px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 border ${
                  isSelected
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/25 scale-105"
                    : "bg-card/60 hover:bg-secondary/70 text-muted-foreground hover:text-white border-border/40"
                }`}
              >
                <div className="flex flex-col items-center">
                  <span>{day.label}</span>
                  {isToday && (
                    <span
                      className={`text-[9px] tracking-tight leading-none mt-0.5 font-extrabold ${
                        isSelected ? "text-white/90" : "text-primary"
                      }`}
                    >
                      Today
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 p-3 rounded-xl border border-border/20 bg-card/40 animate-pulse"
            >
              <div className="w-16 h-22 rounded-lg bg-card/80 shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-4 w-20 bg-card/80 rounded" />
                <div className="h-4 w-5/6 bg-card/80 rounded" />
                <div className="h-3 w-1/2 bg-card/80 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !animeList || animeList.length === 0 ? (
        <div className="text-center py-14 px-4 rounded-2xl border border-border/30 bg-card/20 space-y-3">
          <Clock className="w-10 h-10 text-muted-foreground/60 mx-auto" />
          <h3 className="text-base font-bold text-white">
            No scheduled broadcasts found for {activeDayObj.full}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Check another day of the week above to view upcoming anime release times.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {animeList.map((anime: Anime, idx: number) => {
            const title = formatTitle(anime);
            const image =
              anime.images?.webp?.image_url ||
              anime.images?.jpg?.image_url ||
              anime.images?.webp?.large_image_url ||
              anime.images?.jpg?.large_image_url ||
              "/placeholder-anime.jpg";

            const broadcastTime = anime.broadcast?.time || "TBA";
            const episodeNum = anime.episode;

            return (
              <Link
                key={`${anime.mal_id}-${idx}`}
                to={`/anime/${anime.mal_id}`}
                className="group relative flex items-center gap-3.5 p-3 rounded-2xl border border-border/40 bg-card/50 hover:bg-secondary/40 hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-primary/5 card-hover overflow-hidden"
              >
                {/* Poster Thumbnail */}
                <div className="w-16 sm:w-18 h-22 sm:h-24 rounded-xl overflow-hidden bg-muted shrink-0 relative border border-border/40 group-hover:border-primary/40 transition-colors">
                  <img
                    src={image}
                    alt={title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md">
                      <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Anime Info & Airing Time */}
                <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                  <div className="space-y-1">
                    {/* Time & Episode Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {broadcastTime}
                      </span>

                      {episodeNum && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded-md">
                          Ep. {episodeNum}
                        </span>
                      )}
                    </div>

                    {/* Anime Title */}
                    <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug pt-0.5">
                      {title}
                    </h3>
                  </div>

                  {/* Genres / Score metadata */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 mt-auto">
                    <span className="truncate max-w-[130px]">
                      {anime.genres && anime.genres.length > 0
                        ? anime.genres.slice(0, 2).map((g) => g.name).join(" • ")
                        : "Anime"}
                    </span>

                    {anime.score && anime.score > 0 ? (
                      <span className="flex items-center gap-1 font-bold text-foreground text-[10px] shrink-0 ml-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {formatScore(anime.score)}
                      </span>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EstimatedSchedule;
