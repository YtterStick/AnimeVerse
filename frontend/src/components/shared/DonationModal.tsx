import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, ShieldCheck } from "lucide-react";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DonationModal({ isOpen, onClose }: DonationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/95 border-border/60 backdrop-blur-xl shadow-2xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center sm:text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/20 via-purple-500/20 to-primary/20 border border-pink-500/30 flex items-center justify-center shadow-lg shadow-pink-500/10">
            <Heart className="w-6 h-6 text-pink-400 fill-pink-400/30 animate-pulse" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-white flex items-center justify-center gap-2">
            Support AniVerse
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
            Help keep AniVerse fast, ad-free, and running smoothly. 100% of donations fund server and database maintenance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* QR Code Container */}
          <div className="relative mx-auto w-64 bg-white p-3.5 rounded-2xl shadow-xl border-4 border-primary/20 flex flex-col items-center">
            <img
              src="/donation-qr.jpg"
              alt="InstaPay Donation QR Code"
              className="w-full aspect-square object-contain rounded-lg"
            />
            <div className="mt-2.5 text-center">
              <p className="text-xs font-bold text-gray-900 tracking-wide uppercase">
                InstaPay QR Code
              </p>
              <p className="text-[10px] text-gray-500 font-medium">
                Scan with GCash, Maya, ShopeePay &amp; Any Bank
              </p>
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

