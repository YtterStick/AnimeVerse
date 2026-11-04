import { useRef, useEffect } from "react";
import { MediaPlayer, MediaProvider, Track } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";

// Import Vidstack default styles
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import type { SubtitleTrack } from "@/types";

interface VideoPlayerProps {
  src: string;
  type?: "hls" | "mp4";
  category?: string;
  title: string;
  poster?: string;
  onProgress?: (currentTime: number, duration: number) => void;
  initialTime?: number;
  subtitles?: SubtitleTrack[];
}

export function VideoPlayer({
  src,
  type = "hls",
  category = "SUB",
  title,
  poster: _poster,
  onProgress,
  initialTime = 0,
  subtitles = [],
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);

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
    syncSubtitleTrackMode();
  };

  const handleTimeUpdate = () => {
    if (!playerRef.current) return;
    const { currentTime, duration } = playerRef.current;
    if (currentTime && duration && onProgress) {
      onProgress(currentTime, duration);
    }
  };

  // Explicitly tell Vidstack about the HLS format so it initializes hls.js
  const mimeType = type === "hls" ? "application/x-mpegurl" : "video/mp4";
  const mediaSource = {
    src,
    type: mimeType as "application/x-mpegurl" | "video/mp4",
  };

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-black border border-border/40">
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
        </MediaProvider>
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  );
}

export default VideoPlayer;
