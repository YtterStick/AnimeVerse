import { useId } from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * AniVerse brand mark:
 * a geometric "A" whose crossbar is a play button, wrapped by a tilted orbit
 * ring (the "verse") with an anime-style sparkle.
 */
export function LogoMark({ size = 36, className = "" }: LogoMarkProps) {
  const uid = useId().replace(/:/g, "");
  const grad = `av-grad-${uid}`;
  const orbit = `av-orbit-${uid}`;
  const glow = `av-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="AniVerse logo"
    >
      <defs>
        <linearGradient id={grad} x1="8" y1="42" x2="40" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id={orbit} x1="2" y1="30" x2="46" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ec4899" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="#f0abfc" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.2" />
        </linearGradient>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Back half of the orbit (behind the A) */}
      <path
        d="M3.5 36.5C2 31.5 12 24.5 25 22C35 20 43.5 21 45 23"
        stroke={`url(#${orbit})`}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* The "A" */}
      <path
        d="M24 5L41.5 42H33.2L24 21.5L14.8 42H6.5L24 5Z"
        fill={`url(#${grad})`}
        filter={`url(#${glow})`}
      />

      {/* Play-button crossbar */}
      <path d="M21.2 27.4L28.8 31.6L21.2 35.8V27.4Z" fill="#ffffff" />

      {/* Front half of the orbit (over the A) */}
      <path
        d="M45 23C46.5 28 37 35 24 38.8C13 41.5 4.8 40 3.5 36.5"
        stroke={`url(#${orbit})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Sparkle */}
      <path
        d="M39.5 2.5C39.9 6.2 41 7.3 44.5 7.7C41 8.1 39.9 9.2 39.5 12.9C39.1 9.2 38 8.1 34.5 7.7C38 7.3 39.1 6.2 39.5 2.5Z"
        fill="#fdf4ff"
      />
      <circle cx="44.5" cy="14" r="1.1" fill="#f9a8d4" />
    </svg>
  );
}

interface LogoProps {
  size?: number;
  className?: string;
}

/** Full lockup: mark + wordmark. */
export function Logo({ size = 36, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <LogoMark
        size={size}
        className="shrink-0 drop-shadow-[0_0_10px_rgba(168,85,247,0.35)] transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-105"
      />
      <span className="flex flex-col leading-none">
        <span className="text-xl font-black tracking-tight text-white">
          Ani
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            Verse
          </span>
        </span>
      </span>
    </span>
  );
}

export default Logo;
