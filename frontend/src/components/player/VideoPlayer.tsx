import { useRef, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
import { MediaPlayer, MediaProvider, Track } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";

// Import Vidstack default styles
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import type { SubtitleTrack } from "@/types";
import type { SkipInterval } from "@/lib/api";
import { parseCues, refineSkips, buildChaptersVtt } from "@/lib/skipTimes";
import { getCleanServerName } from "@/lib/serverNames";

interface VideoPlayerProps {
  src: string;
  type?: "hls" | "mp4";
  category?: string;
  title: string;
  poster?: string;
  onProgress?: (currentTime: number, duration: number) => void;
  initialTime?: number;
  subtitles?: SubtitleTrack[];
  /** Intro/outro/recap intervals in seconds */
  skips?: SkipInterval[];
  /** Automatically jump past intros/outros when playback enters them */
  autoSkip?: boolean;
  /** Current episode number (used to prevent prologue skipping on episode 1) */
  episodeNumber?: number;
  onError?: (errorDetail?: any) => void;
  onRetry?: () => void;
  onEnded?: () => void;
  serverName?: string;
  availableServers?: Array<{ id: string; name: string; category?: string }>;
  onSelectServer?: (index: number) => void;
}

const SKIP_LABELS: Record<string, string> = {
  op: "Skip Intro",
  ed: "Skip Outro",
  recap: "Skip Recap",
};

export function VideoPlayer({
  src,
  type = "hls",
  category = "SUB",
  title,
  poster: _poster,
  onProgress,
  initialTime = 0,
  subtitles = [],
  skips = [],
  autoSkip = false,
  episodeNumber,
  onError,
  onRetry,
  onEnded,
  serverName,
  availableServers,
  onSelectServer,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const autoSkippedRef = useRef<Set<string>>(new Set());
  const hasSeekedInitialRef = useRef(false);
  const [activeSkip, setActiveSkip] = useState<SkipInterval | null>(null);
  const [autoSkipToast, setAutoSkipToast] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [refinedSkips, setRefinedSkips] = useState<SkipInterval[]>(() =>
    episodeNumber === 1
      ? skips.filter((s) => !(s.type === "recap" && s.start < 60))
      : skips
  );
  const [sliderEl, setSliderEl] = useState<HTMLElement | null>(null);

  // Clear error state whenever the source changes
  useEffect(() => {
    setPlaybackError(null);
  }, [src]);

  const handleMediaError = (event: any) => {
    const errorMsg = event?.detail?.message || "Stream loading error";
    console.warn("[VideoPlayer] Stream load error:", errorMsg, src);
    setPlaybackError(errorMsg);
    onError?.(event);
  };

  // Keep refinedSkips in sync with props as baseline (filtering out false episode 1 recaps)
  useEffect(() => {
    if (episodeNumber === 1) {
      setRefinedSkips(skips.filter((s) => !(s.type === "recap" && s.start < 60)));
    } else {
      setRefinedSkips(skips);
    }
  }, [skips, episodeNumber]);

  // Reset per-source skip and initial seek bookkeeping
  useEffect(() => {
    autoSkippedRef.current = new Set();
    hasSeekedInitialRef.current = false;
    setActiveSkip(null);
  }, [src]);

  // Attempt to refine skip times to frame-accurate timestamps using dialogue subtitle cues
  useEffect(() => {
    let cancelled = false;
    const engSub =
      subtitles.find((s) => s.lang === "en" || /english/i.test(s.label)) || subtitles[0];

    if (!engSub?.url) {
      if (episodeNumber === 1) {
        setRefinedSkips(skips.filter((s) => !(s.type === "recap" && s.start < 60)));
      }
      return;
    }

    fetch(engSub.url)
      .then((res) => (res.ok ? res.text() : ""))
      .then((text) => {
        if (cancelled || !text) return;
        const cues = parseCues(text);
        if (cues.length > 0) {
          const accurate = refineSkips(skips, cues, duration, episodeNumber);
          setRefinedSkips(accurate);
        }
      })
      .catch(() => {
        // Fall back to baseline skips if subtitle fetch fails
      });

    return () => {
      cancelled = true;
    };
  }, [subtitles, skips, duration, episodeNumber]);

  // Locate the Vidstack seekbar element in the player DOM to mount yellow skip lines
  useEffect(() => {
    const locateSlider = () => {
      const root = playerRef.current?.el || playerRef.current;
      const el = root?.querySelector?.(".vds-time-slider");
      if (el && el !== sliderEl) {
        setSliderEl(el as HTMLElement);
      }
    };
    locateSlider();
    const timer = setInterval(locateSlider, 800);
    return () => clearInterval(timer);
  }, [sliderEl]);

  // Generate WebVTT chapters so Vidstack renders chapter divisions & tooltips
  const chaptersUrl = useMemo(() => {
    if (!duration || refinedSkips.length === 0) return null;
    const vtt = buildChaptersVtt(refinedSkips, duration);
    if (!vtt) return null;
    const blob = new Blob([vtt], { type: "text/vtt" });
    return URL.createObjectURL(blob);
  }, [refinedSkips, duration]);

  useEffect(() => {
    return () => {
      if (chaptersUrl) {
        URL.revokeObjectURL(chaptersUrl);
      }
    };
  }, [chaptersUrl]);

  useEffect(() => {
    if (!autoSkipToast) return;
    const t = window.setTimeout(() => setAutoSkipToast(null), 2000);
    return () => window.clearTimeout(t);
  }, [autoSkipToast]);

  const isSubMode = category !== "DUB";

  // Find first English subtitle track index (or 0 as fallback)
  const defaultSubIndex = subtitles.findIndex(
    (s) => s.lang === "en" || /english/i.test(s.label)
  );
  const activeDefaultSubIndex = defaultSubIndex !== -1 ? defaultSubIndex : 0;

  const syncSubtitleTrackMode = () => {
    const player = playerRef.current;
    if (!player?.textTracks) return;

    try {
      const tracks = Array.from(player.textTracks as Iterable<any>);
      if (!tracks.length) return;

      if (!isSubMode) {
        // In DUB mode, keep subtitles hidden unless user turns them on manually
        for (const t of tracks) {
          if (t.mode === "showing") t.mode = "disabled";
        }
        return;
      }

      // In SUB mode, ensure an English subtitle track is actively showing
      const alreadyShowing = tracks.some((t) => t.mode === "showing");
      if (!alreadyShowing) {
        const engTrack =
          tracks.find(
            (t) =>
              t.language === "en" ||
              /english/i.test(t.label || "")
          ) || tracks[0];
        if (engTrack) {
          engTrack.mode = "showing";
        }
      }
    } catch {
      // Ignore track manipulation errors during initialization
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(syncSubtitleTrackMode, 400);
    return () => window.clearTimeout(timer);
  }, [src, category, subtitles]);

  // Imperatively seek to initial position as soon as player is ready
  const seekToInitialIfReady = () => {
    if (hasSeekedInitialRef.current || !initialTime || initialTime <= 0) return;
    const player = playerRef.current;
    if (!player) return;

    try {
      player.currentTime = initialTime;
      hasSeekedInitialRef.current = true;
    } catch {
      // player may still be initializing
    }
  };

  // If initialTime updates after mount (e.g. async history fetch or server switch), seek immediately
  useEffect(() => {
    if (initialTime > 0 && !hasSeekedInitialRef.current) {
      seekToInitialIfReady();
    }
  }, [initialTime]);

  // Seek to initial position and activate subtitles when media is loaded
  const handleCanPlay = () => {
    seekToInitialIfReady();
    if (playerRef.current?.duration) {
      setDuration(playerRef.current.duration);
    }
    syncSubtitleTrackMode();
  };

  const handleLoadedMetadata = () => {
    seekToInitialIfReady();
    if (playerRef.current?.duration) {
      setDuration(playerRef.current.duration);
    }
  };

  const skipKey = (s: SkipInterval) => `${s.type}:${s.start}`;

  const seekPast = (interval: SkipInterval) => {
    const player = playerRef.current;
    if (!player) return;
    const dur = Number(player.duration) || duration;
    // Clamp so an outro that runs to the very end doesn't overshoot
    const target = dur > 0 ? Math.min(interval.end, dur - 0.25) : interval.end;
    player.currentTime = target;
    setActiveSkip(null);
  };

  const handleTimeUpdate = () => {
    if (!playerRef.current) return;
    const { currentTime, duration: currentDuration } = playerRef.current;
    if (currentDuration && currentDuration !== duration) {
      setDuration(currentDuration);
    }
    // If playback progressed past initial time, mark initial seek as completed
    if (currentTime > 0 && (!initialTime || currentTime >= initialTime - 1)) {
      hasSeekedInitialRef.current = true;
    }
    if (currentTime && currentDuration && onProgress) {
      onProgress(currentTime, currentDuration);
    }

    // Find a skippable interval we're currently inside
    const current = refinedSkips.find((s) => currentTime >= s.start && currentTime < s.end - 0.5) || null;

    // Only automatically jump past intros and outros. Recaps must be clicked manually to prevent accidental skips.
    if (
      current &&
      autoSkip &&
      (current.type === "op" || current.type === "ed") &&
      !autoSkippedRef.current.has(skipKey(current))
    ) {
      // Only auto-skip once per interval so users can seek back to rewatch an OP/ED
      autoSkippedRef.current.add(skipKey(current));
      seekPast(current);
      setAutoSkipToast(current.type === "ed" ? "Outro skipped" : "Intro skipped");
      return;
    }

    if (current?.start !== activeSkip?.start || current?.type !== activeSkip?.type) {
      setActiveSkip(current);
    }
  };

  // Explicitly tell Vidstack about the HLS format so it initializes hls.js
  const mimeType = type === "hls" ? "application/x-mpegurl" : "video/mp4";
  const mediaSource = {
    src,
    type: mimeType as "application/x-mpegurl" | "video/mp4",
  };

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-black border border-border/40 relative">
      <MediaPlayer
        ref={playerRef}
        title={title}
        src={mediaSource as any}
        currentTime={initialTime > 0 ? initialTime : undefined}
        onCanPlay={handleCanPlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onError={handleMediaError}
        onEnd={onEnded}
        className="w-full h-full"
        key={src}
        autoPlay
        preload="auto"
        load="eager"
        crossOrigin="anonymous"
      >
        <MediaProvider>
          {subtitles.map((subtitle, index) => (
            <Track
              key={subtitle.id || `${subtitle.lang}-${index}`}
              src={subtitle.url}
              kind="subtitles"
              label={subtitle.label}
              lang={subtitle.lang}
              type="vtt"
              default={isSubMode && index === activeDefaultSubIndex}
            />
          ))}
          {chaptersUrl && (
            <Track
              key={`chapters-${src}`}
              src={chaptersUrl}
              kind="chapters"
              default
            />
          )}
        </MediaProvider>
        <DefaultVideoLayout icons={defaultLayoutIcons} />

        {/* Yellow Intro & Outro Timeline Highlights rendered right on the seekbar */}
        {sliderEl && duration > 0 && refinedSkips.length > 0 && createPortal(
          <div className="vds-skip-highlights-overlay">
            {refinedSkips.map((skip, idx) => {
              const left = Math.min(100, Math.max(0, (skip.start / duration) * 100));
              const width = Math.min(100 - left, Math.max(0.6, ((skip.end - skip.start) / duration) * 100));
              return (
                <div
                  key={`${skip.type}-${idx}`}
                  className="vds-skip-indicator-bar"
                  title={`${skip.type === "ed" ? "Outro" : skip.type === "recap" ? "Recap" : "Intro"} (${Math.round(skip.start)}s - ${Math.round(skip.end)}s)`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                  }}
                />
              );
            })}
          </div>,
          sliderEl
        )}

        {/* Skip Intro / Outro button (rendered inside the player so it also shows in fullscreen) */}
        {activeSkip && (
          <button
            type="button"
            onClick={() => seekPast(activeSkip)}
            className="absolute bottom-20 right-4 z-50 rounded-md border border-white/30 bg-black/70 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-black cursor-pointer"
          >
            {SKIP_LABELS[activeSkip.type] || "Skip"} ⏭
          </button>
        )}

        {autoSkipToast && (
          <div className="pointer-events-none absolute top-4 right-4 z-50 rounded-md bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            {autoSkipToast}
          </div>
        )}
      </MediaPlayer>

      {/* Stream Error & Quick Server Switch Overlay */}
      {playbackError && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fade-in select-none">
          <div className="w-14 h-14 rounded-full bg-destructive/20 border border-destructive/40 flex items-center justify-center text-destructive">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Stream Temporarily Unavailable
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {serverName ? `"${getCleanServerName(serverName)}" encountered an error loading this episode.` : "This server encountered an error loading this episode."}
              {availableServers && availableServers.length > 1
                ? " Please switch to another available server below or retry."
                : " The upstream link may have expired. Please click Retry below."}
            </p>
          </div>

          {availableServers && availableServers.length > 1 && onSelectServer && (
            <div className="space-y-2 pt-1 w-full max-w-md">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Switch Server:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {availableServers.map((srv, idx) => (
                  <button
                    key={srv.id || idx}
                    type="button"
                    onClick={() => {
                      setPlaybackError(null);
                      onSelectServer(idx);
                    }}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-secondary/80 hover:bg-primary hover:text-white text-foreground border border-border/50 hover:border-primary transition-all cursor-pointer"
                  >
                    {getCleanServerName(srv.name, idx)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={() => {
                setPlaybackError(null);
                onRetry();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-lg cursor-pointer transition-all mt-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Stream
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
