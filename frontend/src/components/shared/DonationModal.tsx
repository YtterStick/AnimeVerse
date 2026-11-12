import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, ShieldCheck, Sparkles, Coffee } from "lucide-react";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TREATS = [
  {
    id: "coffee",
    emoji: "☕",
    label: "Hot Coffee",
    note: "Keeping the stream servers wide awake all night!",
  },
  {
    id: "boba",
    emoji: "🧋",
    label: "Milk Tea",
    note: "Extra sugar & tapioca boost for faster bug fixes!",
  },
  {
    id: "ramen",
    emoji: "🍜",
    label: "Ichiraku Ramen",
    note: "Legendary feast fueling zero-ad anime streaming!",
  },
] as const;

export function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [stage, setStage] = useState<"brewing" | "ready">("brewing");
  const [selectedTreat, setSelectedTreat] = useState<(typeof TREATS)[number]>(TREATS[0]);
  const [heartBurstKey, setHeartBurstKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setStage("brewing");
    setHeartBurstKey(0);
    const timer = window.setTimeout(() => {
      setStage("ready");
    }, 1150);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleSelectTreat = (treat: (typeof TREATS)[number]) => {
    setSelectedTreat(treat);
    setHeartBurstKey((k) => k + 1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/95 border-border/60 backdrop-blur-xl shadow-2xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="text-center sm:text-center space-y-2">
          <div className="relative mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/20 via-amber-500/20 to-primary/20 border border-pink-500/30 flex items-center justify-center shadow-lg shadow-pink-500/10">
            {stage === "brewing" ? (
              <Coffee className="w-6 h-6 text-amber-300 anime-rx-bob" />
            ) : (
              <Heart className="w-6 h-6 text-pink-400 fill-pink-400/40 anime-rx-heart" />
            )}
            <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 anime-rx-twinkle" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-white flex items-center justify-center gap-2">
            {stage === "brewing" ? "Brewing Your Coffee..." : "Support AniVerse"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
            Help keep AniVerse fast, ad-free, and running smoothly. 100% of support funds server &amp; streaming uptime.
          </DialogDescription>
        </DialogHeader>

        {stage === "brewing" ? (
          /* Stage 1: Cute Animated Anime Coffee Mug Brewing Reveal */
          <div className="py-8 flex flex-col items-center justify-center space-y-5 select-none animate-fade-in">
            <button
              type="button"
              onClick={() => setStage("ready")}
              className="relative w-36 h-36 flex items-center justify-center cursor-pointer focus:outline-none group"
              title="Click to reveal QR code"
              aria-label="Skip coffee animation and show QR code"
            >
              {/* Warm ambient glow */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-amber-500/25 via-pink-500/20 to-primary/25 blur-xl animate-pulse" />

              {/* Animated Steaming Kawaii Coffee Cup SVG */}
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

              {/* Floating hearts & sparkles */}
              <Heart className="w-4 h-4 text-pink-400 fill-pink-400 absolute top-4 left-2 anime-rx-float-mini" />
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 absolute bottom-6 right-1 anime-rx-heart" />
            </button>

            <div className="text-center space-y-1.5">
              <p className="text-sm font-bold text-amber-200">
                Preparing a fresh cup with gratitude...
              </p>
              <p className="text-[11px] text-muted-foreground">
                Every coffee helps keep AniVerse 100% popup-free ✨
              </p>
            </div>

            {/* Quick skip hint */}
            <button
              type="button"
              onClick={() => setStage("ready")}
              className="text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors cursor-pointer"
            >
              Show QR now →
            </button>
          </div>
        ) : (
          /* Stage 2: Smooth Pop-In Reveal with Treat Mood Selector & QR Code */
          <div className="space-y-4 pt-1 qr-reveal-pop">
            {/* Fun interactive treat selector */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {TREATS.map((treat) => {
                  const active = selectedTreat.id === treat.id;
                  return (
                    <button
                      key={treat.id}
                      type="button"
                      onClick={() => handleSelectTreat(treat)}
                      className={`relative flex flex-col items-center justify-center py-2 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                        active
                          ? "bg-gradient-to-b from-pink-500/20 to-primary/20 border-pink-400/60 text-white shadow-md shadow-pink-500/15 scale-[1.03]"
                          : "bg-secondary/40 hover:bg-secondary/70 border-border/50 text-muted-foreground hover:text-white"
                      }`}
                    >
                      <span className={`text-lg leading-none mb-1 ${active ? "anime-rx-bob" : ""}`}>
                        {treat.emoji}
                      </span>
                      <span className="text-[11px] truncate max-w-full">{treat.label}</span>
                      {active && heartBurstKey > 0 && (
                        <span
                          key={heartBurstKey}
                          className="pointer-events-none absolute -top-2 right-2 text-pink-400 text-xs anime-rx-burst"
                        >
                          💖
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-center text-amber-200/90 font-medium bg-amber-500/10 border border-amber-500/20 rounded-lg py-1.5 px-3">
                {selectedTreat.emoji} {selectedTreat.note}
              </p>
            </div>

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

