const SERVER_NAME_MAP: Record<string, string> = {
  vidstreaming: "Nova HD",
  birdstream: "Zenith HD",
  duckstream: "Eclipse HD",
  animeheaven: "Aether HD",
  gogoanime: "Orion HD",
  streamsb: "Vortex HD",
  streamtape: "Mirage HD",
};

const DEFAULT_SERVER_NAMES = [
  "Nova HD",
  "Zenith HD",
  "Eclipse HD",
  "Aether HD",
  "Orion HD",
  "Mirage HD",
];

/**
 * Transforms raw provider names (e.g. "VidStreaming (Eng Sub)", "BirdStream (Eng Dub)")
 * into clean, premium anime streaming server names (e.g. "Nova HD", "Zenith HD").
 */
export function getCleanServerName(rawName: string | undefined | null, index = 0): string {
  if (!rawName) return DEFAULT_SERVER_NAMES[index % DEFAULT_SERVER_NAMES.length] || `Server ${index + 1} (HD)`;

  const lower = rawName.toLowerCase();

  for (const [key, clean] of Object.entries(SERVER_NAME_MAP)) {
    if (lower.includes(key)) {
      return clean;
    }
  }

  // If already clean (like "Nova HD", "Zenith HD", "Aether HD")
  for (const name of DEFAULT_SERVER_NAMES) {
    if (rawName.startsWith(name.split(" ")[0])) {
      return name;
    }
  }

  // Strip raw provider tags like "(Eng Sub)", "(Eng Dub)", "(SUB)", "• 1080p"
  const cleaned = rawName
    .replace(/\s*\((?:Eng\s*)?(?:Sub|Dub|Raw)\)/gi, "")
    .replace(/\s*•\s*\d+p(?:\s*\(.*?\))?/gi, "")
    .trim();

  if (cleaned && !cleaned.toLowerCase().includes("streaming") && !cleaned.toLowerCase().includes("stream")) {
    return `${cleaned} HD`;
  }

  return DEFAULT_SERVER_NAMES[index % DEFAULT_SERVER_NAMES.length] || `Server ${index + 1} (HD)`;
}

export default getCleanServerName;

