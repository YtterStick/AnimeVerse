import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Play, RefreshCw } from "lucide-react";
import Hls from "hls.js";
import {
  MediaPlayer,
  MediaProvider,
  Track,
  SeekButton,
  isHLSProvider,
  type MediaProviderAdapter,
} from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout, DefaultTooltip } from "@vidstack/react/player/layouts/default";

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
  /** True while resolving stream servers for a new episode (keeps <MediaPlayer> mounted so fullscreen never exits) */
  isLoadingStream?: boolean;
  /** Error message when no stream servers could be resolved for this episode */
  streamError?: string | null;
  onProgress?: (currentTime: number, duration: number) => void;
  initialTime?: number;
  subtitles?: SubtitleTrack[];
  /** WebVTT storyboard thumbnail URL for scrubbing/hovering preview */
  thumbnails?: string;
  /** Intro/outro/recap intervals in seconds */
  skips?: SkipInterval[];
  /** Automatically jump past intros/outros when playback enters them */
  autoSkip?: boolean;
  /** Current episode number (used to prevent prologue skipping on episode 1) */
  episodeNumber?: number;
  onError?: (errorDetail?: any) => void;
  onRetry?: () => void;
  onEnded?: () => void;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  serverName?: string;
  availableServers?: Array<{ id: string; name: string; category?: string }>;
  onSelectServer?: (index: number) => void;
}

const SKIP_LABELS: Record<string, string> = {
  op: "Skip Intro",
  ed: "Skip Outro",
  recap: "Skip Recap",
};

function SeekBackward10Icon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className || "w-5 h-5"}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <text
        x="12"
        y="15.5"
        fontSize="7.5"
        fontWeight="bold"
        fontFamily="sans-serif"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
      >
        10
      </text>
    </svg>
  );
}

function SeekForward10Icon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className || "w-5 h-5"}
    >
      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <text
        x="12"
        y="15.5"
        fontSize="7.5"
        fontWeight="bold"
        fontFamily="sans-serif"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
      >
        10
      </text>
    </svg>
  );
}

function PrevEpisodeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className || "w-5 h-5"}
    >
      <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
    </svg>
  );
}

function NextEpisodeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className || "w-5 h-5"}
    >
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );
}

