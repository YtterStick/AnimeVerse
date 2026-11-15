import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, AlertCircle, ArrowLeft, Play, List, Compass, FastForward, Check, X, Search, LayoutGrid, Flag, Heart, Coffee, Tv, MessageSquare } from "lucide-react";
import { useAnimeDetail, useAnimeEpisodes, useAnimeRecommendations } from "@/hooks/useAnime";
import { useSaveProgress, useWatchHistory } from "@/hooks/useWatchHistory";
import { streamApi, type SkipInterval } from "@/lib/api";
import { getLocalEpisodeProgress, saveLocalEpisodeProgress, isEpisodeFinished, getEpisodeWatchStatus } from "@/lib/watchProgress";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { ServerSelector } from "@/components/player/ServerSelector";
import { ReportModal } from "@/components/player/ReportModal";
import { DonationModal } from "@/components/shared/DonationModal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimeSeasons } from "@/components/anime/AnimeSeasons";
import { EpisodeComments } from "@/components/anime/EpisodeComments";
import type { MultiStreamResult } from "@/types";
import { useTitleLanguage } from "@/contexts/TitleLanguageContext";
import { useLayout } from "@/contexts/LayoutContext";
import { getCleanServerName } from "@/lib/serverNames";

export function WatchPage() {
  const { id, episode } = useParams<{ id: string; episode: string }>();
  const animeId = parseInt(id || "", 10);
  const episodeNum = parseInt(episode || "", 10);

  const navigate = useNavigate();
  const { tvMode, toggleTvMode } = useLayout();
  const tvCarouselRef = useRef<HTMLDivElement | null>(null);
  const { anime, loading: animeLoading } = useAnimeDetail(animeId);
  const { episodes, loading: episodesLoading } = useAnimeEpisodes(animeId);
  const { saveProgress, isAuthenticated } = useSaveProgress();
  const { history } = useWatchHistory();
  const { formatTitle } = useTitleLanguage();
  const { recommendations, loading: recommendationsLoading, error: recommendationsError, refetch: refetchRecommendations } = useAnimeRecommendations(animeId);

  const [multiStream, setMultiStream] = useState<MultiStreamResult | null>(null);
  const [selectedServer, setSelectedServer] = useState(0);
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [, setFailedServerIndices] = useState<Set<number>>(new Set());
  const [serverToast, setServerToast] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [initialTime, setInitialTime] = useState<number>(() => {
    if (!animeId || !episodeNum) return 0;
    const local = getLocalEpisodeProgress(animeId, episodeNum);
    return local ? local.progressSeconds : 0;
  });
  const currentPlaybackTimeRef = useRef<number>(initialTime);
  const currentDurationRef = useRef<number>(0);
  const initializedEpisodeKeyRef = useRef<string>("");
  const preferredCategoryRef = useRef<string | null>(null);
  const lastAnimeIdRef = useRef<number>(animeId);
  const failedServerIndicesRef = useRef<Set<number>>(new Set());
  const hasFetchedBackendFallbackRef = useRef<boolean>(false);
  const lastLocalSaveRef = useRef<number>(0);
  const lastRemoteSaveRef = useRef<number>(0);
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);
  const recommendationsScrollRef = useRef<HTMLDivElement>(null);
  const [showRecommendationsLeft, setShowRecommendationsLeft] = useState(false);
  const [showRecommendationsRight, setShowRecommendationsRight] = useState(true);
  const [skips, setSkips] = useState<SkipInterval[]>([]);
  const [autoSkip, setAutoSkip] = useState<boolean>(() => {
    try {
      return localStorage.getItem("aniverse:autoSkip") === "true";
    } catch {
      return false;
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

  const [autoNext, setAutoNext] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("aniverse:autoNext");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  const toggleAutoNext = () => {
    setAutoNext((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("aniverse:autoNext", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  // Scroll window to top when watching a new anime or episode (skip if staying in fullscreen)
  useEffect(() => {
    if (!document.fullscreenElement) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [animeId, episodeNum]);

  // Fetch intro/outro timestamps (AniSkip) once per episode after actual duration is known
  // (or after a brief fallback delay if duration metadata is unavailable)
  const [videoDurationForSkips, setVideoDurationForSkips] = useState(0);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [tvCommentsOpen, setTvCommentsOpen] = useState(false);

  useEffect(() => {
    setSkips([]);
    setVideoDurationForSkips(0);
    setSynopsisExpanded(false);
    setTvCommentsOpen(false);
  }, [animeId, episodeNum]);

  useEffect(() => {
    const docTitle = anime ? formatTitle(anime) : `Anime #${animeId}`;
    document.title = `${docTitle} • Ep ${episodeNum} • AniVerse`;
  }, [anime, animeId, episodeNum, formatTitle]);

  useEffect(() => {
    let cancelled = false;
    if (!animeId || !episodeNum) return;

    const runLookup = (dur: number) => {
      streamApi.getSkipTimes(animeId, episodeNum, dur).then((res) => {
        if (!cancelled && res.skips?.length) {
          setSkips(res.skips);
        }
      });
    };

    if (videoDurationForSkips > 0) {
      runLookup(videoDurationForSkips);
      return () => {
        cancelled = true;
      };
    }

    const fallbackTimer = window.setTimeout(() => runLookup(0), 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [animeId, episodeNum, videoDurationForSkips]);

  const updateRecommendationsScrollState = useCallback(() => {
    const el = recommendationsScrollRef.current;
    if (!el) return;

    setShowRecommendationsLeft(el.scrollLeft > 15);
    setShowRecommendationsRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 15);
  }, []);

  const scrollRecommendations = (direction: "left" | "right") => {
    const el = recommendationsScrollRef.current;
    if (!el) return;

    const scrollAmount = Math.max(300, el.clientWidth * 0.75);
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(updateRecommendationsScrollState, 350);
  };

  const handleWheelRecommendations = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = recommendationsScrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) && Math.abs(e.deltaY) > 5) {
      el.scrollLeft += e.deltaY;
    }
  };

  // Compute episode ranges (25 episodes per tab for long series like Black Clover, 50 for shorter ones)
  const ranges = useMemo(() => {
    const CHUNK_SIZE = episodes.length > 50 ? 25 : 50;
    const list: [number, number][] = [];
    const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number);
    for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
      const start = sorted[i].episode_number;
      const end = sorted[Math.min(i + CHUNK_SIZE - 1, sorted.length - 1)].episode_number;
      list.push([start, end]);
    }
    return list;
  }, [episodes]);

  const [episodeSearch, setEpisodeSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const activeEpisodeRef = useRef<HTMLButtonElement | null>(null);

  // Auto-select range index containing the current episode
  useEffect(() => {
    if (ranges.length > 0) {
      const idx = ranges.findIndex(([start, end]) => episodeNum >= start && episodeNum <= end);
      if (idx !== -1) {
        setActiveRangeIndex(idx);
      }
    }
  }, [episodeNum, ranges]);

  // Filter episodes based on active search or active range
  const displayedEpisodes = useMemo(() => {
    const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number);

    // If searching (e.g. typing "81" or "dragon"), search across all episodes
    if (episodeSearch.trim()) {
      const q = episodeSearch.trim().toLowerCase();
      return sorted.filter(
        (ep) =>
          String(ep.episode_number) === q ||
          String(ep.episode_number).includes(q) ||
          (ep.title && ep.title.toLowerCase().includes(q))
      );
    }

    const activeRange = ranges[activeRangeIndex];
    const filtered = activeRange
      ? sorted.filter((ep) => ep.episode_number >= activeRange[0] && ep.episode_number <= activeRange[1])
      : sorted;
    return filtered;
  }, [episodes, ranges, activeRangeIndex, episodeSearch]);

  const scrollTvCarousel = useCallback((direction: "left" | "right") => {
    if (tvCarouselRef.current) {
      tvCarouselRef.current.scrollBy({
        left: direction === "left" ? -420 : 420,
        behavior: "smooth",
      });
    }
  }, []);

  const handleTvCarouselKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const container = tvCarouselRef.current;
    if (!container) return;

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    if (buttons.length === 0) return;

    const activeEl = document.activeElement as HTMLElement | null;
    const currentIndex = activeEl instanceof HTMLButtonElement ? buttons.indexOf(activeEl) : -1;

    let nextIndex = 0;
    if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = buttons.length - 1;
    } else if (e.key === "ArrowRight") {
      nextIndex = currentIndex === -1 ? 0 : Math.min(buttons.length - 1, currentIndex + 1);
    } else if (e.key === "ArrowLeft") {
      nextIndex = currentIndex === -1 ? buttons.length - 1 : Math.max(0, currentIndex - 1);
    }

    e.preventDefault();
    const target = buttons[nextIndex];
    target.focus();
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, []);

  // Auto-scroll to center the currently active episode in view (defer while in fullscreen)
  useEffect(() => {
    const scrollActiveEpisode = () => {
      if (activeEpisodeRef.current && !document.fullscreenElement) {
        activeEpisodeRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    };
    const timer = setTimeout(scrollActiveEpisode, 200);
    document.addEventListener("fullscreenchange", scrollActiveEpisode);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("fullscreenchange", scrollActiveEpisode);
    };
  }, [episodeNum, activeRangeIndex, displayedEpisodes, viewMode, tvMode]);

  useEffect(() => {
    const el = recommendationsScrollRef.current;
    if (!el) return;

    const handleScroll = () => updateRecommendationsScrollState();

    el.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    updateRecommendationsScrollState();
    const t1 = setTimeout(updateRecommendationsScrollState, 150);
    const t2 = setTimeout(updateRecommendationsScrollState, 500);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [recommendations, recommendationsLoading, updateRecommendationsScrollState]);

  // 1. Fetch all available streaming servers
  useEffect(() => {
    let cancelled = false;
    if (lastAnimeIdRef.current !== animeId) {
      lastAnimeIdRef.current = animeId;
      preferredCategoryRef.current = null;
    }
    setStreamLoading(true);
    setStreamError(null);
    setMultiStream(null);
    setSelectedServer(0);
    failedServerIndicesRef.current = new Set();
    hasFetchedBackendFallbackRef.current = false;
    setFailedServerIndices(new Set());
    setServerToast(null);

    streamApi
      .getStreamUrl(animeId, episodeNum)
      .then((res) => {
        if (!cancelled) {
          if (res.servers && res.servers.length > 0) {
            let targetIdx = res.default >= 0 ? res.default : 0;
            if (preferredCategoryRef.current) {
              const catIdx = res.servers.findIndex(
                (s) => (s.category || "SUB") === preferredCategoryRef.current
              );
              if (catIdx !== -1) targetIdx = catIdx;
            }
            setMultiStream(res);
            setSelectedServer(targetIdx);
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

  // Auto-dismiss server switch toast after 7 seconds
  useEffect(() => {
    if (!serverToast) return;
    const timer = setTimeout(() => {
      setServerToast(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [serverToast]);

  // 2. Resolve initial start time from localStorage first, then fallback to database history
  useEffect(() => {
    if (!animeId || !episodeNum) return;
    const epKey = `${animeId}:${episodeNum}`;
    const isNewEpisode = initializedEpisodeKeyRef.current !== epKey;
    if (isNewEpisode) {
      initializedEpisodeKeyRef.current = epKey;
      currentPlaybackTimeRef.current = 0;
      currentDurationRef.current = 0;
    } else if (currentPlaybackTimeRef.current > 5) {
      // Never overwrite initialTime while the viewer is actively watching this episode
      return;
    }
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
    const numId = Number(animeId);
    const numEp = Number(episodeNum);
    if (!numId || isNaN(numId) || numId <= 0 || !numEp || isNaN(numEp) || numEp <= 0) return;

    currentPlaybackTimeRef.current = currentTime;
    currentDurationRef.current = duration;

    const currentRounded = Math.floor(currentTime);
    const durationRounded = Math.floor(duration);
    if (currentRounded <= 0 || durationRounded <= 0) return;

    // Update duration for AniSkip if duration became available
    if (durationRounded > 60 && Math.abs(durationRounded - videoDurationForSkips) > 5) {
      setVideoDurationForSkips(durationRounded);
    }

    const now = Date.now();

    // 1. Instant save to localStorage (throttled to at most once per 2 seconds)
    // Guarantees 0-latency resume on refresh even for guest sessions
    if (now - lastLocalSaveRef.current >= 2000) {
      lastLocalSaveRef.current = now;
      saveLocalEpisodeProgress({
        animeId: numId,
        episodeNumber: numEp,
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
        const safeTitle = anime?.title || anime?.title_english || `Episode ${numEp}`;
        saveProgress({
          anime_id: numId,
          anime_title: safeTitle,
          anime_image: anime?.images?.webp?.image_url || anime?.images?.jpg?.image_url || null,
          episode_number: numEp,
          episode_title: `Episode ${numEp}`,
          progress_seconds: currentRounded,
          duration_seconds: durationRounded,
        });
      }
    }
  };

  const handleServerChange = (index: number) => {
    // Retain playback timestamp and SUB/DUB preference across episodes
    const cur = Math.floor(currentPlaybackTimeRef.current);
    if (cur > 0) setInitialTime(cur);
    const chosen = multiStream?.servers?.[index];
    if (chosen) {
      preferredCategoryRef.current = chosen.category || "SUB";
    }
    setSelectedServer(index);
  };

  const handleStreamError = useCallback(() => {
    // If the viewer was already actively watching this episode for >5s,
    // this is a mid-stream network/buffer stall, NOT a dead server.
    // Do NOT discard this server or force-switch servers!
    if (currentPlaybackTimeRef.current > 5) return;

    if (!multiStream || multiStream.servers.length === 0) return;

    const nextFailed = new Set(failedServerIndicesRef.current);
    nextFailed.add(selectedServer);
    failedServerIndicesRef.current = nextFailed;
    setFailedServerIndices(nextFailed);

    const currentServer = multiStream.servers[selectedServer];
    const currentCategory = currentServer?.category || "SUB";

    // 1. First look for another working server of the SAME category (SUB or DUB)
    let nextIndex = multiStream.servers.findIndex(
      (s, idx) => idx !== selectedServer && !nextFailed.has(idx) && (s.category || "SUB") === currentCategory
    );

    // 2. If none left in this category, look for ANY other working server
    if (nextIndex === -1) {
      nextIndex = multiStream.servers.findIndex(
        (_s, idx) => idx !== selectedServer && !nextFailed.has(idx)
      );
    }

    if (nextIndex !== -1) {
      const nextServer = multiStream.servers[nextIndex];
      const curTime = Math.floor(currentPlaybackTimeRef.current);
      if (curTime > 0) setInitialTime(curTime);

      setServerToast(
        `Server "${getCleanServerName(currentServer?.name, selectedServer)}" is unavailable for this episode. Switched to "${getCleanServerName(nextServer.name, nextIndex)}".`
      );
      setSelectedServer(nextIndex);
      return;
    }

    // 3. All client-resolved servers failed: automatically pull Render backup providers (e.g. AnimeHeaven MP4) once
    if (!hasFetchedBackendFallbackRef.current) {
      hasFetchedBackendFallbackRef.current = true;
      const failedUrls = new Set(multiStream.servers.map((s) => s.url));
      const requestedEpKey = `${animeId}:${episodeNum}`;
      setStreamLoading(true);
      setServerToast("Primary streaming servers failed. Trying backup servers...");

      streamApi
        .getStreamUrl(animeId, episodeNum, true)
        .then((res) => {
          if (initializedEpisodeKeyRef.current !== requestedEpKey) return;
          setStreamLoading(false);

          const servers = res.servers || [];
          const freshIdx = servers.findIndex((s) => !failedUrls.has(s.url));
          if (freshIdx !== -1) {
            const nextMap = new Set<number>();
            servers.forEach((s, idx) => {
              if (failedUrls.has(s.url)) nextMap.add(idx);
            });
            failedServerIndicesRef.current = nextMap;
            setFailedServerIndices(nextMap);
            setMultiStream(res);
            setSelectedServer(freshIdx);
            setServerToast(
              `Switched to backup server "${getCleanServerName(servers[freshIdx].name, freshIdx)}".`
            );
            return;
          }

          setServerToast(
            "All servers for this episode are currently unavailable. Click Retry or try another episode."
          );
        })
        .catch(() => {
          if (initializedEpisodeKeyRef.current !== requestedEpKey) return;
          setStreamLoading(false);
          setServerToast(
            "All servers for this episode are currently unavailable. Click Retry or try another episode."
          );
        });
      return;
    }

    setServerToast("All servers for this episode are currently unavailable. Click Retry or try another episode.");
  }, [multiStream, selectedServer, animeId, episodeNum]);

  const handleRetry = () => {
    // Preserve exact playback timestamp on retry so viewer never loses their place
    const cur = Math.floor(currentPlaybackTimeRef.current);
    if (cur > 0) setInitialTime(cur);

    // Re-trigger the stream fetch with forceFresh = true
    setStreamLoading(true);
    setStreamError(null);
    failedServerIndicesRef.current = new Set();
    hasFetchedBackendFallbackRef.current = false;
    setFailedServerIndices(new Set());
    setServerToast(null);

    streamApi
      .getStreamUrl(animeId, episodeNum, true)
      .then((res) => {
        if (res.servers && res.servers.length > 0) {
          let targetIdx = res.default >= 0 ? res.default : 0;
          if (preferredCategoryRef.current) {
            const catIdx = res.servers.findIndex(
              (s) => (s.category || "SUB") === preferredCategoryRef.current
            );
            if (catIdx !== -1) targetIdx = catIdx;
          }
          setMultiStream(res);
          setSelectedServer(targetIdx);
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

  // Only show full-page "Anime not found" when BOTH metadata AND stream sources failed to load (and not in fullscreen)
  if (
    !animeLoading &&
    !anime &&
    !streamLoading &&
    (!multiStream?.servers || multiStream.servers.length === 0) &&
    typeof document !== "undefined" &&
    !document.fullscreenElement
  ) {
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

  const title = anime ? formatTitle(anime) : `Anime #${animeId}`;
  const coverImage =
    anime?.images?.webp?.large_image_url || anime?.images?.jpg?.large_image_url || undefined;
  const hasNext =
    episodes.some((ep) => ep.episode_number === episodeNum + 1) ||
    (anime?.episodes ? episodeNum < anime.episodes : true);

  const handleVideoEnded = () => {
    if (autoNext && hasNext) {
      navigate(`/watch/${animeId}/${episodeNum + 1}`);
    }
  };

  // Get the current active server's stream URL
  const activeServer = multiStream?.servers?.[selectedServer] ?? null;
  const cleanActiveServerName = activeServer ? getCleanServerName(activeServer.name, selectedServer) : "";
  const currentEpisode = episodes.find((ep) => ep.episode_number === episodeNum);
  const currentEpisodeTitle =
    currentEpisode?.title &&
    currentEpisode.title.trim().toLowerCase() !== `episode ${episodeNum}`
      ? currentEpisode.title.trim()
      : null;

  const mergedSkips = useMemo(() => {
    const serverSkips = (activeServer?.skips || []).map((s) => ({
      ...s,
      source: s.source || ("stream" as const),
    }));
    const aniskipItems = skips.map((s) => ({
      ...s,
      source: s.source || ("aniskip" as const),
    }));
    if (serverSkips.length === 0) return aniskipItems;
    // Stream-native skip timestamps are timed to this exact video file; prefer them over AniSkip
    const coveredTypes = new Set(serverSkips.map((s) => s.type));
    return [...serverSkips, ...aniskipItems.filter((s) => !coveredTypes.has(s.type))];
  }, [skips, activeServer?.skips]);

  const firstSubIndex = multiStream?.servers.findIndex((s) => (s.category || "SUB") === "SUB") ?? -1;
  const firstDubIndex = multiStream?.servers.findIndex((s) => s.category === "DUB") ?? -1;

  return (
    <div className="min-h-screen bg-background w-full max-w-full page-enter overflow-x-hidden pb-12">
      <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 space-y-6">
        {/* Back Link */}
        <Link
          to={`/anime/${animeId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {title}
        </Link>

        {/* Server Failover Toast Notification */}
        {serverToast && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs sm:text-sm animate-fade-in shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">{serverToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setServerToast(null)}
              className="p-1 hover:bg-amber-500/20 rounded text-amber-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Top Section: Player & Server (wider cinema framing in TV mode, 8 cols in standard mode) */}
        <div
          className={`grid grid-cols-1 ${
            tvMode ? "lg:grid-cols-1 max-w-[1440px] mx-auto" : "lg:grid-cols-12"
          } gap-5 lg:gap-6 items-start`}
        >
          {/* Main Player Column */}
          <div
            className={`${
              tvMode ? "w-full" : "lg:col-span-8 xl:col-span-8 2xl:col-span-9"
            } space-y-4 min-w-0`}
          >
            {/* Video Player Interface — kept persistently mounted so Fullscreen never exits across episodes */}
            <VideoPlayer
              src={activeServer?.url || ""}
              type={activeServer?.type || "hls"}
              category={activeServer?.category || "SUB"}
              title={`${title} — Episode ${episodeNum}`}
              poster={coverImage}
              isLoadingStream={streamLoading}
              streamError={
                !streamLoading && (streamError || !activeServer)
                  ? streamError ||
                    "Unable to retrieve stream sources for this episode. The providers may be temporarily down."
                  : null
              }
              onProgress={handleProgress}
              initialTime={initialTime}
              subtitles={activeServer?.subtitles}
              thumbnails={activeServer?.thumbnails}
              skips={mergedSkips}
              autoSkip={autoSkip}
              episodeNumber={episodeNum}
              onError={handleStreamError}
              onRetry={handleRetry}
              onEnded={handleVideoEnded}
              onPrevEpisode={episodeNum > 1 ? handlePrevEpisode : undefined}
              onNextEpisode={hasNext ? handleNextEpisode : undefined}
              serverName={cleanActiveServerName}
              availableServers={multiStream?.servers || []}
              onSelectServer={handleServerChange}
              onReport={() => setIsReportOpen(true)}
            />

        {/* Episode & Anime Title Bar + Playback Controls */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border border-border/30 bg-card/30 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <Link
                to={`/anime/${animeId}`}
                className="text-xs font-bold text-primary hover:underline truncate block"
              >
                {title}
              </Link>
              <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight truncate">
                Episode {episodeNum}
                {currentEpisodeTitle ? ` — ${currentEpisodeTitle}` : ""}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1 mr-0.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handlePrevEpisode}
                  disabled={episodeNum <= 1}
                  className="rounded-full h-7 sm:h-8 px-2.5 text-[11px] sm:text-xs font-bold border border-border/40"
                  title="Previous episode"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleNextEpisode}
                  disabled={!hasNext}
                  className="rounded-full h-7 sm:h-8 px-2.5 text-[11px] sm:text-xs font-bold border border-border/40"
                  title="Next episode"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </div>

              {firstSubIndex !== -1 && (
                <Button
                  size="sm"
                  variant={(activeServer?.category || "SUB") === "SUB" ? "default" : "secondary"}
                  onClick={() => handleServerChange(firstSubIndex)}
                  className="rounded-full h-7 sm:h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold"
                >
                  SUB (Eng)
                </Button>
              )}
              {firstDubIndex !== -1 && (
                <Button
                  size="sm"
                  variant={activeServer?.category === "DUB" ? "default" : "secondary"}
                  onClick={() => handleServerChange(firstDubIndex)}
                  className="rounded-full h-7 sm:h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold"
                >
                  DUB (Eng)
                </Button>
              )}

              {/* Auto Skip Checkbox */}
              <label
                className="flex items-center gap-1.5 sm:gap-2 h-7 sm:h-8 px-2.5 sm:px-3 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-border/40 text-[11px] sm:text-xs font-semibold text-white/90 hover:text-white cursor-pointer select-none transition-colors"
                title="Automatically skip intros and outros"
              >
                <input
                  type="checkbox"
                  checked={autoSkip}
                  onChange={toggleAutoSkip}
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded border-border text-primary accent-primary cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <FastForward className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                  Auto Skip
                </span>
              </label>

              {/* Auto Next Checkbox */}
              <label
                className="flex items-center gap-1.5 sm:gap-2 h-7 sm:h-8 px-2.5 sm:px-3 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-border/40 text-[11px] sm:text-xs font-semibold text-white/90 hover:text-white cursor-pointer select-none transition-colors"
                title="Automatically play the next episode when current episode ends"
              >
                <input
                  type="checkbox"
                  checked={autoNext}
                  onChange={toggleAutoNext}
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded border-border text-primary accent-primary cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary fill-primary" />
                  Auto Next
                </span>
              </label>

              {/* Report Broken Video Button */}
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="flex items-center gap-1 sm:gap-1.5 h-7 sm:h-8 px-2.5 sm:px-3 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[11px] sm:text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer select-none transition-colors"
                title="Report a problem with this video stream or server"
              >
                <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                Report
              </button>

              {/* TV Mode Layout Toggle */}
              <button
                type="button"
                onClick={toggleTvMode}
                className={`flex items-center gap-1 sm:gap-1.5 h-7 sm:h-8 px-2.5 sm:px-3 rounded-full border text-[11px] sm:text-xs font-semibold cursor-pointer select-none transition-all ${
                  tvMode
                    ? "bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/50 text-purple-200 shadow-sm shadow-purple-500/20"
                    : "bg-secondary/50 hover:bg-secondary/80 border-border/40 text-muted-foreground hover:text-white"
                }`}
                title={tvMode ? "TV Mode is Active (Cinema layout). Click to switch to Standard layout." : "Switch to TV Cinema Mode"}
              >
                <Tv className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400" />
                <span>{tvMode ? "TV Mode (ON)" : "TV Mode"}</span>
              </button>
            </div>
          </div>

          {multiStream && multiStream.servers.length > 1 && (
            <ServerSelector
              servers={multiStream.servers}
              activeIndex={selectedServer}
              onSelect={handleServerChange}
            />
          )}

          {/* TV Mode Episode Shelf (Cinema Carousel) */}
          {tvMode && (
            <div className="rounded-2xl border border-purple-500/30 bg-card/60 backdrop-blur-md shadow-2xl p-4 sm:p-5 space-y-3.5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                    <Tv className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                      Episode Shelf
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 uppercase tracking-wider">
                        TV Mode ({episodes.length})
                      </span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Couch-friendly carousel • Select with remote / arrow keys or scroll
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Range Selector Pills for long series */}
                  {ranges.length > 1 && !episodeSearch && (
                    <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar max-w-xs sm:max-w-md py-0.5">
                      {ranges.map(([start, end], idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveRangeIndex(idx)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 border ${
                            idx === activeRangeIndex
                              ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30"
                              : "bg-secondary/60 text-muted-foreground border-border/40 hover:text-white hover:bg-secondary"
                          }`}
                        >
                          {start}-{end}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Left / Right Carousel scroll buttons */}
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => scrollTvCarousel("left")}
                      className="h-8 w-8 p-0 rounded-lg border border-border/50 text-white hover:bg-purple-500/20 cursor-pointer"
                      title="Scroll previous episodes"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => scrollTvCarousel("right")}
                      className="h-8 w-8 p-0 rounded-lg border border-border/50 text-white hover:bg-purple-500/20 cursor-pointer"
                      title="Scroll next episodes"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Horizontal Episode Carousel */}
              <div
                ref={tvCarouselRef}
                onKeyDown={handleTvCarouselKeyDown}
                className="flex items-stretch gap-3.5 overflow-x-auto hide-scrollbar py-2 px-1 scroll-smooth select-none focus:outline-none"
                tabIndex={0}
                role="region"
                aria-label="Episodes carousel"
              >
                {displayedEpisodes.map((ep) => {
                  const isActive = ep.episode_number === episodeNum;
                  const { isWatched, progressPercent } = getEpisodeWatchStatus(
                    animeId,
                    ep.episode_number,
                    history
                  );

                  return (
                    <button
                      key={ep.episode_number}
                      ref={isActive ? activeEpisodeRef : null}
                      type="button"
                      onClick={() => navigate(`/watch/${animeId}/${ep.episode_number}`)}
                      className={`group relative flex flex-col justify-between shrink-0 w-48 sm:w-56 p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer focus-visible:scale-[1.03] ${
                        isActive
                          ? "bg-purple-600/25 border-purple-400 shadow-xl shadow-purple-500/25 ring-2 ring-purple-500 scale-[1.02]"
                          : "bg-secondary/40 border-border/50 hover:bg-secondary/70 hover:border-purple-400/50 hover:scale-[1.01]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span
                          className={`text-xs sm:text-sm font-black px-2 py-0.5 rounded-lg ${
                            isActive
                              ? "bg-purple-500 text-white"
                              : "bg-secondary/80 text-white/90 group-hover:bg-purple-500/30 group-hover:text-purple-200"
                          }`}
                        >
                          EP {ep.episode_number}
                        </span>
                        {isWatched && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                            <Check className="w-3 h-3" />
                            Watched
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm font-semibold text-gray-200 line-clamp-2 mt-2.5 leading-snug group-hover:text-white">
                        {ep.title || `Episode ${ep.episode_number}`}
                      </p>

                      {/* Progress Bar for partially watched */}
                      {progressPercent > 0 && !isWatched && (
                        <div className="w-full bg-secondary rounded-full h-1.5 mt-2.5 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${progressPercent * 100}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Under-Player Ad-Free Support Banner (kept hidden in TV Mode for distraction-free cinema view) */}
        {!tvMode && (
          <div className="relative overflow-hidden rounded-2xl border border-pink-500/30 bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-amber-500/10 p-3.5 sm:p-4 shadow-lg backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center shadow-md shrink-0">
                  <Heart className="w-5 h-5 text-pink-400 fill-pink-400/30 animate-pulse" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-white leading-tight">
                    Enjoying AniVerse ad-free and without pop-ups?
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                    Help keep our servers fast and free by buying us a coffee ☕
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDonationOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-600 hover:to-amber-600 shadow-md shadow-pink-500/20 hover:shadow-pink-500/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Support Now</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Self-contained Episode List Card (Standard layout only) */}
      {!tvMode && (
        <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 min-w-0">
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md shadow-xl flex flex-col overflow-hidden h-[280px] sm:h-[340px] lg:h-[620px] 2xl:h-[680px]">
          {/* Card Header */}
          <div className="p-3 sm:p-3.5 flex items-center justify-between border-b border-border/40 bg-card/60 select-none shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <List className="w-4 h-4 text-primary shrink-0" />
              <h2 className="font-bold text-white text-xs uppercase tracking-wider truncate">
                Episodes ({episodes.length})
              </h2>
            </div>

            {/* Right Header: Search & View Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Quick Ep jump search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={episodeSearch}
                  onChange={(e) => setEpisodeSearch(e.target.value)}
                  placeholder="Ep. #"
                  className="w-20 sm:w-24 pl-6 pr-5 py-1 text-xs rounded-lg bg-secondary/60 border border-border/40 focus:outline-none focus:border-primary text-white placeholder:text-muted-foreground/60 transition-all"
                />
                {episodeSearch && (
                  <button
                    type="button"
                    onClick={() => setEpisodeSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* View Toggle (List vs Grid) */}
              <div className="flex items-center rounded-lg bg-secondary/60 p-0.5 border border-border/40">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1 rounded transition-colors ${
                    viewMode === "list"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-white"
                  }`}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1 rounded transition-colors ${
                    viewMode === "grid"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-white"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Range tabs (1-25, 26-50, etc.) */}
          {ranges.length > 1 && !episodeSearch && (
            <div className="flex items-center gap-1.5 p-2.5 border-b border-border/40 bg-card/30 overflow-x-auto hide-scrollbar shrink-0">
              {ranges.map(([start, end], idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveRangeIndex(idx)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer shrink-0 border ${
                    idx === activeRangeIndex
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-secondary/60 text-muted-foreground border-border/40 hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {start}-{end}
                </button>
              ))}
            </div>
          )}

          {/* Episode ScrollArea */}
          <ScrollArea className="flex-1 min-h-0 p-3">
            {episodesLoading && episodes.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-11 rounded-lg bg-card/40 skeleton-shimmer border border-border/20" />
                ))}
              </div>
            ) : displayedEpisodes.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                {episodeSearch ? `No episode matching "${episodeSearch}"` : "No episodes found."}
              </div>
            ) : viewMode === "grid" ? (
              /* GRID VIEW (Compact number badges on mobile, square tiles on desktop) */
              <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-1.5 lg:gap-2 pb-2 lg:pb-4">
                {displayedEpisodes.map((ep) => {
                  const isActive = ep.episode_number === episodeNum;
                  const { isWatched } = getEpisodeWatchStatus(animeId, ep.episode_number, history);
                  return (
                    <button
                      key={ep.episode_number}
                      ref={isActive ? activeEpisodeRef : null}
                      onClick={() => navigate(`/watch/${animeId}/${ep.episode_number}`)}
                      className={`relative h-9 lg:h-auto lg:aspect-square rounded-lg lg:rounded-xl border flex flex-col items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                        isActive
                          ? "bg-primary text-white border-primary shadow-lg shadow-primary/25 ring-2 ring-primary/40 lg:scale-105"
                          : isWatched
                          ? "bg-card/25 border-border/30 text-muted-foreground/45 hover:bg-secondary/50 hover:text-white"
                          : "bg-card/60 border-border/40 text-foreground hover:bg-secondary/70 hover:border-primary/50 hover:text-white"
                      }`}
                      title={`Episode ${ep.episode_number}${ep.title ? `: ${ep.title}` : ""}`}
                    >
                      <span>{ep.episode_number}</span>
                      {isWatched && !isActive && (
                        <Check className="w-2 h-2 lg:w-2.5 lg:h-2.5 text-emerald-400 absolute bottom-0.5 right-0.5 lg:bottom-1 lg:right-1" />
                      )}
                      {isActive && (
                        <Play className="w-2 h-2 lg:w-2.5 lg:h-2.5 text-white fill-white absolute bottom-0.5 right-0.5 lg:bottom-1 lg:right-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW (Detailed with title & progress) */
              <div className="space-y-2 pb-4">
                {displayedEpisodes.map((ep) => {
                  const isActive = ep.episode_number === episodeNum;
                  const { isWatched, progressPercent } = getEpisodeWatchStatus(
                    animeId,
                    ep.episode_number,
                    history
                  );

                  return (
                    <button
                      key={ep.episode_number}
                      ref={isActive ? activeEpisodeRef : null}
                      onClick={() => navigate(`/watch/${animeId}/${ep.episode_number}`)}
                      className={`relative w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs font-medium cursor-pointer transition-all overflow-hidden ${
                        isActive
                          ? "bg-primary text-white border-primary shadow-md opacity-100 ring-2 ring-primary/40"
                          : isWatched
                          ? "bg-card/25 hover:bg-secondary/40 border-border/20 text-muted-foreground/45 opacity-50 hover:opacity-85"
                          : "bg-card hover:bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className={`truncate pr-2 ${isWatched && !isActive ? "line-through decoration-muted-foreground/30" : ""}`}>
                        EP {ep.episode_number} — {ep.title || `Episode ${ep.episode_number}`}
                      </span>

                      {isActive ? (
                        <Play className="w-3.5 h-3.5 shrink-0 text-white fill-white" />
                      ) : isWatched ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold shrink-0">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        </span>
                      ) : (
                        <Play className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100" />
                      )}

                      {/* Progress indicator for partially watched episodes */}
                      {!isActive && !isWatched && progressPercent > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary/80 overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${progressPercent * 100}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
      )}
    </div>

    {/* Bottom Section: Synopsis, Comments, Related, More Like This */}
    <div className={`space-y-8 pt-2 ${tvMode ? "max-w-[1440px] mx-auto w-full" : ""}`}>
        {/* Synopsis Accordion description */}
        <div className="space-y-2 pb-6">
          <h2 className="text-base font-bold text-foreground">Synopsis</h2>
          <p
            className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line ${
              synopsisExpanded ? "" : "line-clamp-3"
            }`}
          >
            {anime?.synopsis || (animeLoading ? "Loading synopsis..." : "No synopsis available.")}
          </p>
          {(anime?.synopsis?.length || 0) > 180 && (
            <button
              type="button"
              onClick={() => setSynopsisExpanded((prev) => !prev)}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              {synopsisExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {/* Episode Reactions & Comments (collapsed behind toggle in TV Mode) */}
        {tvMode ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setTvCommentsOpen((prev) => !prev)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl border border-border/50 bg-card/50 hover:bg-card/80 text-sm font-bold text-foreground transition-all cursor-pointer shadow-md"
            >
              <MessageSquare className="w-4 h-4 text-primary" />
              <span>{tvCommentsOpen ? "Hide Comments & Reactions" : "Show Comments & Reactions"}</span>
            </button>
            {tvCommentsOpen && (
              <EpisodeComments
                animeId={animeId}
                episodeNumber={episodeNum}
                animeTitle={anime ? formatTitle(anime) : undefined}
                animeImage={anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url || null}
              />
            )}
          </div>
        ) : (
          <EpisodeComments
            animeId={animeId}
            episodeNumber={episodeNum}
            animeTitle={anime ? formatTitle(anime) : undefined}
            animeImage={anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url || null}
          />
        )}

        {/* Seasons & Franchise Section (Season 1, Season 2, Sequels & Movies) */}
        <AnimeSeasons currentAnimeId={animeId} mode="watch" />

        {/* Recommended / Similar Section */}
        <div className="space-y-4 pt-6 border-t border-border/20 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Compass className="w-5 h-5 text-primary" />
              More Like This
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollRecommendations("left")}
                aria-label="Previous recommendations"
                className="w-8 h-8 rounded-full border border-border/60 bg-card/70 hover:bg-primary hover:text-white hover:border-primary text-muted-foreground flex items-center justify-center transition-all cursor-pointer shadow-sm"
                title="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollRecommendations("right")}
                aria-label="Next recommendations"
                className="w-8 h-8 rounded-full border border-border/60 bg-card/70 hover:bg-primary hover:text-white hover:border-primary text-muted-foreground flex items-center justify-center transition-all cursor-pointer shadow-sm"
                title="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

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
            <div className="relative min-w-0 w-full group/rec">
              {showRecommendationsLeft && (
                <button
                  type="button"
                  onClick={() => scrollRecommendations("left")}
                  aria-label="Scroll recommendations left"
                  className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full glass border border-border/80 text-foreground shadow-xl transition hover:bg-primary hover:text-white hover:border-primary cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {showRecommendationsRight && (
                <button
                  type="button"
                  onClick={() => scrollRecommendations("right")}
                  aria-label="Scroll recommendations right"
                  className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full glass border border-border/80 text-foreground shadow-xl transition hover:bg-primary hover:text-white hover:border-primary cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              <div
                ref={recommendationsScrollRef}
                onWheel={handleWheelRecommendations}
                className="flex gap-4 overflow-x-auto pb-4 carousel-scroll scrollbar-none hide-scrollbar snap-x snap-mandatory w-full touch-pan-x"
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

      {/* Video Report Dialog */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        animeId={animeId}
        animeTitle={title}
        animeImage={coverImage}
        episodeNumber={episodeNum}
        serverName={cleanActiveServerName}
        category={activeServer?.category || "SUB"}
      />

      {/* Support / Donation Dialog */}
      <DonationModal
        isOpen={isDonationOpen}
        onClose={() => setIsDonationOpen(false)}
      />
    </div>
  </div>
);
}

export default WatchPage;
