import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flag, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { reportsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  animeId: number;
  animeTitle: string;
  animeImage?: string | null;
  episodeNumber: number;
  serverName: string;
  category: string;
}

const REPORT_REASONS = [
  "Video not loading / Server error",
  "Stops or buffers mid-episode",
  "Wrong episode playing",
  "Subtitles missing or out of sync",
  "Audio missing or out of sync",
  "Other issue",
];

export function ReportModal({
  isOpen,
  onClose,
  animeId,
  animeTitle,
  animeImage,
  episodeNumber,
  serverName,
  category,
}: ReportModalProps) {
  const { session } = useAuth();
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClose = () => {
    setSubmitted(false);
    setErrorMsg(null);
    setDetails("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await reportsApi.submitReport(
        {
          anime_id: animeId,
          anime_title: animeTitle,
          anime_image: animeImage || null,
          episode_number: episodeNumber,
          server_name: serverName || "Default Server",
          category: category || "SUB",
          reason: selectedReason,
          details: details.trim(),
        },
        session?.access_token
      );
      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md bg-card/95 border-border/60 backdrop-blur-xl shadow-2xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Report Received!</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
                Thank you for letting us know. Our admin has been notified about{" "}
                <span className="text-white font-semibold">
                  {animeTitle} — Episode {episodeNumber}
                </span>{" "}
                and will fix the stream shortly.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleClose}
              className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white font-bold mt-2 cursor-pointer"
            >
              Back to Video
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="text-left space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Flag className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-white">
                    Report Broken Video
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Let the admin know if this episode isn&apos;t working properly.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Target Episode Summary Box */}
            <div className="bg-secondary/40 border border-border/60 rounded-xl p-3 flex items-center gap-3">
              {animeImage && (
                <img
                  src={animeImage}
                  alt={animeTitle}
                  className="w-10 h-14 object-cover rounded-lg shrink-0 border border-border/40"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-bold text-white truncate">{animeTitle}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold">
                    Episode {episodeNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-secondary text-foreground border border-border/50 text-[10px] font-semibold">
                    {serverName || "Default"} ({category || "SUB"})
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  What&apos;s the issue?
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {REPORT_REASONS.map((reason) => {
                    const active = selectedReason === reason;
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setSelectedReason(reason)}
                        className={`text-left px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                          active
                            ? "bg-primary/15 border-primary text-white font-semibold shadow-sm"
                            : "bg-secondary/30 border-border/50 text-muted-foreground hover:text-white hover:bg-secondary/60"
                        }`}
                      >
                        <span>{reason}</span>
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            active ? "border-primary bg-primary" : "border-muted-foreground/50"
                          }`}
                        >
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Additional details (Optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="e.g., Video stops at 12:30, or wrong subtitles for this episode..."
                  rows={2}
                  maxLength={400}
                  className="w-full rounded-xl bg-secondary/40 border border-border/60 px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-4 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Flag className="w-3.5 h-3.5 mr-1.5" />
                      Submit Report
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export default ReportModal;

