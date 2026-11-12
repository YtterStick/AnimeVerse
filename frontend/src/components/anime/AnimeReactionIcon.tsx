import { useId } from "react";
import type { ReactionType } from "@/types";

interface AnimeReactionIconProps {
  type: ReactionType;
  active?: boolean;
  className?: string;
}

/**
 * Custom animated anime-themed SVG reaction stickers (continuously moving + boosted when active).
 */
export function AnimeReactionIcon({
  type,
  active = false,
  className = "w-6 h-6",
}: AnimeReactionIconProps) {
  const flameGradientId = useId();

  switch (type) {
    case "like":
      // Sugoi! Star-struck sparkling chibi badge
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <g className={active ? "anime-rx-bob" : "hover:anime-rx-bob anime-rx-bob"}>
            {/* Chibi head */}
            <circle cx="18" cy="19" r="11" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1.6" />
            {/* Cute hair bangs */}
            <path
              d="M7 17C8 10 13 7 18 7C23 7 28 10 29 17C26 13.5 22 12.5 18 14C14 12.5 10 13.5 7 17Z"
              fill="#7C3AED"
            />
            {/* Rosy anime blush */}
            <ellipse cx="11.5" cy="21" rx="2.1" ry="1.1" fill="#FB7185" opacity="0.65" />
            <ellipse cx="24.5" cy="21" rx="2.1" ry="1.1" fill="#FB7185" opacity="0.65" />
            {/* Starry anime eyes */}
            <g className="anime-rx-twinkle">
              <path
                d="M13 15.2L13.8 17.1L15.8 17.3L14.2 18.6L14.7 20.5L13 19.4L11.3 20.5L11.8 18.6L10.2 17.3L12.2 17.1Z"
                fill="#F59E0B"
              />
              <path
                d="M23 15.2L23.8 17.1L25.8 17.3L24.2 18.6L24.7 20.5L23 19.4L21.3 20.5L21.8 18.6L20.2 17.3L22.2 17.1Z"
                fill="#F59E0B"
              />
            </g>
            {/* Happy open smile */}
            <path d="M15.2 22.8C16.4 24.4 19.6 24.4 20.8 22.8Z" fill="#EC4899" />
            {/* Floating sparkle */}
            <path
              d="M30 5L30.8 7.2L33 8L30.8 8.8L30 11L29.2 8.8L27 8L29.2 7.2Z"
              fill="#FACC15"
              className="anime-rx-twinkle"
            />
          </g>
        </svg>
      );

    case "love":
      // Kawaii! Blushing neko chibi with beating anime hearts
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <g className="anime-rx-heart">
            {/* Neko cat ears */}
            <path d="M8 15L10.5 7.5L15.5 11.5Z" fill="#EC4899" />
            <path d="M28 15L25.5 7.5L20.5 11.5Z" fill="#EC4899" />
            {/* Chibi face */}
            <circle cx="18" cy="20" r="10.5" fill="#FCE7F3" stroke="#F472B6" strokeWidth="1.6" />
            {/* Heart eyes */}
            <path
              d="M12.8 19.5C11.4 18.2 10.6 16.9 11.5 16C12.2 15.3 13 16 12.8 16.5C12.7 16 13.5 15.3 14.2 16C15.1 16.9 14.2 18.2 12.8 19.5Z"
              fill="#E11D48"
            />
            <path
              d="M23.2 19.5C21.8 18.2 21 16.9 21.9 16C22.6 15.3 23.4 16 23.2 16.5C23.1 16 23.9 15.3 24.6 16C25.5 16.9 24.6 18.2 23.2 19.5Z"
              fill="#E11D48"
            />
            {/* Cute w cat mouth + blush */}
            <ellipse cx="11.2" cy="21.8" rx="2" ry="1" fill="#FB7185" opacity="0.7" />
            <ellipse cx="24.8" cy="21.8" rx="2" ry="1" fill="#FB7185" opacity="0.7" />
            <path
              d="M15.4 22.8C16.2 23.8 17.3 23.8 18 22.7C18.7 23.8 19.8 23.8 20.6 22.8"
              stroke="#BE185D"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
          {/* Floating mini anime heart */}
          <path
            d="M29.5 11.5C28 10 27 8.8 28 7.8C28.7 7.1 29.4 7.7 29.5 8.2C29.6 7.7 30.3 7.1 31 7.8C32 8.8 31 10 29.5 11.5Z"
            fill="#F43F5E"
            className="anime-rx-float-mini"
          />
        </svg>
      );

    case "fire":
      // Hype / Aura Flame! Flickering Super-Saiyan / Demon Slayer anime spirit fire
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <g className="anime-rx-flame">
            {/* Outer crimson-purple spirit aura */}
            <path
              d="M18 4C18 4 27 11.5 27 20.5C27 26.5 22.9 31 18 31C13.1 31 9 26.5 9 20.5C9 15.5 12.2 11.8 13.6 10.5C13.4 13 14.8 14.3 15.5 14.3C14.7 10.5 18 4 18 4Z"
              fill={`url(#${flameGradientId})`}
            />
            {/* Inner golden core */}
            <path
              d="M18 13.5C18 13.5 22.8 17.8 22.8 22.8C22.8 26 20.6 28.5 18 28.5C15.4 28.5 13.2 26 13.2 22.8C13.2 19.5 15.5 16.5 18 13.5Z"
              fill="#FDE047"
            />
            {/* Determined anime eye glare inside flame */}
            <path d="M14.5 22.2L17 23.2L15 24Z" fill="#7C2D12" />
            <path d="M21.5 22.2L19 23.2L21 24Z" fill="#7C2D12" />
          </g>
          {/* Floating energy sparks */}
          <circle cx="8" cy="11" r="1.5" fill="#FACC15" className="anime-rx-twinkle" />
          <circle cx="29" cy="10" r="1.3" fill="#FB923C" className="anime-rx-float-mini" />
          <defs>
            <linearGradient id={flameGradientId} x1="18" y1="4" x2="18" y2="31" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F97316" />
              <stop offset="55%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#9333EA" />
            </linearGradient>
          </defs>
        </svg>
      );

    case "funny":
      // Kusa! Laughing anime chibi with >< squinting eyes & bobbing anime sweatdrop
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <g className="anime-rx-laugh">
            <circle cx="18" cy="19" r="10.8" fill="#FEF08A" stroke="#EAB308" strokeWidth="1.6" />
            {/* > < squinting anime eyes */}
            <path
              d="M10.5 15.5L14 17.5L10.5 19.5"
              stroke="#451A03"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M25.5 15.5L22 17.5L25.5 19.5"
              stroke="#451A03"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Wide anime laugh mouth */}
            <path
              d="M12.5 21.2C14.5 25.8 21.5 25.8 23.5 21.2Z"
              fill="#EF4444"
              stroke="#7F1D1D"
              strokeWidth="1.2"
            />
            <path d="M14.2 21.6H21.8" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
            {/* Animated anime sweatdrop */}
            <path
              d="M28 7C28 7 30.8 10.6 30.8 12.5C30.8 14 29.5 15.2 28 15.2C26.5 15.2 25.2 14 25.2 12.5C25.2 10.6 28 7 28 7Z"
              fill="#38BDF8"
              stroke="#0284C7"
              strokeWidth="1"
              className="anime-rx-sweat"
            />
          </g>
        </svg>
      );

    case "sad":
      // Feels! Glossy anime teary face with shimmering falling tear drops
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <g className="anime-rx-bob">
            <circle cx="18" cy="18.5" r="10.8" fill="#E0F2FE" stroke="#60A5FA" strokeWidth="1.6" />
            {/* Worried curved eyebrows */}
            <path d="M10.8 14.8C12 13.8 13.8 13.6 15 14.3" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M25.2 14.8C24 13.8 22.2 13.6 21 14.3" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" />
            {/* Big glossy anime teary eyes */}
            <ellipse cx="13" cy="18" rx="2.3" ry="2.8" fill="#1D4ED8" />
            <ellipse cx="23" cy="18" rx="2.3" ry="2.8" fill="#1D4ED8" />
            <circle cx="12.2" cy="17" r="0.9" fill="#FFFFFF" />
            <circle cx="22.2" cy="17" r="0.9" fill="#FFFFFF" />
            {/* Shimmering falling tears */}
            <path
              d="M11.6 21.5C11.6 21.5 10 24.4 10 25.8C10 26.8 10.8 27.6 11.6 27.6C12.4 27.6 13.2 26.8 13.2 25.8C13.2 24.4 11.6 21.5 11.6 21.5Z"
              fill="#38BDF8"
              className="anime-rx-tear"
            />
            <path
              d="M24.4 21.5C24.4 21.5 22.8 24.4 22.8 25.8C22.8 26.8 23.6 27.6 24.4 27.6C25.2 27.6 26 26.8 26 25.8C26 24.4 24.4 21.5 24.4 21.5Z"
              fill="#38BDF8"
              className="anime-rx-tear"
            />
            {/* Quivering sad mouth */}
            <path
              d="M15.2 24.4C16.6 22.8 19.4 22.8 20.8 24.4"
              stroke="#1E3A8A"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        </svg>
      );
  }
}
