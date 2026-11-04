import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | null): string {
  if (!score) return "N/A";
  return score.toFixed(1);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

export function formatEpisodeNumber(num: number): string {
  return `EP ${num.toString().padStart(2, "0")}`;
}

export function getImageUrl(url: string | undefined | null): string {
  if (!url) return "/placeholder-anime.jpg";
  // Use large image from Jikan if available
  return url.replace("/images/", "/images/");
}
