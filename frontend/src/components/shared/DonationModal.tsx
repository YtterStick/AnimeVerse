import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, ShieldCheck, Sparkles, Coffee, CupSoda, Soup } from "lucide-react";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TreatId = "coffee" | "boba" | "ramen";

interface TreatTheme {
  id: TreatId;
  brewingTitle: string;
  brewingText: string;
  subText: string;
  glowClass: string;
  icon: typeof Coffee;
  iconColorClass: string;
}

const TREAT_THEMES: TreatTheme[] = [
  {
    id: "coffee",
    brewingTitle: "Brewing a Coffee...",
    brewingText: "Keeping the stream servers wide awake all night!",
    subText: "Every coffee helps keep AniVerse 100% popup-free ✨",
    glowClass: "from-amber-500/25 via-pink-500/20 to-primary/25",
    icon: Coffee,
    iconColorClass: "text-amber-300",
  },
  {
    id: "boba",
    brewingTitle: "Mixing Fresh Milk Tea...",
    brewingText: "Extra pearls & energy for faster fixes and episodes!",
    subText: "Every milk tea helps keep AniVerse 100% popup-free ✨",
    glowClass: "from-pink-500/25 via-amber-400/20 to-purple-500/25",
    icon: CupSoda,
    iconColorClass: "text-pink-300",
  },
  {
    id: "ramen",
    brewingTitle: "Serving Hot Ramen...",
    brewingText: "Ichiraku-grade fuel for zero-ad anime streaming!",
    subText: "Every bowl helps keep AniVerse 100% popup-free ✨",
    glowClass: "from-orange-500/25 via-rose-500/20 to-amber-400/25",
    icon: Soup,
    iconColorClass: "text-orange-300",
  },
];

