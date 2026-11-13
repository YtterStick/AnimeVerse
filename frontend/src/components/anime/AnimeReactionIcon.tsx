import type { ReactionType } from "@/types";

interface AnimeReactionIconProps {
  type: ReactionType;
  active?: boolean;
  className?: string;
}

const REACTION_GIF_MAP: Record<
  ReactionType,
  {
    src: string;
    alt: string;
    ringClass: string;
  }
> = {
  like: {
    src: "/reactions/sugoi.gif",
    alt: "Sugoi anime reaction GIF",
    ringClass: "ring-2 ring-amber-400/85 shadow-[0_0_14px_rgba(251,191,36,0.45)]",
  },
  love: {
    src: "/reactions/kawaii.gif",
    alt: "Kawaii blushing anime reaction GIF",
    ringClass: "ring-2 ring-pink-400/85 shadow-[0_0_14px_rgba(244,114,182,0.45)]",
  },
  fire: {
    src: "/reactions/hype.gif",
    alt: "Hype cheering anime reaction GIF",
    ringClass: "ring-2 ring-orange-400/85 shadow-[0_0_14px_rgba(251,146,60,0.5)]",
  },
  funny: {
    src: "/reactions/kusa.gif",
    alt: "Kusa laughing anime reaction GIF",
    ringClass: "ring-2 ring-teal-400/85 shadow-[0_0_14px_rgba(45,212,191,0.45)]",
  },
  sad: {
    src: "/reactions/feels.gif",
    alt: "Feels crying anime reaction GIF",
    ringClass: "ring-2 ring-sky-400/85 shadow-[0_0_14px_rgba(56,189,248,0.45)]",
  },
};

/**
 * Animated Discord-style anime character GIF reaction emotes.
 */
export function AnimeReactionIcon({
  type,
  active = false,
  className = "w-10 h-10",
}: AnimeReactionIconProps) {
  const reaction = REACTION_GIF_MAP[type];

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-xl overflow-hidden bg-black/50 border border-white/15 transition-transform duration-200 ${
        active ? `${reaction.ringClass} scale-105` : "group-hover:scale-110"
      } ${className}`}
    >
      <img
        src={reaction.src}
        alt={reaction.alt}
        loading="eager"
        draggable={false}
        className="w-full h-full object-cover select-none pointer-events-none"
      />
    </span>
  );
}
