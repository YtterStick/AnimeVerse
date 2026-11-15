import { useState, useSyncExternalStore } from "react";
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
  CheckCircle2,
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

type InstallPlatform = "desktop" | "android" | "ios";

const PLATFORM_TABS: { id: InstallPlatform; label: string; steps: string[] }[] = [
  {
    id: "desktop",
    label: "Desktop",
    steps: [
      'Click "Install App" above, or click the install icon in your browser\'s address bar.',
      'Confirm "Install" to add AniVerse to your desktop.',
    ],
  },
  {
    id: "android",
    label: "Android",
    steps: [
      'Tap "Install App" above, or open the browser menu (⋮).',
      'Tap "Install app" or "Add to Home screen".',
    ],
  },
  {
    id: "ios",
    label: "iPhone",
    steps: [
      "Open in Safari and tap Share at the bottom.",
      'Tap "Add to Home Screen", then tap "Add".',
    ],
  },
];

function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export function InstallAppModal({ isOpen, onClose }: InstallAppModalProps) {
  const { canPromptNative, isInstalled, triggerNativeInstall } = usePwaInstall();
  const [tab, setTab] = useState<InstallPlatform>(detectPlatform);

  const handleInstallClick = async () => {
    onClose();
    await triggerNativeInstall();
  };

  const activeTab = PLATFORM_TABS.find((item) => item.id === tab) ?? PLATFORM_TABS[0];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm bg-card border-border text-foreground rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3 pr-6">
          <img
            src="/pwa-192x192.png"
            alt="AniVerse"
            className="w-11 h-11 rounded-xl border border-border shrink-0 object-cover"
          />
          <DialogHeader className="text-left space-y-0.5">
            <DialogTitle className="text-base font-semibold text-foreground">
              Install AniVerse
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Use AniVerse in its own window on desktop or mobile.
            </DialogDescription>
          </DialogHeader>
        </div>

        {isInstalled ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Already installed on this device.</span>
          </div>
        ) : (
          canPromptNative && (
            <Button
              type="button"
              onClick={handleInstallClick}
              className="w-full h-9 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Install App
            </Button>
          )
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-secondary/50 text-xs">
            {PLATFORM_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`py-1.5 px-2 rounded-md font-medium transition-colors cursor-pointer ${
                  tab === item.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground pt-1">
            {activeTab.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
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
      await triggerNativeInstall();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:left-6 sm:bottom-6 sm:max-w-xs z-40">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg">
          <img
            src="/pwa-192x192.png"
            alt="AniVerse"
            className="w-9 h-9 rounded-lg border border-border shrink-0 object-cover"
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">Install AniVerse</p>
            <p className="text-[11px] text-muted-foreground truncate">
              Desktop &amp; mobile app
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={handleInstall}
              className="h-7 px-3 rounded-lg text-xs font-medium bg-primary hover:bg-primary/90 text-white cursor-pointer"
            >
              Install
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
              title="Dismiss"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
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