export function VideoPlayer({
  src,
  type = "hls",
  category = "SUB",
  title,
  poster,
  isLoadingStream = false,
  streamError = null,
  onProgress,
  initialTime = 0,
  subtitles = [],
  thumbnails,
  skips = [],
  autoSkip = false,
  episodeNumber,
  onError,
  onRetry,
  onEnded,
  onPrevEpisode,
  onNextEpisode,
  serverName,
  availableServers,
  onSelectServer,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const autoSkippedRef = useRef<Set<string>>(new Set());
  const hasSeekedInitialRef = useRef(false);
  const shouldAutoPlayOnLoadRef = useRef(true);
  const lastPlaybackTimeRef = useRef<number>(initialTime > 0 ? initialTime : 0);
  const recoveryAttemptsRef = useRef<number>(0);
  const lastRecoveryAtTimeRef = useRef<number>(0);
  const resumeOverrideRef = useRef<number | null>(null);
  const recoveryTimerRef = useRef<number | null>(null);
  const reloadResetTimerRef = useRef<number | null>(null);
  const [reloadingSource, setReloadingSource] = useState(false);
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

  const effectiveStartTime =
    resumeOverrideRef.current !== null ? resumeOverrideRef.current : initialTime;

  const activeSrc = isLoadingStream || reloadingSource || !src ? "" : src;

  // Clear error and per-source state whenever the stream URL changes (without unmounting <MediaPlayer>)
  useEffect(() => {
    setPlaybackError(null);
    recoveryAttemptsRef.current = 0;
    lastRecoveryAtTimeRef.current = 0;
    resumeOverrideRef.current = null;
    lastPlaybackTimeRef.current = initialTime > 0 ? initialTime : 0;
    hlsInstanceRef.current = null;
    autoSkippedRef.current = new Set();
    hasSeekedInitialRef.current = false;
    setActiveSkip(null);
    setDuration(0);
    if (src) {
      shouldAutoPlayOnLoadRef.current = true;
    }
    if (recoveryTimerRef.current) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, [src]);

  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current) {
        window.clearTimeout(recoveryTimerRef.current);
      }
      if (reloadResetTimerRef.current) {
        window.clearTimeout(reloadResetTimerRef.current);
      }
    };
  }, []);

  const handleProviderChange = useCallback((provider: MediaProviderAdapter | null) => {
    if (isHLSProvider(provider)) {
      // Pass bundled Hls constructor synchronously so setup() + autoPlay never race an async script load
      provider.library = Hls;
      provider.config = {
        maxBufferLength: 120,
        maxMaxBufferLength: 300,
        backBufferLength: 60,
        maxBufferHole: 0.5,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 10,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 6,
        levelLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 16000,
        startFragPrefetch: true,
      };
      provider.onInstance((hls) => {
        hlsInstanceRef.current = hls;
      });
    } else {
      hlsInstanceRef.current = null;
    }
  }, []);

  const triggerInPlaceReload = useCallback(() => {
    shouldAutoPlayOnLoadRef.current = true;
    hasSeekedInitialRef.current = false;
    setPlaybackError(null);
    setReloadingSource(true);
    if (reloadResetTimerRef.current) {
      window.clearTimeout(reloadResetTimerRef.current);
    }
    reloadResetTimerRef.current = window.setTimeout(() => {
      setReloadingSource(false);
    }, 60);
  }, []);

  const handleMediaError = (event: any) => {
    // Ignore transient abort events while switching episodes or reloading in-place
    if (!activeSrc || isLoadingStream || reloadingSource) return;

    const errorMsg = event?.detail?.message || "Stream loading error";
    const resumeAt = lastPlaybackTimeRef.current;

    // Auto-recover silently mid-episode (e.g. ~10-12 min CDN connection drop, segment hiccup, or eyecatch splice)
    if (resumeAt > 3 && recoveryAttemptsRef.current < 4) {
      recoveryAttemptsRef.current += 1;
      lastRecoveryAtTimeRef.current = resumeAt;
      const attempt = recoveryAttemptsRef.current;

      console.warn(
        `[VideoPlayer] Mid-stream hiccup at ${Math.round(resumeAt)}s (attempt ${attempt}/4), auto-recovering:`,
        errorMsg
      );

      if (recoveryTimerRef.current) {
        window.clearTimeout(recoveryTimerRef.current);
      }

      if (type === "hls" && hlsInstanceRef.current && attempt <= 2) {
        const hls = hlsInstanceRef.current;
        recoveryTimerRef.current = window.setTimeout(() => {
          try {
            hls.startLoad(Math.floor(resumeAt));
            playerRef.current?.play?.()?.catch?.(() => {});
          } catch {
            // Fall through to full source reload on next attempt if startLoad throws
          }
        }, 350 * attempt);
        return;
      }

      // Fresh range/playlist re-attach at the exact playback second WITHOUT unmounting <MediaPlayer>
      recoveryTimerRef.current = window.setTimeout(() => {
        resumeOverrideRef.current = Math.max(0, resumeAt - 0.5);
        triggerInPlaceReload();
      }, 450 * attempt);
      return;
    }

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
    if (!activeSrc) return;
    const timer = window.setTimeout(syncSubtitleTrackMode, 400);
    return () => window.clearTimeout(timer);
  }, [activeSrc, category, subtitles]);

  // Imperatively seek to initial position as soon as player is ready
  const seekToInitialIfReady = () => {
    if (hasSeekedInitialRef.current) return;
    const player = playerRef.current;
    if (!player) return;

    if (!effectiveStartTime || effectiveStartTime <= 0) {
      hasSeekedInitialRef.current = true;
      return;
    }

    try {
      player.currentTime = effectiveStartTime;
      hasSeekedInitialRef.current = true;
    } catch {
      // player may still be initializing
    }
  };

  // If initialTime updates after mount (e.g. async history fetch or server switch), seek immediately
  useEffect(() => {
    if (activeSrc && effectiveStartTime > 0 && !hasSeekedInitialRef.current) {
      seekToInitialIfReady();
    }
  }, [activeSrc, effectiveStartTime]);

  // Seek to initial position, activate subtitles, and ensure playback starts on episode transitions
  const handleCanPlay = () => {
    if (!activeSrc) return;
    seekToInitialIfReady();
    if (playerRef.current?.duration) {
      setDuration(playerRef.current.duration);
    }
    syncSubtitleTrackMode();
    if (shouldAutoPlayOnLoadRef.current) {
      shouldAutoPlayOnLoadRef.current = false;
      Promise.resolve(playerRef.current?.play?.()).catch(() => {});
    }
  };

  const handleLoadedMetadata = () => {
    if (!activeSrc) return;
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
    if (!playerRef.current || !activeSrc || isLoadingStream) return;
    const { currentTime, duration: currentDuration } = playerRef.current;
    if (currentDuration && currentDuration !== duration) {
      setDuration(currentDuration);
    }
    // If playback progressed past initial time, mark initial seek as completed
    if (currentTime > 0 && (!effectiveStartTime || currentTime >= effectiveStartTime - 1)) {
      hasSeekedInitialRef.current = true;
    }
    if (currentTime > 0) {
      lastPlaybackTimeRef.current = currentTime;
      // Once playback advances cleanly for 10+ seconds past a recovery point, reset the recovery counter
      if (
        recoveryAttemptsRef.current > 0 &&
        currentTime - lastRecoveryAtTimeRef.current >= 10
      ) {
        recoveryAttemptsRef.current = 0;
        resumeOverrideRef.current = null;
      }
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

  const handleEnded = () => {
    if (!activeSrc || isLoadingStream) return;
    onEnded?.();
  };

  // Explicitly tell Vidstack about the HLS format so it initializes hls.js
  const mimeType = type === "hls" ? "application/x-mpegurl" : "video/mp4";
  const mediaSource = activeSrc
    ? {
        src: activeSrc,
        type: mimeType as "application/x-mpegurl" | "video/mp4",
      }
    : "";

  // Omit crossOrigin on direct external MP4s without external subtitle/thumbnail tracks
  // so native <video> streams directly from the CDN (0 MB proxy bandwidth) without CORS blocks.
  const needsCors =
    !activeSrc ||
    type === "hls" ||
    subtitles.length > 0 ||
    Boolean(thumbnails) ||
    activeSrc.includes("/proxy?");

  const activeErrorMessage = !isLoadingStream ? streamError || playbackError : null;

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-black border border-border/40 relative">
      {/* Keep <MediaPlayer> persistently mounted across episode & server transitions so Fullscreen NEVER exits */}
      <MediaPlayer
        ref={playerRef}
        title={title}
        src={mediaSource as any}
        onProviderChange={handleProviderChange}
        onCanPlay={handleCanPlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onError={handleMediaError}
        onEnd={handleEnded}
        className="w-full h-full relative"
        autoPlay
        preload="auto"
        load="eager"
        crossOrigin={needsCors ? "anonymous" : undefined}
      >
        <MediaProvider>
          {activeSrc &&
            subtitles.map((subtitle, index) => (
              <Track
                key={`${activeSrc}-${subtitle.id || `${subtitle.lang}-${index}`}`}
                src={subtitle.url}
                kind="subtitles"
                label={subtitle.label}
                lang={subtitle.lang}
                type="vtt"
                default={isSubMode && index === activeDefaultSubIndex}
              />
            ))}
          {activeSrc && chaptersUrl && (
            <Track
              key={`chapters-${activeSrc}`}
              src={chaptersUrl}
              kind="chapters"
              default
            />
          )}
        </MediaProvider>
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          thumbnails={activeSrc ? thumbnails : undefined}
          seekStep={10}
          slots={{
            beforePlayButton: (
              <>
                {onPrevEpisode && (
                  <DefaultTooltip content="Previous Episode" placement="top">
                    <button
                      type="button"
                      onClick={onPrevEpisode}
                      className="vds-button"
                      aria-label="Previous Episode"
                    >
                      <PrevEpisodeIcon className="vds-icon" />
                    </button>
                  </DefaultTooltip>
                )}
                <DefaultTooltip content="Seek Backward 10s" placement="top">
                  <SeekButton
                    seconds={-10}
                    className="vds-seek-button vds-button"
                    aria-label="Seek Backward 10 Seconds"
                  >
                    <SeekBackward10Icon className="vds-icon" />
                  </SeekButton>
                </DefaultTooltip>
              </>
            ),
            afterPlayButton: (
              <>
                <DefaultTooltip content="Seek Forward 10s" placement="top">
                  <SeekButton
                    seconds={10}
                    className="vds-seek-button vds-button"
                    aria-label="Seek Forward 10 Seconds"
                  >
                    <SeekForward10Icon className="vds-icon" />
                  </SeekButton>
                </DefaultTooltip>
                {onNextEpisode && (
                  <DefaultTooltip content="Next Episode" placement="top">
                    <button
                      type="button"
                      onClick={onNextEpisode}
                      className="vds-button"
                      aria-label="Next Episode"
                    >
                      <NextEpisodeIcon className="vds-icon" />
                    </button>
                  </DefaultTooltip>
                )}
              </>
            ),
          }}
        />

        {/* Yellow Intro & Outro Timeline Highlights rendered right on the seekbar */}
        {activeSrc && sliderEl && duration > 0 && refinedSkips.length > 0 && createPortal(
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

        {/* Skip Intro / Outro button (rendered inside <MediaPlayer> so it shows in fullscreen) */}
        {activeSrc && !isLoadingStream && activeSkip && (
          <div className="absolute bottom-20 right-4 z-40 flex items-center gap-2">
            <button
              type="button"
              onClick={() => seekPast(activeSkip)}
              className="rounded-md border border-white/30 bg-black/70 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-black cursor-pointer"
            >
              {SKIP_LABELS[activeSkip.type] || "Skip"} ⏭
            </button>
            {activeSkip.type === "ed" && onNextEpisode && (
              <button
                type="button"
                onClick={onNextEpisode}
                className="rounded-md border border-primary/50 bg-primary/85 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-primary cursor-pointer"
              >
                Next Ep ⏭
              </button>
            )}
          </div>
        )}

        {autoSkipToast && (
          <div className="pointer-events-none absolute top-4 right-4 z-40 rounded-md bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            {autoSkipToast}
          </div>
        )}

        {/* In-Player Episode Loading Overlay (renders inside <MediaPlayer> so Fullscreen stays active) */}
        {isLoadingStream && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden">
            {poster && (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 blur-lg scale-105 transition-all duration-500"
                style={{ backgroundImage: `url(${poster})` }}
              />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-black/60" />

            <div className="relative z-10 flex justify-between items-start w-full opacity-80">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
                  Loading Stream
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                  {title}
                </h3>
              </div>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center space-y-3 my-auto">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-lg relative">
                <div className="absolute inset-0 rounded-full border border-primary/40 animate-ping opacity-75" />
                <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white/40 fill-white/25 ml-1" />
              </div>
            </div>

            <div className="relative z-10 w-full space-y-3 opacity-60">
              <div className="h-1 bg-white/10 rounded-full w-full relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 bg-primary/40 w-1/4 animate-pulse" />
              </div>
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
        )}

        {/* In-Player Stream Error & Quick Server Switch Overlay (also visible inside Fullscreen) */}
        {activeErrorMessage && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fade-in select-none">
            <div className="w-14 h-14 rounded-full bg-destructive/20 border border-destructive/40 flex items-center justify-center text-destructive">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-base sm:text-lg font-bold text-white">
                {streamError ? "No Streaming Sources Available" : "Stream Temporarily Unavailable"}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {streamError
                  ? streamError
                  : `${
                      serverName
                        ? `"${getCleanServerName(serverName)}" encountered an error loading this episode.`
                        : "This server encountered an error loading this episode."
                    }${
                      availableServers && availableServers.length > 1
                        ? " Please switch to another available server below or retry."
                        : " The upstream link may have expired. Please click Retry below."
                    }`}
              </p>
            </div>

            {!streamError && availableServers && availableServers.length > 1 && onSelectServer && (
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
      </MediaPlayer>
    </div>
  );
}

export default VideoPlayer;
