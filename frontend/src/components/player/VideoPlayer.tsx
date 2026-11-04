import { useRef, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { MediaPlayer, MediaProvider, Track } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";

// Import Vidstack default styles
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import type { SubtitleTrack } from "@/types";
import type { SkipInterval } from "@/lib/api";
import { parseCues, refineSkips, buildChaptersVtt } from "@/lib/skipTimes";

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
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const autoSkippedRef = useRef<Set<string>>(new Set());
  const [activeSkip, setActiveSkip] = useState<SkipInterval | null>(null);
  const [autoSkipToast, setAutoSkipToast] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [refinedSkips, setRefinedSkips] = useState<SkipInterval[]>(skips);
  const [sliderEl, setSliderEl] = useState<HTMLElement | null>(null);

  // Keep refinedSkips in sync with props as baseline
  useEffect(() => {
    setRefinedSkips(skips);
  }, [skips]);

  // Reset per-source skip bookkeeping
  useEffect(() => {
    autoSkippedRef.current = new Set();
    setActiveSkip(null);
  }, [src]);

  // Attempt to refine skip times to frame-accurate timestamps using dialogue subtitle gaps
  useEffect(() => {
    let cancelled = false;
    const engSub =
      subtitles.find((s) => s.lang === "en" || /english/i.test(s.label)) || subtitles[0];

    if (!engSub?.url || skips.length === 0) return;

    fetch(engSub.url)
      .then((res) => (res.ok ? res.text() : ""))
      .then((text) => {
        if (cancelled || !text) return;
        const cues = parseCues(text);
        if (cues.length > 0) {
          const accurate = refineSkips(skips, cues, duration);
          setRefinedSkips(accurate);
        }
      })
      .catch(() => {
        // Fall back to raw skips if subtitle fetch fails
      });

    return () => {
      cancelled = true;
    };
  }, [subtitles, skips, duration]);

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

  // Seek to initial position and activate subtitles when media is loaded
  const handleCanPlay = () => {
    if (initialTime > 0 && playerRef.current) {
      playerRef.current.currentTime = initialTime;
    }
    if (playerRef.current?.duration) {
      setDuration(playerRef.current.duration);
    }
    syncSubtitleTrackMode();
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
    if (currentTime && currentDuration && onProgress) {
      onProgress(currentTime, currentDuration);
    }

    // Find a skippable interval we're currently inside
    const current = refinedSkips.find((s) => currentTime >= s.start && currentTime < s.end - 0.5) || null;

    if (current && autoSkip && !autoSkippedRef.current.has(skipKey(current))) {
      // Only auto-skip once per interval so users can seek back to rewatch an OP/ED
      autoSkippedRef.current.add(skipKey(current));
      seekPast(current);
      setAutoSkipToast(current.type === "ed" ? "Outro skipped" : current.type === "recap" ? "Recap skipped" : "Intro skipped");
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
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
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
    </div>
  );
}

export default VideoPlayer;
