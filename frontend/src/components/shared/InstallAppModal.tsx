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
import { useLayout } from "@/contexts/LayoutContext";
import {
  Download,
  CheckCircle2,
  X,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
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
  deferredPrompt: typeof window !== "undefined" ? (window.__deferredPwaPrompt ?? null) : null,
  isInstalled: detectStandalone(),
};

function notifyPwaListeners() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  const syncDeferredPrompt = (promptEvent: BeforeInstallPromptEvent | null) => {
    window.__deferredPwaPrompt = promptEvent;
    pwaState = {
      ...pwaState,
      deferredPrompt: promptEvent,
    };
    notifyPwaListeners();
  };

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    syncDeferredPrompt(e as BeforeInstallPromptEvent);
  });

  window.addEventListener("aniverse:pwa-prompt", () => {
    syncDeferredPrompt(window.__deferredPwaPrompt ?? null);
  });

  window.addEventListener("appinstalled", () => {
    window.__deferredPwaPrompt = null;
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
    const promptEvent = snapshot.deferredPrompt ?? window.__deferredPwaPrompt ?? null;
    if (!promptEvent) return "unavailable";
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      window.__deferredPwaPrompt = null;
      pwaState = {
        deferredPrompt: null,
        isInstalled: choice.outcome === "accepted" ? true : detectStandalone(),
      };
      notifyPwaListeners();
      return choice.outcome;
    } catch {
      window.__deferredPwaPrompt = null;
      pwaState = {
        ...pwaState,
        deferredPrompt: null,
      };
      notifyPwaListeners();
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

type InstallPlatform = "android" | "ios";

const PLATFORM_TABS: { id: InstallPlatform; label: string }[] = [
  { id: "android", label: "Android" },
  { id: "ios", label: "iPhone" },
];

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isTv = /smart-tv|smarttv|tizen|web0s|webos|netcast|viera|bravia|\btv\b/i.test(ua);
  return !isTv && /android|iphone|ipad|ipod|mobile/i.test(ua);
}

function getPlatformSteps(platform: InstallPlatform, canPromptNative: boolean): string[] {
  if (platform === "ios") {
    return [
      "Open in Safari and tap Share at the bottom.",
      'Tap "Add to Home Screen", then tap "Add".',
    ];
  }
  return [
    canPromptNative
      ? 'Tap "Install App" above, or open the browser menu (⋮).'
      : "Open the browser menu (⋮) in the top-right corner.",
    'Tap "Install app" or "Add to Home screen".',
  ];
}

function detectPlatform(): InstallPlatform {
  if (typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    return "ios";
  }
  return "android";
}

export function InstallAppModal({ isOpen, onClose }: InstallAppModalProps) {
  const { canPromptNative, isInstalled, triggerNativeInstall } = usePwaInstall();
  const [tab, setTab] = useState<InstallPlatform>(detectPlatform);
  const [highlightSteps, setHighlightSteps] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setHighlightSteps(false);
      onClose();
    }
  };

  const handleInstallClick = async () => {
    if (canPromptNative) {
      setHighlightSteps(false);
      onClose();
      await triggerNativeInstall();
      return;
    }
    setHighlightSteps(true);
  };

  const steps = getPlatformSteps(tab, canPromptNative);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
              Install AniVerse on your phone.
            </DialogDescription>
          </DialogHeader>
        </div>

        {isInstalled ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Already installed on this device.</span>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleInstallClick}
            className="w-full h-9 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Install App
          </Button>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-secondary/50 text-xs">
            {PLATFORM_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setHighlightSteps(false);
                }}
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

          <ol
            className={`list-decimal list-inside space-y-1.5 text-xs transition-colors ${
              highlightSteps
                ? "rounded-lg p-2.5 bg-primary/10 border border-primary/40 text-foreground"
                : "pt-1 text-muted-foreground"
            }`}
          >
            {steps.map((step) => (
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
  const { tvMode } = useLayout();
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
  if (isInstalled || dismissed || isWatching || tvMode || !isMobileDevice()) {
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
      <div className="sm:hidden fixed bottom-14 left-4 right-4 z-50">
        <div
          role="button"
          tabIndex={0}
          onClick={handleInstall}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void handleInstall();
            }
          }}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-card/95 backdrop-blur-md border border-border hover:border-primary/60 shadow-lg cursor-pointer transition-colors"
        >
          <img
            src="/pwa-192x192.png"
            alt="AniVerse"
            className="w-9 h-9 rounded-lg border border-border shrink-0 object-cover"
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">Install AniVerse</p>
            <p className="text-[11px] text-muted-foreground truncate">
              Mobile app
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                void handleInstall();
              }}
              className="h-9 px-4 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-white cursor-pointer"
            >
              Install
            </Button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              aria-label="Dismiss install banner"
              title="Dismiss"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <InstallAppModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
}

export default InstallAppModal;
