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
  }
> = {
  like: {
    src: "/reactions/sugoi.gif",
    alt: "Sugoi anime reaction GIF",
  },
  love: {
    src: "/reactions/kawaii.gif",
    alt: "Kawaii blushing anime reaction GIF",
  },
  fire: {
    src: "/reactions/hype.gif",
    alt: "Hype cheering anime reaction GIF",
  },
  funny: {
    src: "/reactions/kusa.gif",
    alt: "Kusa laughing anime reaction GIF",
  },
  sad: {
    src: "/reactions/feels.gif",
    alt: "Feels crying anime reaction GIF",
  },
};

/**
 * Animated Discord-style anime character GIF reaction emote.
 */
export function AnimeReactionIcon({
  type,
  active = false,
  className = "w-8 h-8",
}: AnimeReactionIconProps) {
  const reaction = REACTION_GIF_MAP[type];

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-lg overflow-hidden transition-transform duration-150 ${
        active ? "scale-105" : "group-hover:scale-110"
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