function TreatAnimationSvg({ id }: { id: TreatId }) {
  if (id === "boba") {
    return (
      <svg viewBox="0 0 120 120" className="w-32 h-32 relative z-10 drop-shadow-xl">
        {/* Boba straw */}
        <path
          d="M66 12 L59 54"
          stroke="#F472B6"
          strokeWidth="6"
          strokeLinecap="round"
          className="anime-rx-bob"
        />
        <path
          d="M66 12 L74 8"
          stroke="#F472B6"
          strokeWidth="6"
          strokeLinecap="round"
          className="anime-rx-bob"
        />

        {/* Cup shadow */}
        <ellipse cx="58" cy="106" rx="28" ry="5" fill="#4C1D95" opacity="0.6" />

        {/* Cup body & clip */}
        <clipPath id="bobaClip">
          <path d="M35 38 H81 L74 100 C73 103, 70 104, 67 104 H49 C46 104, 43 103, 42 100 Z" />
        </clipPath>
        <path
          d="M35 38 H81 L74 100 C73 103, 70 104, 67 104 H49 C46 104, 43 103, 42 100 Z"
          fill="#FFFBEB"
          opacity="0.92"
        />

        {/* Rising milk tea liquid + pearls */}
        <g clipPath="url(#bobaClip)">
          <rect
            x="33"
            y="48"
            width="52"
            height="60"
            fill="#D97706"
            opacity="0.85"
            className="coffee-liquid-fill"
          />
          <rect
            x="33"
            y="48"
            width="52"
            height="14"
            fill="#FDE68A"
            opacity="0.55"
            className="coffee-liquid-fill"
          />
          {/* Tapioca boba pearls */}
          <circle cx="47" cy="96" r="3.6" fill="#27272A" />
          <circle cx="56" cy="98" r="3.6" fill="#18181B" />
          <circle cx="65" cy="96" r="3.6" fill="#27272A" />
          <circle cx="52" cy="91" r="3.3" fill="#18181B" />
          <circle cx="61" cy="91" r="3.3" fill="#27272A" />
        </g>

        {/* Dome lid */}
        <path d="M34 38 C36 22, 80 22, 82 38 Z" fill="#FBCFE8" opacity="0.85" />
        <rect x="31" y="36" width="54" height="5" rx="2.5" fill="#F9A8D4" />

        {/* Kawaii face */}
        <circle cx="49" cy="68" r="2.5" fill="#1E1B4B" />
        <circle cx="67" cy="68" r="2.5" fill="#1E1B4B" />
        <circle cx="44" cy="72" r="2.8" fill="#FB7185" opacity="0.65" />
        <circle cx="72" cy="72" r="2.8" fill="#FB7185" opacity="0.65" />
        <path
          d="M54 71 Q58 75 62 71"
          fill="none"
          stroke="#1E1B4B"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (id === "ramen") {
    return (
      <svg viewBox="0 0 120 120" className="w-32 h-32 relative z-10 drop-shadow-xl">
        {/* Rising steam */}
        <path
          d="M42 36 C39 29, 46 24, 42 17"
          fill="none"
          stroke="#FDE68A"
          strokeWidth="3"
          strokeLinecap="round"
          className="coffee-steam-1"
        />
        <path
          d="M58 32 C55 24, 62 19, 58 11"
          fill="none"
          stroke="#FBCFE8"
          strokeWidth="3"
          strokeLinecap="round"
          className="coffee-steam-2"
        />
        <path
          d="M74 36 C71 29, 78 24, 74 17"
          fill="none"
          stroke="#FDE68A"
          strokeWidth="3"
          strokeLinecap="round"
          className="coffee-steam-3"
        />

        {/* Chopsticks + lifted noodles bobbing */}
        <g className="anime-rx-bob">
          <path d="M56 32 L98 20" stroke="#FDE047" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M58 39 L98 31" stroke="#FACC15" strokeWidth="3.5" strokeLinecap="round" />
          <path
            d="M56 38 Q52 48 56 56 M61 38 Q65 48 61 56 M66 37 Q62 47 66 56"
            fill="none"
            stroke="#FDE047"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>

        {/* Broth & Narutomaki topping */}
        <ellipse cx="58" cy="58" rx="34" ry="8" fill="#F59E0B" />
        <circle cx="42" cy="56" r="6" fill="#FFFFFF" />
        <path d="M40 56 C40 53, 44 53, 44 56 C44 58, 41 58, 42 55" fill="none" stroke="#EC4899" strokeWidth="1.8" strokeLinecap="round" />
        <ellipse cx="75" cy="55" rx="6.5" ry="4.5" fill="#FEF3C7" />
        <circle cx="75" cy="55" r="2.6" fill="#F97316" />

        {/* Ramen bowl base & body */}
        <rect x="42" y="95" width="32" height="7" rx="3" fill="#9F1239" />
        <path
          d="M22 58 H94 C94 84, 78 96, 58 96 C38 96, 22 84, 22 58 Z"
          fill="#E11D48"
        />
        <path d="M24 62 H92" stroke="#FDE047" strokeWidth="2.5" opacity="0.75" />

        {/* Kawaii face on bowl */}
        <circle cx="47" cy="76" r="2.6" fill="#1E1B4B" />
        <circle cx="69" cy="76" r="2.6" fill="#1E1B4B" />
        <circle cx="42" cy="80" r="3" fill="#FBCFE8" opacity="0.75" />
        <circle cx="74" cy="80" r="3" fill="#FBCFE8" opacity="0.75" />
        <path
          d="M54 79 Q58 83 62 79"
          fill="none"
          stroke="#1E1B4B"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Default: Hot Coffee
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32 relative z-10 drop-shadow-xl">
      {/* Steam wisps */}
      <path
        d="M44 36 C41 29, 48 24, 44 17"
        fill="none"
        stroke="#FDE68A"
        strokeWidth="3"
        strokeLinecap="round"
        className="coffee-steam-1"
      />
      <path
        d="M58 34 C55 26, 62 21, 58 13"
        fill="none"
        stroke="#FBCFE8"
        strokeWidth="3"
        strokeLinecap="round"
        className="coffee-steam-2"
      />
      <path
        d="M72 36 C69 29, 76 24, 72 17"
        fill="none"
        stroke="#FDE68A"
        strokeWidth="3"
        strokeLinecap="round"
        className="coffee-steam-3"
      />

      {/* Cup saucer */}
      <ellipse cx="58" cy="102" rx="34" ry="6" fill="#4C1D95" opacity="0.65" />

      {/* Mug handle */}
      <path
        d="M84 56 C98 56, 98 80, 82 80"
        fill="none"
        stroke="#F5F3FF"
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* Mug body outline */}
      <clipPath id="mugClip">
        <path d="M30 46 H86 V78 C86 92, 74 99, 58 99 C42 99, 30 92, 30 78 Z" />
      </clipPath>
      <path
        d="M30 46 H86 V78 C86 92, 74 99, 58 99 C42 99, 30 92, 30 78 Z"
        fill="#EDE9FE"
      />

      {/* Rising coffee fill inside mug */}
      <g clipPath="url(#mugClip)">
        <rect
          x="28"
          y="52"
          width="60"
          height="50"
          fill="#92400E"
          className="coffee-liquid-fill"
        />
        <ellipse cx="58" cy="54" rx="28" ry="4" fill="#B45309" />
      </g>

      {/* Cute kawaii eyes & blush on mug */}
      <circle cx="48" cy="73" r="2.6" fill="#1E1B4B" />
      <circle cx="68" cy="73" r="2.6" fill="#1E1B4B" />
      <circle cx="43" cy="77" r="3" fill="#F472B6" opacity="0.65" />
      <circle cx="73" cy="77" r="3" fill="#F472B6" opacity="0.65" />
      <path
        d="M54 76 Q58 80 62 76"
        fill="none"
        stroke="#1E1B4B"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Cup rim */}
      <ellipse cx="58" cy="46" rx="28" ry="4.5" fill="#DDD6FE" />
      <ellipse cx="58" cy="46" rx="24" ry="3" fill="#78350F" />
    </svg>
  );
}

export function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [stage, setStage] = useState<"brewing" | "ready">("brewing");
  const [treatIndex, setTreatIndex] = useState<number>(() =>
    Math.floor(Math.random() * TREAT_THEMES.length)
  );

  useEffect(() => {
    if (!isOpen) return;
    // Pick a random treat each time (rotating away from previous so repeated opens vary)
    setTreatIndex((prev) => {
      const candidates = [0, 1, 2].filter((idx) => idx !== prev);
      return candidates[Math.floor(Math.random() * candidates.length)];
    });
    setStage("brewing");
    const timer = window.setTimeout(() => {
      setStage("ready");
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const activeTreat = TREAT_THEMES[treatIndex] || TREAT_THEMES[0];
  const TreatHeaderIcon = activeTreat.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/95 border-border/60 backdrop-blur-xl shadow-2xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="text-center sm:text-center space-y-2">
          <div className="relative mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/20 via-amber-500/20 to-primary/20 border border-pink-500/30 flex items-center justify-center shadow-lg shadow-pink-500/10">
            {stage === "brewing" ? (
              <TreatHeaderIcon className={`w-6 h-6 ${activeTreat.iconColorClass} anime-rx-bob`} />
            ) : (
              <Heart className="w-6 h-6 text-pink-400 fill-pink-400/40 anime-rx-heart" />
            )}
            <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 anime-rx-twinkle" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-white flex items-center justify-center gap-2">
            {stage === "brewing" ? activeTreat.brewingTitle : "Support AniVerse"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
            Help keep AniVerse fast, ad-free, and running smoothly. 100% of support funds server &amp; streaming uptime.
          </DialogDescription>
        </DialogHeader>

        {stage === "brewing" ? (
          /* Stage 1: Randomized Kawaii Treat Reveal Animation (Coffee / Milk Tea / Ramen) */
          <div className="py-8 flex flex-col items-center justify-center space-y-5 select-none animate-fade-in">
            <button
              type="button"
              onClick={() => setStage("ready")}
              className="relative w-36 h-36 flex items-center justify-center cursor-pointer focus:outline-none group"
              title="Click to reveal QR code"
              aria-label="Skip animation and show QR code"
            >
              <div
                className={`absolute inset-2 rounded-full bg-gradient-to-tr ${activeTreat.glowClass} blur-xl animate-pulse`}
              />

              <TreatAnimationSvg id={activeTreat.id} />

              {/* Floating hearts & sparkles */}
              <Heart className="w-4 h-4 text-pink-400 fill-pink-400 absolute top-4 left-2 anime-rx-float-mini" />
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 absolute bottom-6 right-1 anime-rx-heart" />
            </button>

            <div className="text-center space-y-1.5">
              <p className="text-sm font-bold text-amber-200">{activeTreat.brewingText}</p>
              <p className="text-[11px] text-muted-foreground">{activeTreat.subText}</p>
            </div>

            <button
              type="button"
              onClick={() => setStage("ready")}
              className="text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors cursor-pointer"
            >
              Show QR now →
            </button>
          </div>
        ) : (
          /* Stage 2: Smooth Pop-In Reveal for QR Code */
          <div className="space-y-4 pt-2 qr-reveal-pop">
            {/* Glowing QR Code Container */}
            <div className="relative mx-auto w-60 sm:w-64">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-pink-500/35 via-purple-500/35 to-amber-400/35 blur-md opacity-80 animate-pulse" />
              <div className="relative bg-white p-3.5 rounded-2xl shadow-2xl border-2 border-white/80 flex flex-col items-center">
                <img
                  src="/donation-qr.jpg"
                  alt="InstaPay Donation QR Code"
                  className="w-full aspect-square object-contain rounded-lg"
                />
                <div className="mt-2.5 text-center">
                  <p className="text-xs font-bold text-gray-900 tracking-wide uppercase">
                    InstaPay QR Code • Any Amount
                  </p>
                  <p className="text-[10px] text-gray-500 font-medium">
                    Scan with GCash, Maya, ShopeePay &amp; Any Bank
                  </p>
                </div>
              </div>
            </div>

            {/* Quick instructions badge */}
            <div className="bg-secondary/50 border border-border/60 rounded-xl p-3 text-xs text-muted-foreground flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Scan with GCash, Maya, ShopeePay, BDO, BPI, or any InstaPay-supported banking app.</span>
            </div>

            {/* Close Action */}
            <Button
              type="button"
              onClick={onClose}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl cursor-pointer"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DonationModal;

