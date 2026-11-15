import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  Monitor,
  Smartphone,
  RefreshCw,
  Share,
  MoreVertical,
  PlusSquare,
  CheckCircle2,
  Sparkles,
  Tv,
  ShieldCheck,
  Heart,
  X,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaStoreState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
}

const BANNER_DISMISSED_KEY = "aniverse:install-banner-dismissed";
const listeners = new Set<() => void>();

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: window-controls-overlay)").matches === true ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

let pwaState: PwaStoreState = {
  deferredPrompt: null,
  isInstalled: detectStandalone(),
};

function notifyPwaListeners() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pwaState = {
      ...pwaState,
      deferredPrompt: e as BeforeInstallPromptEvent,
    };
    notifyPwaListeners();
  });

  window.addEventListener("appinstalled", () => {
    pwaState = {
      deferredPrompt: null,
      isInstalled: true,
    };
    notifyPwaListeners();
  });

  const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
  mediaQuery?.addEventListener?.("change", () => {
    pwaState = {
      ...pwaState,
      isInstalled: detectStandalone(),
    };
    notifyPwaListeners();
  });
}

function subscribePwa(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getPwaSnapshot(): PwaStoreState {
  return pwaState;
}

export function usePwaInstall() {
  const snapshot = useSyncExternalStore(subscribePwa, getPwaSnapshot, getPwaSnapshot);

  const triggerNativeInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const promptEvent = snapshot.deferredPrompt;
    if (!promptEvent) return "unavailable";
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      pwaState = {
        deferredPrompt: null,
        isInstalled: choice.outcome === "accepted" ? true : detectStandalone(),
      };
      notifyPwaListeners();
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  };

  return {
    canPromptNative: Boolean(snapshot.deferredPrompt) && !snapshot.isInstalled,
    isInstalled: snapshot.isInstalled,
    triggerNativeInstall,
  };
}

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const APP_FEATURES = [
  { icon: Tv, label: "Full-Screen Window" },
  { icon: ShieldCheck, label: "Ad-Free HD" },
  { icon: RefreshCw, label: "Instant Auto-Update" },
  { icon: Heart, label: "Syncs Watchlist" },
];

