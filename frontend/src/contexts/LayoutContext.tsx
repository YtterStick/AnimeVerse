import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface LayoutContextType {
  tvMode: boolean;
  setTvMode: (enabled: boolean) => void;
  toggleTvMode: () => void;
}

const STORAGE_KEY = "aniverse:tv_mode";
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [role="button"]:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ArrowDirection = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

const DIRECTION_DELTAS: Record<ArrowDirection, (dx: number, dy: number) => [number, number]> = {
  ArrowRight: (dx, dy) => [dx, Math.abs(dy)],
  ArrowLeft: (dx, dy) => [-dx, Math.abs(dy)],
  ArrowDown: (dx, dy) => [dy, Math.abs(dx)],
  ArrowUp: (dx, dy) => [-dy, Math.abs(dx)],
};

function detectSmartTvBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /smart-tv|smarttv|tizen|web0s|webos|netcast|viera|bravia|\btv\b/i.test(navigator.userAgent);
}

function getVisibleFocusables(): HTMLElement[] {
  const root: ParentNode = document.querySelector('[role="dialog"]') ?? document;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && el.getClientRects().length > 0;
  });
}

function findNextFocusable(
  candidates: HTMLElement[],
  current: HTMLElement,
  direction: ArrowDirection
): HTMLElement | null {
  const currRect = current.getBoundingClientRect();
  const ax = currRect.left + currRect.width / 2;
  const ay = currRect.top + currRect.height / 2;
  const project = DIRECTION_DELTAS[direction];

  let bestInCone: HTMLElement | null = null;
  let bestConeScore = Number.POSITIVE_INFINITY;
  let bestAny: HTMLElement | null = null;
  let bestAnyScore = Number.POSITIVE_INFINITY;

  for (const el of candidates) {
    if (el === current) continue;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const [primary, perp] = project(cx - ax, cy - ay);
    if (primary <= 4) continue;

    const score = primary + 2.5 * perp;
    if (score < bestAnyScore) {
      bestAnyScore = score;
      bestAny = el;
    }
    const coneLimit = Math.max(primary * 1.8, Math.max(currRect.width, currRect.height));
    if (perp <= coneLimit && score < bestConeScore) {
      bestConeScore = score;
      bestInCone = el;
    }
  }

  return bestInCone ?? bestAny;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [tvMode, setTvModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") return true;
      if (saved === "false") return false;
      return detectSmartTvBrowser();
    } catch {
      return detectSmartTvBrowser();
    }
  });

  useEffect(() => {
    try {
      if (tvMode) {
        document.documentElement.classList.add("tv-mode");
      } else {
        document.documentElement.classList.remove("tv-mode");
      }
    } catch {
      // Ignore in non-browser env
    }
  }, [tvMode]);

  // 2D Spatial D-Pad navigation + Samsung Tizen Back key handling in TV Mode
  useEffect(() => {
    if (!tvMode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const tag = activeEl?.tagName;
      const isTextControl =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        Boolean(activeEl?.isContentEditable);

      const isTizenBack =
        e.keyCode === 10009 || e.key === "XF86Back" || e.key === "BrowserBack";

      if (isTizenBack || e.key === "Escape") {
        if (isTextControl) {
          e.preventDefault();
          activeEl?.blur();
          return;
        }
        if (isTizenBack && !document.querySelector('[role="dialog"]')) {
          e.preventDefault();
          window.history.back();
          return;
        }
      }

      if (isTextControl || window.location.pathname.startsWith("/watch/")) return;

      if (
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown" &&
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight"
      ) {
        return;
      }

      const candidates = getVisibleFocusables();
      if (candidates.length === 0) return;

      e.preventDefault();

      const currentValid =
        activeEl && activeEl !== document.body && candidates.includes(activeEl)
          ? activeEl
          : null;

      let target: HTMLElement | null = null;
      if (!currentValid) {
        target =
          candidates.find((el) => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
          }) ?? candidates[0];
      } else {
        target = findNextFocusable(candidates, currentValid, e.key);
      }

      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [tvMode]);

  const setTvMode = useCallback((enabled: boolean) => {
    setTvModeState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // Ignore
    }
  }, []);

  const toggleTvMode = useCallback(() => {
    setTvModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  return (
    <LayoutContext.Provider value={{ tvMode, setTvMode, toggleTvMode }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
}
