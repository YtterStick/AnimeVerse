import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface LayoutContextType {
  tvMode: boolean;
  setTvMode: (enabled: boolean) => void;
  toggleTvMode: () => void;
}

const STORAGE_KEY = "aniverse:tv_mode";

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [tvMode, setTvModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "true";
    } catch {
      return false;
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
