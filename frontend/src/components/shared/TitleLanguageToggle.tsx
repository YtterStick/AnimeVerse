import { useTitleLanguage } from "@/contexts/TitleLanguageContext";

interface TitleLanguageToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export function TitleLanguageToggle({
  className = "",
  size = "sm",
}: TitleLanguageToggleProps) {
  const { language, setLanguage } = useTitleLanguage();

  const isSmall = size === "sm";

  return (
    <div
      role="group"
      aria-label="Anime title language switch (English or Japanese Romaji)"
      className={`inline-flex items-center p-0.5 rounded-full bg-secondary/80 border border-border/70 backdrop-blur-sm select-none shadow-inner ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={`rounded-full transition-all cursor-pointer font-extrabold flex items-center justify-center ${
          isSmall ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
        } ${
          language === "en"
            ? "bg-primary text-white shadow-sm shadow-primary/30 font-black scale-100"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Display English localized anime titles (e.g. Attack on Titan)"
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => setLanguage("jp")}
        aria-pressed={language === "jp"}
        className={`rounded-full transition-all cursor-pointer font-extrabold flex items-center justify-center ${
          isSmall ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
        } ${
          language === "jp"
            ? "bg-primary text-white shadow-sm shadow-primary/30 font-black scale-100"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Display Japanese Romaji anime titles (e.g. Shingeki no Kyojin)"
      >
        JP
      </button>
    </div>
  );
}

export default TitleLanguageToggle;

