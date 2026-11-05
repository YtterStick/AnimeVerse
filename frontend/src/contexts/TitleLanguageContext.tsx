import React, { createContext, useContext, useState, useCallback } from "react";

export type TitleLanguage = "en" | "jp";

export interface TitleSource {
  title?: string | null;
  title_english?: string | null;
  title_japanese?: string | null;
}

interface TitleLanguageContextType {
  language: TitleLanguage;
  setLanguage: (lang: TitleLanguage) => void;
  toggleLanguage: () => void;
  formatTitle: (anime?: TitleSource | null) => string;
}

const STORAGE_KEY = "aniverse:title_lang";

const TitleLanguageContext = createContext<TitleLanguageContextType | undefined>(undefined);

export function TitleLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<TitleLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "jp") return saved;
    } catch {
      // Ignore
    }
    return "en";
  });

  const setLanguage = useCallback((lang: TitleLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: TitleLanguage = prev === "en" ? "jp" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const formatTitle = useCallback(
    (anime?: TitleSource | null): string => {
      if (!anime) return "";
      if (language === "jp") {
        // Japanese Romaji title is in anime.title (e.g. "Shingeki no Kyojin", "Black Clover")
        return anime.title || anime.title_japanese || anime.title_english || "Unknown Title";
      }
      // English localized title is in anime.title_english (e.g. "Attack on Titan")
      return anime.title_english || anime.title || anime.title_japanese || "Unknown Title";
    },
    [language]
  );

  return (
    <TitleLanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        formatTitle,
      }}
    >
      {children}
    </TitleLanguageContext.Provider>
  );
}

export function useTitleLanguage() {
  const ctx = useContext(TitleLanguageContext);
  if (!ctx) {
    throw new Error("useTitleLanguage must be used within a TitleLanguageProvider");
  }
  return ctx;
}
