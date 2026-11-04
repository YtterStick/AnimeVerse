import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, AlertCircle, ArrowLeft, Play, List, RefreshCw, Layers, Compass, FastForward } from "lucide-react";
import { useAnimeDetail, useAnimeEpisodes, useAnimeRecommendations } from "@/hooks/useAnime";
import { useSaveProgress, useWatchHistory } from "@/hooks/useWatchHistory";
import { streamApi, type SkipInterval } from "@/lib/api";
import { getLocalEpisodeProgress, saveLocalEpisodeProgress, isEpisodeFinished } from "@/lib/watchProgress";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { ServerSelector } from "@/components/player/ServerSelector";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { MultiStreamResult } from "@/types";

export function WatchPage() {
  const { id, episode } = useParams<{ id: string; episode: string }>();
  const animeId = parseInt(id || "", 10);
  const episodeNum = parseInt(episode || "", 10);

  const navigate = useNavigate();
  const { anime, loading: animeLoading } = useAnimeDetail(animeId);
  const { episodes, loading: episodesLoading } = useAnimeEpisodes(animeId);
  const { saveProgress, isAuthenticated } = useSaveProgress();
  const { history } = useWatchHistory();
  const { recommendations, loading: recommendationsLoading, error: recommendationsError, refetch: refetchRecommendations } = useAnimeRecommendations(animeId);

  const [multiStream, setMultiStream] = useState<MultiStreamResult | null>(null);
  const [selectedServer, setSelectedServer] = useState(0);
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [initialTime, setInitialTime] = useState<number>(() => {
    if (!animeId || !episodeNum) return 0;
    const local = getLocalEpisodeProgress(animeId, episodeNum);
    return local ? local.progressSeconds : 0;
  });
  const currentPlaybackTimeRef = useRef<number>(initialTime);
  const currentDurationRef = useRef<number>(0);
  const lastLocalSaveRef = useRef<number>(0);
  const lastRemoteSaveRef = useRef<number>(0);
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);
  const recommendationsScrollRef = useRef<HTMLDivElement>(null);
  const [showRecommendationsLeft, setShowRecommendationsLeft] = useState(false);
  const [showRecommendationsRight, setShowRecommendationsRight] = useState(false);
  const [skips, setSkips] = useState<SkipInterval[]>([]);
  const [autoSkip, setAutoSkip] = useState<boolean>(() => {
    try {
      return localStorage.getItem("aniverse:autoSkip") !== "false";
    } catch {
      return true;
    }
  });

  const toggleAutoSkip = () => {
    setAutoSkip((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("aniverse:autoSkip", String(next));
      } catch {
        // Ignore storage errors (private mode)
      }
      return next;
    });
  };

  // Fetch intro/outro timestamps (AniSkip) for this episode
  useEffect(() => {
    let cancelled = false;
    setSkips([]);
    if (!animeId || !episodeNum) return;
    streamApi.getSkipTimes(animeId, episodeNum).then((res) => {
      if (!cancelled) setSkips(res.skips || []);
    });
    return () => {
      cancelled = true;
    };
  }, [animeId, episodeNum]);

  const updateRecommendationsScrollState = () => {
    const el = recommendationsScrollRef.current;
    if (!el) return;

    setShowRecommendationsLeft(el.scrollLeft > 10);
    setShowRecommendationsRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  const scrollRecommendations = (direction: "left" | "right") => {
    const el = recommendationsScrollRef.current;
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Compute episode ranges of 50 episodes
  const ranges = useMemo(() => {
    const CHUNK_SIZE = 50;
    const list: [number, number][] = [];
    const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number);
    for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
      const start = sorted[i].episode_number;
      const end = sorted[Math.min(i + CHUNK_SIZE - 1, sorted.length - 1)].episode_number;
      list.push([start, end]);
    }
    return list;
  }, [episodes]);

  // Auto-select range index containing the current episode
  useEffect(() => {
    if (ranges.length > 0) {
      const idx = ranges.findIndex(([start, end]) => episodeNum >= start && episodeNum <= end);
      if (idx !== -1) {
        setActiveRangeIndex(idx);
      }
    }
  }, [episodeNum, ranges]);

  // Filter episodes based on active range
  const displayedEpisodes = useMemo(() => {
    const activeRange = ranges[activeRangeIndex];
    const filtered = activeRange
      ? episodes.filter((ep) => ep.episode_number >= activeRange[0] && ep.episode_number <= activeRange[1])
      : episodes;
    return [...filtered].sort((a, b) => a.episode_number - b.episode_number);
  }, [episodes, ranges, activeRangeIndex]);

  useEffect(() => {
    const el = recommendationsScrollRef.current;
    if (!el) return;

    const handleScroll = () => updateRecommendationsScrollState();

    el.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    updateRecommendationsScrollState();

    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [recommendations, recommendationsLoading]);

  // 1. Fetch all available streaming servers
  useEffect(() => {
    let cancelled = false;
    setStreamLoading(true);
    setStreamError(null);
    setMultiStream(null);
    setSelectedServer(0);

    streamApi
      .getStreamUrl(animeId, episodeNum)
      .then((res) => {
        if (!cancelled) {
          if (res.servers && res.servers.length > 0) {
            setMultiStream(res);
            setSelectedServer(res.default >= 0 ? res.default : 0);
          } else {
            setStreamError(
              res.message || "No streaming servers found for this episode."
            );
          }
          setStreamLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStreamError(err.message || "Failed to resolve stream sources.");
          setStreamLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [animeId, episodeNum]);

  // 2. Resolve initial start time from localStorage first, then fallback to database history
  useEffect(() => {
    if (!animeId || !episodeNum) return;
    const local = getLocalEpisodeProgress(animeId, episodeNum);
    if (local && local.progressSeconds > 3) {
      setInitialTime(local.progressSeconds);
      currentPlaybackTimeRef.current = local.progressSeconds;
      return;
    }
    if (history.length > 0) {
      const record = history.find(
        (h) => h.anime_id === animeId && h.episode_number === episodeNum
      );
      if (
        record &&
        record.progress_seconds > 5 &&
        !isEpisodeFinished(record.progress_seconds, record.duration_seconds)
      ) {
        setInitialTime(record.progress_seconds);
        currentPlaybackTimeRef.current = record.progress_seconds;
        return;
      }
    }
    setInitialTime(0);
    currentPlaybackTimeRef.current = 0;
  }, [history, animeId, episodeNum]);

  // 3. Flush progress on page unload / refresh
  useEffect(() => {
    const flushProgress = () => {
      const curTime = Math.floor(currentPlaybackTimeRef.current);
      const curDur = Math.floor(currentDurationRef.current);
      if (curTime > 3 && curDur > 0 && animeId && episodeNum) {
        saveLocalEpisodeProgress({
          animeId,
          episodeNumber: episodeNum,
          progressSeconds: curTime,
          durationSeconds: curDur,
          animeTitle: anime?.title,
          animeImage: anime?.images?.webp?.image_url || anime?.images?.jpg?.image_url,
        });
      }
    };

    window.addEventListener("beforeunload", flushProgress);
    return () => {
      window.removeEventListener("beforeunload", flushProgress);
      flushProgress();
    };
  }, [animeId, episodeNum, anime]);

  const handleProgress = (currentTime: number, duration: number) => {
    if (!animeId || !episodeNum) return;

    currentPlaybackTimeRef.current = currentTime;
    currentDurationRef.current = duration;

    const currentRounded = Math.floor(currentTime);
    const durationRounded = Math.floor(duration);
    if (currentRounded <= 0 || durationRounded <= 0) return;

    const now = Date.now();

    // 1. Instant save to localStorage (throttled to at most once per 2 seconds)
    // Guarantees 0-latency resume on refresh even for guest sessions
    if (now - lastLocalSaveRef.current >= 2000) {
      lastLocalSaveRef.current = now;
      saveLocalEpisodeProgress({
        animeId,
        episodeNumber: episodeNum,
        progressSeconds: currentRounded,
        durationSeconds: durationRounded,
        animeTitle: anime?.title,
        animeImage: anime?.images?.webp?.image_url || anime?.images?.jpg?.image_url,
      });
    }

    // 2. Debounced save to Supabase backend database (every 12 seconds) for logged-in accounts
    if (isAuthenticated) {
      if (now - lastRemoteSaveRef.current >= 12000) {
        lastRemoteSaveRef.current = now;
        const safeTitle = anime?.title || anime?.title_english || `Episode ${episodeNum}`;
        saveProgress({
          anime_id: animeId,
          anime_title: safeTitle,
          anime_image: anime?.images?.webp?.image_url || anime?.images?.jpg?.image_url || null,
          episode_number: episodeNum,
          episode_title: `Episode ${episodeNum}`,
          progress_seconds: currentRounded,
          duration_seconds: durationRounded,
        });
      }
    }
  };

  const handleServerChange = (index: number) => {
    // Retain playback timestamp when switching servers
    const cur = Math.floor(currentPlaybackTimeRef.current);
    if (cur > 0) setInitialTime(cur);
    setSelectedServer(index);
  };

  const handlePrevServer = () => {
    if (!multiStream?.servers.length) return;
    const cur = Math.floor(currentPlaybackTimeRef.current);
    if (cur > 0) setInitialTime(cur);
    setSelectedServer((current) => (current - 1 + multiStream.servers.length) % multiStream.servers.length);
  };

  const handleNextServer = () => {
    if (!multiStream?.servers.length) return;
    const cur = Math.floor(currentPlaybackTimeRef.current);
    if (cur > 0) setInitialTime(cur);
    setSelectedServer((current) => (current + 1) % multiStream.servers.length);
  };

  const handleRetry = () => {
    // Re-trigger the stream fetch
    setStreamLoading(true);
    setStreamError(null);
    setMultiStream(null);

    streamApi
      .getStreamUrl(animeId, episodeNum)
      .then((res) => {
        if (res.servers && res.servers.length > 0) {
          setMultiStream(res);
          setSelectedServer(res.default >= 0 ? res.default : 0);
        } else {
          setStreamError(
            res.message || "No streaming servers found for this episode."
          );
        }
        setStreamLoading(false);
      })
      .catch((err) => {
        setStreamError(err.message || "Failed to resolve stream sources.");
        setStreamLoading(false);
      });
  };

  const handlePrevEpisode = () => {
    if (episodeNum > 1) {
      navigate(`/watch/${animeId}/${episodeNum - 1}`);
    }
  };

  const handleNextEpisode = () => {
    navigate(`/watch/${animeId}/${episodeNum + 1}`);
  };

  if (animeLoading) {
    return (
      <div className="flex-1 min-w-0 flex flex-col lg:flex-row bg-background w-full max-w-full page-enter animate-pulse overflow-x-hidden">
        {/* Left Column */}
        <div className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:pl-8 lg:pr-4 space-y-4">
          {/* Back link */}
          <Skeleton className="h-4 w-32 bg-card" />
          {/* Player Area */}
          <Skeleton className="w-full aspect-video rounded-xl bg-card" />
          {/* Server selector */}
          <Skeleton className="h-12 w-full bg-card rounded-lg" />
          {/* Episode Title metadata */}
          <div className="space-y-2 py-2 border-b border-border/20 pb-6">
            <Skeleton className="h-7 w-48 bg-card" />
            <Skeleton className="h-4 w-64 bg-card" />
          </div>
          {/* Synopsis */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-20 bg-card" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-full bg-card" />
              <Skeleton className="h-4 w-full bg-card" />
              <Skeleton className="h-4 w-2/3 bg-card" />
            </div>
          </div>
        </div>
        {/* Right Column (Sidebar) */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border/40 bg-card/25 p-4 space-y-3">
          <Skeleton className="h-6 w-24 bg-card" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-card rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Anime not found</h2>
        <Button asChild className="rounded-full bg-primary">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    );
  }   

  const title = anime.title_english || anime.title;
  const hasNext = episodes.some((ep) => ep.episode_number === episodeNum + 1) || (anime.episodes ? episodeNum < anime.episodes : true);

  // Get the current active server's stream URL
  const activeServer = multiStream?.servers?.[selectedServer] ?? null;
  const activeServerLabel = activeServer
    ? `${activeServer.name}${activeServer.quality ? ` • ${activeServer.quality}` : ""} (${activeServer.category || "SUB"})`
    : "";

  const firstSubIndex = multiStream?.servers.findIndex((s) => (s.category || "SUB") === "SUB") ?? -1;
  const firstDubIndex = multiStream?.servers.findIndex((s) => s.category === "DUB") ?? -1;

  return (
    <div className="flex-1 min-w-0 flex flex-col lg:flex-row bg-background w-full max-w-full page-enter overflow-x-hidden">
      {/* Left side: Video Player, Server Selector, Title, Nav Controls */}
      <div className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:pl-8 lg:pr-4 space-y-4">
        {/* Back Link */}
        <Link
          to={`/anime/${animeId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {title}
        </Link>

        {/* Video Player Interface */}
        {streamLoading ? (
          /* Premium Player Skeleton Loader */
          <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-black border border-border/40 relative flex flex-col justify-between p-4 sm:p-6 select-none">
            {/* Blurred Backdrop Cover Art */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-25 blur-lg scale-105 transition-all duration-500"
              style={{
                backgroundImage: `url(${anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url})`,
              }}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-black/60" />

            {/* Top Bar (Title skeleton) */}
            <div className="relative z-10 flex justify-between items-start w-full opacity-60">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-primary tracking-wider uppercase">Loading Stream</span>
                <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                  {title} — Episode {episodeNum}
                </h3>
              </div>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            </div>

            {/* Center pulsing play icon */}
            <div className="relative z-10 flex flex-col items-center justify-center space-y-3 my-auto">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-lg relative">
                {/* Double pulsing ring */}
                <div className="absolute inset-0 rounded-full border border-primary/40 animate-ping opacity-75" />
                <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white/40 fill-white/25 ml-1" />
              </div>
            </div>

            {/* Bottom Control Bar skeleton */}
            <div className="relative z-10 w-full space-y-3 opacity-60">
              {/* Timeline progress line */}
              <div className="h-1 bg-white/10 rounded-full w-full relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 bg-primary/40 w-1/4 animate-pulse" />
              </div>

              {/* Controls */}
              <div className="flex justify-between items-center w-full text-white/50">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-white/20" />
                  <div className="w-4 h-4 rounded bg-white/20" />
                  <div className="w-12 h-2.5 rounded bg-white/20" />
                  <div className="w-16 h-2 rounded bg-white/20" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-4 rounded bg-white/20" />
                  <div className="w-4 h-4 rounded bg-white/20" />
                  <div className="w-4 h-4 rounded bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        ) : streamError || !activeServer ? (
          <div className="w-full aspect-video rounded-xl bg-card/40 border border-border/20 flex flex-col items-center justify-center text-center p-6 space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div>
              <p className="font-semibold text-white">No Streaming Sources Available</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {streamError || "Unable to retrieve stream sources for this episode. The providers may be temporarily down."}
              </p>
            </div>
            <Button onClick={handleRetry} size="sm" variant="outline" className="rounded-full gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <VideoPlayer
            src={activeServer.url}
            type={activeServer.type}
            category={activeServer.category}
            title={`${title} - Episode ${episodeNum}`}
            poster={anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url}
            onProgress={handleProgress}
            initialTime={initialTime}
            subtitles={activeServer.subtitles}
            skips={skips}
            autoSkip={autoSkip}
          />
        )}

        {/* Server Selector */}
        {multiStream && multiStream.servers.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border border-border/20 bg-card/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Current Server</p>
                <p className="truncate text-sm font-semibold text-white">{activeServerLabel}</p>
                <p className="text-[11px] text-muted-foreground">
                  {activeServer?.category === "DUB"
                    ? "Playing English Dubbed audio."
                    : "Playing Japanese audio with English subtitles."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {firstSubIndex !== -1 && (
                  <Button
                    size="sm"
                    variant={(activeServer?.category || "SUB") === "SUB" ? "default" : "secondary"}
                    onClick={() => handleServerChange(firstSubIndex)}
                    className="rounded-full px-3 text-xs font-bold"
                  >
                    SUB (Eng)
                  </Button>
                )}
                {firstDubIndex !== -1 && (
                  <Button
                    size="sm"
                    variant={activeServer?.category === "DUB" ? "default" : "secondary"}
                    onClick={() => handleServerChange(firstDubIndex)}
                    className="rounded-full px-3 text-xs font-bold"
                  >
                    DUB (Eng)
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={autoSkip ? "default" : "secondary"}
                  onClick={toggleAutoSkip}
                  title={skips.length ? "Automatically skip intros and outros" : "No intro/outro timestamps found for this episode yet"}
                  className="rounded-full px-3 text-xs font-bold gap-1"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  Auto Skip: {autoSkip ? "On" : "Off"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrevServer}
                  className="rounded-full px-3 border border-border/40"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNextServer}
                  className="rounded-full px-3 border border-border/40"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            <ServerSelector
              servers={multiStream.servers}
              activeIndex={selectedServer}
              onSelect={handleServerChange}
            />
          </div>
        )}

        {/* Episode Controls & Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-border/20 pb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white line-clamp-1 leading-tight">
              Episode {episodeNum}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              Playing: <span className="text-foreground font-semibold">{title}</span>
            </p>
          </div>

          {/* Previous / Next Episode buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handlePrevEpisode}
              disabled={episodeNum <= 1}
              className="rounded-full px-4 border border-border/40"
            >
              <ChevronLeft className="w-4 h-4 mr-1.5" />
              Prev
            </Button>
            <Button
              variant="secondary"
              onClick={handleNextEpisode}
              disabled={!hasNext}
              className="rounded-full px-4 border border-border/40"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Synopsis Accordion description */}
        <div className="space-y-2 pb-6">
          <h2 className="text-base font-bold text-foreground">Synopsis</h2>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {anime.synopsis || "No synopsis available."}
          </p>
        </div>

        {/* Related Seasons Section */}
        {anime.relations && anime.relations.some((rel: any) => rel.entry.some((e: any) => e.type === "anime")) && (
          <div className="space-y-4 pt-6 border-t border-border/20">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Related Content
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {anime.relations
                .filter((rel: any) => rel.entry.some((e: any) => e.type === "anime"))
                .flatMap((rel: any) =>
                  rel.entry
                    .filter((entry: any) => entry.type === "anime")
                    .map((entry: any) => ({
                      ...entry,
                      relation: rel.relation,
                    }))
                )
                .slice(0, 9)
                .map((relEntry: any, idx: number) => (
                  <Link
                    key={`${relEntry.mal_id}-${idx}`}
                    to={`/anime/${relEntry.mal_id}`}
                    className="group flex items-center justify-between p-3.5 rounded-xl border border-border/40 bg-card/45 hover:bg-secondary/40 hover:border-border/80 transition-all duration-200"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider block mb-0.5">
                        {relEntry.relation}
                      </span>
                      <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                        {relEntry.name}
                      </h4>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                ))}
            </div>
          </div>
        )}

        {/* Recommended / Similar Section */}
        <div className="space-y-4 pt-6 border-t border-border/20 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            More Like This
          </h3>

          {recommendationsLoading ? (
            <div className="relative min-w-0 max-w-full overflow-hidden">
              <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar carousel-scroll snap-x snap-mandatory">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-32.5 sm:w-37.5 shrink-0 space-y-2 animate-pulse snap-start">
                    <div className="w-full aspect-2/3 bg-card rounded-xl border border-border/10" />
                    <div className="h-3 w-5/6 bg-card rounded" />
                    <div className="h-2.5 w-1/2 bg-card rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="space-y-3 text-center py-8 text-sm text-muted-foreground bg-card/10 rounded-xl border border-border/20">
              <p>{recommendationsError || "No recommendations available for this anime."}</p>
              {recommendationsError && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={refetchRecommendations}
                  className="rounded-full mx-auto border border-border/40"
                >
                  Retry
                </Button>
              )}
            </div>
          ) : (
            <div className="relative min-w-0 max-w-full overflow-hidden">
              {showRecommendationsLeft && (
                <button
                  type="button"
                  onClick={() => scrollRecommendations("left")}
                  aria-label="Scroll recommendations left"
                  className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full glass border border-border/80 text-foreground shadow-lg transition hover:bg-primary hover:text-white hover:border-primary"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {showRecommendationsRight && (
                <button
                  type="button"
                  onClick={() => scrollRecommendations("right")}
                  aria-label="Scroll recommendations right"
                  className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full glass border border-border/80 text-foreground shadow-lg transition hover:bg-primary hover:text-white hover:border-primary"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              <div
                ref={recommendationsScrollRef}
                className="flex w-max min-w-full gap-4 overflow-x-auto pb-4 carousel-scroll scrollbar-none hide-scrollbar snap-x snap-mandatory"
              >
                {recommendations.slice(0, 15).map((rec: any) => {
                  const recAnime = rec.entry;
                  const recImage = recAnime.images?.webp?.large_image_url || recAnime.images?.jpg?.large_image_url || "/placeholder-anime.jpg";
                  return (
                    <Link
                      key={recAnime.mal_id}
                      to={`/anime/${recAnime.mal_id}`}
                      className="group flex flex-col w-32.5 sm:w-37.5 shrink-0 snap-start bg-card rounded-xl overflow-hidden border border-border/40 hover:border-border/80 shadow-md card-hover"
                    >
                      <div className="aspect-2/3 w-full relative overflow-hidden bg-muted">
                        <img
                          src={recImage}
                          alt={recAnime.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="p-2.5 flex-1 flex flex-col justify-between">
                        <h4 className="text-xs font-bold leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors duration-200">
                          {recAnime.title}
                        </h4>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Sidebar of Episodes list */}
      <div className="w-full lg:w-80 bg-card/25 border-t lg:border-t-0 lg:border-l border-border/40 flex flex-col shrink-0">
        <div className="p-4 flex items-center gap-2 border-b border-border/40 bg-card/20 select-none shrink-0">
          <List className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-white text-xs uppercase tracking-wider">Episodes</h2>
        </div>

        {/* Category Tabs (1-50, 51-100, etc.) */}
        {ranges.length > 1 && (
          <div className="flex flex-wrap gap-1.5 p-3 border-b border-border/40 bg-card/10 max-h-30 overflow-y-auto custom-scrollbar shrink-0">
            {ranges.map(([start, end], idx) => (
              <button
                key={idx}
                onClick={() => setActiveRangeIndex(idx)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer border ${
                  idx === activeRangeIndex
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-secondary text-muted-foreground border-border/40 hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                {start}-{end}
              </button>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1 max-h-[50vh] lg:max-h-[75vh] p-4">
          <div className="space-y-2 pb-6">
            {episodesLoading && episodes.length === 0 ? (
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-11 rounded-lg bg-card/40 skeleton-shimmer border border-border/20" />
              ))
            ) : displayedEpisodes.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No episodes list returned.
              </div>
            ) : (
              displayedEpisodes.map((ep) => {
                const isActive = ep.episode_number === episodeNum;
                return (
                  <button
                    key={ep.episode_number}
                    onClick={() => navigate(`/watch/${animeId}/${ep.episode_number}`)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left text-xs font-medium cursor-pointer transition-all ${
                      isActive
                        ? "bg-primary text-white border-primary shadow-md"
                        : "bg-card hover:bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="truncate max-w-45">
                      EP {ep.episode_number} — {ep.title || `Episode ${ep.episode_number}`}
                    </span>
                    <Play className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "opacity-0 hover:opacity-100"}`} />
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export default WatchPage;