export function InstallAppModal({ isOpen, onClose }: InstallAppModalProps) {
  const { canPromptNative, isInstalled, triggerNativeInstall } = usePwaInstall();
  const [tab, setTab] = useState<"mobile" | "desktop">(() => {
    if (typeof navigator !== "undefined" && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) {
      return "mobile";
    }
    return "desktop";
  });
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isOpen && typeof navigator !== "undefined") {
      setTab(
        /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || window.innerWidth < 768
          ? "mobile"
          : "desktop"
      );
    }
  }, [isOpen]);

  const handleInstallClick = async () => {
    setInstalling(true);
    const outcome = await triggerNativeInstall();
    setInstalling(false);
    if (outcome === "accepted") {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border/80 text-foreground rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Install AniVerse App</DialogTitle>
          <DialogDescription>
            Install AniVerse on Mobile or Desktop for standalone playback and automatic updates.
          </DialogDescription>
        </DialogHeader>

        {/* Visual App Store-Style Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-pink-500/10 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/60 to-pink-500/50 blur-md opacity-70" />
              <img
                src="/pwa-192x192.png"
                alt="AniVerse App Icon"
                className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl border border-white/15 shadow-xl object-cover"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight">AniVerse</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                  Official App
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Mobile &bull; Desktop &bull; TV Mode
              </p>
              <p className="text-[11px] text-foreground/80">
                Standalone HD anime streaming app — updates automatically.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {APP_FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-[11px] font-medium text-foreground/90"
              >
                <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>

          {/* Primary Native Install CTA or Already Installed Status */}
          {isInstalled ? (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 text-xs sm:text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>AniVerse is already running as an installed app on this device.</span>
            </div>
          ) : (
            canPromptNative && (
              <Button
                type="button"
                disabled={installing}
                onClick={handleInstallClick}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary via-purple-600 to-pink-600 hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-primary/30 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4" />
                <span>{installing ? "Installing AniVerse..." : "Install AniVerse App Now"}</span>
                <Download className="w-4 h-4" />
              </Button>
            )
          )}
        </div>

        <div className="space-y-4 mt-1">
          {/* Platform Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary/60 border border-border/50">
            <button
              type="button"
              onClick={() => setTab("mobile")}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tab === "mobile"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile (Android / iOS)</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("desktop")}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tab === "desktop"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop (PC / Mac)</span>
            </button>
          </div>

          {tab === "mobile" ? (
            <div className="space-y-3">
              {/* Android */}
              <div className="p-3.5 rounded-xl bg-secondary/35 border border-border/40 space-y-2.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Android (Chrome, Edge, or Brave)</span>
                </h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                      1
                    </span>
                    <p>
                      Open AniVerse in <span className="text-foreground font-semibold">Chrome</span> on Android.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                      2
                    </span>
                    <p>
                      Tap <span className="text-foreground font-semibold">Install AniVerse App Now</span> above, or tap{" "}
                      <MoreVertical className="w-3.5 h-3.5 inline mx-0.5 text-foreground" />
                      <span className="text-foreground font-semibold">Menu</span> in Chrome.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                      3
                    </span>
                    <p>
                      Tap <span className="text-foreground font-semibold">Add to Home screen</span> &rarr;{" "}
                      <span className="text-foreground font-semibold">Install</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* iPhone / iPad */}
              <div className="p-3.5 rounded-xl bg-secondary/35 border border-border/40 space-y-2.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <PlusSquare className="w-3.5 h-3.5 text-sky-400" />
                  <span>iPhone &amp; iPad (Safari)</span>
                </h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                      1
                    </span>
                    <p>
                      Open AniVerse in <span className="text-foreground font-semibold">Safari</span> (required by iOS for web app install).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                      2
                    </span>
                    <p>
                      Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-foreground" />
                      <span className="text-foreground font-semibold">Share</span> button in the bottom bar.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                      3
                    </span>
                    <p>
                      Scroll down, tap <span className="text-foreground font-semibold">Add to Home Screen</span> &rarr;{" "}
                      <span className="text-foreground font-semibold">Add</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-secondary/35 border border-border/40 space-y-2.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-primary" />
                <span>Windows / macOS (Chrome, Edge, or Brave)</span>
              </h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <p>
                    Open AniVerse in <span className="text-foreground font-semibold">Google Chrome</span>,{" "}
                    <span className="text-foreground font-semibold">Microsoft Edge</span>, or{" "}
                    <span className="text-foreground font-semibold">Brave</span>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <p>
                    Click <span className="text-foreground font-semibold">Install AniVerse App Now</span> above, OR click the{" "}
                    <Download className="w-3.5 h-3.5 inline mx-0.5 text-foreground" />
                    <span className="text-foreground font-semibold">Install icon</span> on the right side of the browser address bar.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <p>
                    Click <span className="text-foreground font-semibold">Install</span> &mdash; AniVerse opens in its own standalone window and can be pinned to your Taskbar, Start Menu, or Dock.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Auto-update reassurance */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/70 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
            <RefreshCw className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Automatic Updates:</span> Whenever new features or fixes are deployed, your installed mobile or desktop app loads the latest version automatically on launch &mdash; no manual reinstall needed.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InstallAppBanner() {
  const location = useLocation();
  const { canPromptNative, isInstalled, triggerNativeInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [showGuide, setShowGuide] = useState(false);

  const isWatching = location.pathname.startsWith("/watch/");
  if (isInstalled || dismissed || isWatching) {
    return <InstallAppModal isOpen={showGuide} onClose={() => setShowGuide(false)} />;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleInstall = async () => {
    if (canPromptNative) {
      const outcome = await triggerNativeInstall();
      if (outcome === "accepted") return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:left-6 sm:bottom-6 sm:max-w-sm z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-primary/35 shadow-2xl shadow-black/60">
          <img
            src="/pwa-192x192.png"
            alt="AniVerse"
            className="w-11 h-11 rounded-xl border border-white/10 shadow-md shrink-0 object-cover"
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-white truncate">Install AniVerse App</p>
            <p className="text-[11px] text-muted-foreground truncate">
              Full-screen &bull; Auto-updates on Mobile &amp; PC
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={handleInstall}
              className="h-8 px-3 rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm cursor-pointer"
            >
              Install
            </Button>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="h-8 px-2.5 rounded-full text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-secondary/70 hover:bg-secondary border border-border/50 transition-colors cursor-pointer hidden xs:inline-flex items-center"
            >
              Guide
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
              title="Dismiss"
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <InstallAppModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
}

export default InstallAppModal;
