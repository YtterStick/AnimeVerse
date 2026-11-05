import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Copy, Check, Gift, ShieldCheck, Sparkles } from "lucide-react";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [copied, setCopied] = useState(false);
  const referralCode = "AD231757";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/95 border-border/60 backdrop-blur-xl shadow-2xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center sm:text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/20 via-purple-500/20 to-primary/20 border border-pink-500/30 flex items-center justify-center shadow-lg shadow-pink-500/10">
            <Heart className="w-6 h-6 text-pink-400 fill-pink-400/30 animate-pulse" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-white flex items-center justify-center gap-2">
            Support AniVerse
            <Sparkles className="w-5 h-5 text-amber-400" />
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
            Help keep AniVerse fast, ad-free, and running smoothly. 100% of donations fund server and database maintenance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* QR Code Container */}
          <div className="relative mx-auto w-64 bg-white p-3 rounded-2xl shadow-xl border-4 border-primary/20 flex flex-col items-center">
            <img
              src="/donation-qr.jpg"
              alt="MariBank InstaPay Donation QR Code - Andrei Dilag"
              className="w-full h-auto object-contain rounded-lg"
            />
            <div className="mt-2 text-center">
              <p className="text-[11px] font-bold text-gray-900 tracking-wide uppercase">
                ANDREI DILAG
              </p>
              <p className="text-[10px] text-gray-600 font-medium">
                MariBank / InstaPay (****1496)
              </p>
            </div>
          </div>

          {/* Quick instructions badge */}
          <div className="bg-secondary/50 border border-border/60 rounded-xl p-3 text-xs text-muted-foreground flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Scan with GCash, Maya, ShopeePay, BDO, BPI, or any InstaPay-supported banking app.</span>
          </div>

          {/* Referral Reward Box */}
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">MariBank Referral Bonus</span>
              </div>
              <span className="text-[10px] font-bold text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                Up to ₱588
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Sign up for a MariBank account using this referral code and get up to ₱588 welcome rewards!
            </p>
            <div className="flex items-center gap-2 pt-1">
              <code className="flex-1 px-3 py-1.5 bg-black/40 rounded-lg text-xs font-mono font-bold text-white border border-amber-500/30 tracking-wider">
                {referralCode}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="h-8 text-xs font-bold border-amber-500/40 hover:bg-amber-500/20 text-amber-300 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Close Action */}
          <Button
            type="button"
            onClick={onClose}
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DonationModal;
