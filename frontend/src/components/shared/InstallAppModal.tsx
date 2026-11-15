import { useEffect, useState, useSyncExternalStore } from "react";
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
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaStoreState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
}

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
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/35 flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-primary" />
            </div>
            <span>Install AniVerse App</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Run AniVerse full-screen like a native app on your phone or PC — updates arrive automatically with zero re-downloads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Native 1-Click Install Callout or Already Installed Status */}
          {isInstalled ? (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 text-xs sm:text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>AniVerse is already running as an installed app on this device.</span>
            </div>
          ) : (
            canPromptNative && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary/20 via-purple-500/15 to-pink-500/15 border border-primary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Ready for Instant Install
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Your browser supports 1-click app installation on this device.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={installing}
                  onClick={handleInstallClick}
                  className="bg-primary hover:bg-primary/90 text-white rounded-full font-bold px-4 shrink-0 cursor-pointer shadow-md shadow-primary/25"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {installing ? "Installing..." : "Install Now"}
                </Button>
              </div>
            )
          )}

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
              <div className="p-3.5 rounded-xl bg-secondary/35 border border-border/40 space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Android (Chrome, Edge, or Brave)</span>
                </h4>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Open AniVerse in <span className="text-foreground font-medium">Chrome</span> on your phone.</li>
                  <li>
                    Tap the <MoreVertical className="w-3.5 h-3.5 inline mx-0.5 text-foreground" />
                    <span className="text-foreground font-medium">menu button</span> (top right) or the <span className="text-foreground font-medium">Install Now</span> button above.
                  </li>
                  <li>
                    Tap <span className="text-foreground font-medium">Add to Home screen</span> → <span className="text-foreground font-medium">Install</span>.
                  </li>
                </ol>
              </div>

              {/* iPhone / iPad */}
              <div className="p-3.5 rounded-xl bg-secondary/35 border border-border/40 space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <PlusSquare className="w-3.5 h-3.5 text-sky-400" />
                  <span>iPhone &amp; iPad (Safari)</span>
                </h4>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Open AniVerse in <span className="text-foreground font-medium">Safari</span> (required by iOS for web app install).</li>
                  <li>
                    Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-foreground" />
                    <span className="text-foreground font-medium">Share</span> button in the bottom bar.
                  </li>
                  <li>
                    Scroll down, tap <span className="text-foreground font-medium">Add to Home Screen</span>, then tap <span className="text-foreground font-medium">Add</span>.
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-secondary/35 border border-border/40 space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-primary" />
                  <span>Windows / macOS (Chrome, Edge, or Brave)</span>
                </h4>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Open AniVerse in <span className="text-foreground font-medium">Google Chrome</span>, <span className="text-foreground font-medium">Microsoft Edge</span>, or <span className="text-foreground font-medium">Brave</span>.</li>
                  <li>
                    Click <span className="text-foreground font-medium">Install Now</span> above, OR click the <Download className="w-3.5 h-3.5 inline mx-0.5 text-foreground" />
                    <span className="text-foreground font-medium">Install icon</span> on the right side of the browser address bar.
                  </li>
                  <li>
                    Click <span className="text-foreground font-medium">Install</span> — AniVerse opens in its own window and can be pinned to your Taskbar, Start Menu, or Dock.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* Auto-update reassurance */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/70 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
            <RefreshCw className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Automatic Updates:</span> Whenever new features or fixes are deployed, your installed mobile or desktop app loads the latest version automatically on launch — no manual reinstall needed.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InstallAppModal;

