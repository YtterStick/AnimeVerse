import type { ReactionType } from "@/types";

interface AnimeReactionIconProps {
  type: ReactionType;
  active?: boolean;
  className?: string;
}

const REACTION_CHIBI_MAP: Record<
  ReactionType,
  {
    src: string;
    alt: string;
    ringClass: string;
    motionClass: string;
  }
> = {
  like: {
    src: "/reactions/sugoi.jpg",
    alt: "Sugoi anime chibi reaction",
    ringClass: "ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.45)]",
    motionClass: "anime-rx-bob",
  },
  love: {
    src: "/reactions/kawaii.jpg",
    alt: "Kawaii neko anime chibi reaction",
    ringClass: "ring-2 ring-pink-400/80 shadow-[0_0_14px_rgba(244,114,182,0.45)]",
    motionClass: "anime-rx-heart",
  },
  fire: {
    src: "/reactions/hype.jpg",
    alt: "Hype shonen anime chibi reaction",
    ringClass: "ring-2 ring-orange-400/80 shadow-[0_0_14px_rgba(251,146,60,0.5)]",
    motionClass: "anime-rx-flame",
  },
  funny: {
    src: "/reactions/kusa.jpg",
    alt: "Kusa laughing anime chibi reaction",
    ringClass: "ring-2 ring-teal-400/80 shadow-[0_0_14px_rgba(45,212,191,0.45)]",
    motionClass: "anime-rx-laugh",
  },
  sad: {
    src: "/reactions/feels.jpg",
    alt: "Feels crying anime chibi reaction",
    ringClass: "ring-2 ring-sky-400/80 shadow-[0_0_14px_rgba(56,189,248,0.45)]",
    motionClass: "anime-rx-bob",
  },
};

/**
 * Custom anime chibi character reaction stickers with subtle idle/active motion.
 */
export function AnimeReactionIcon({
  type,
  active = false,
  className = "w-9 h-9",
}: AnimeReactionIconProps) {
  const chibi = REACTION_CHIBI_MAP[type];

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden bg-[#14111d] border border-white/10 transition-transform duration-200 ${
        active ? `${chibi.ringClass} ${chibi.motionClass}` : "group-hover:scale-110"
      } ${className}`}
    >
      <img
        src={chibi.src}
        alt={chibi.alt}
        loading="lazy"
        draggable={false}
        className="w-full h-full object-cover scale-[1.06] select-none pointer-events-none"
      />
    </span>
  );
}
