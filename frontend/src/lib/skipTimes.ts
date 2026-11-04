import type { SkipInterval } from "@/lib/api";

interface Cue {
  start: number;
  end: number;
}

const MIN_SONG_GAP = 50; // OP/ED songs are ~85-95s; allow trimmed/short versions
const MAX_SONG_GAP = 160;

function toSeconds(ts: string): number {
  const parts = ts.trim().replace(",", ".").split(":").map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Parse WEBVTT/SRT text into a sorted list of dialogue cue time ranges. */
export function parseCues(text: string): Cue[] {
  const cues: Cue[] = [];
  const re = /((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/g;
  for (const m of text.matchAll(re)) {
    const start = toSeconds(m[1]);
    const end = toSeconds(m[2]);
    if (end > start) cues.push({ start, end });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** Silent stretches between subtitle cues (where songs usually play, since lyrics are rarely subbed). */
function findGaps(cues: Cue[], duration: number): Cue[] {
  const gaps: Cue[] = [];
  let cursor = 0;
  for (const cue of cues) {
    if (cue.start - cursor >= MIN_SONG_GAP) gaps.push({ start: cursor, end: cue.start });
    cursor = Math.max(cursor, cue.end);
  }
  if (duration > 0 && duration - cursor >= MIN_SONG_GAP) gaps.push({ start: cursor, end: duration });
  return gaps.filter((g) => g.end - g.start <= MAX_SONG_GAP);
}

const overlap = (a: Cue, b: Cue) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

/**
 * Make skip intervals match *this* video file.
 *
 * AniSkip timestamps come from whatever release the submitter watched, so they can be
 * several seconds off (or include the recap) for our source. When the episode has
 * English subtitles, the OP/ED songs show up as long gaps with no dialogue, so we snap
 * each interval to the overlapping gap. If AniSkip has nothing, we detect the songs
 * from those gaps alone (first ~35% = intro, last ~30% = outro).
 */
export function refineSkips(skips: SkipInterval[], cues: Cue[], duration: number): SkipInterval[] {
  if (!cues.length) return skips;
  const gaps = findGaps(cues, duration);
  if (!gaps.length) return skips;

  const used = new Set<Cue>();
  const refined = skips.map((s) => {
    if (s.type !== "op" && s.type !== "ed") return s;
    const best = gaps
      .filter((g) => !used.has(g))
      .map((g) => ({ g, o: overlap(g, s) }))
      .sort((a, b) => b.o - a.o)[0];
    if (!best || best.o < 20) return s;
    used.add(best.g);
    return { ...s, start: best.g.start, end: Math.max(best.g.start, best.g.end - 0.3) };
  });

  if (duration > 0) {
    if (!refined.some((s) => s.type === "op")) {
      const g = gaps.find((x) => !used.has(x) && x.end <= duration * 0.35);
      if (g) {
        used.add(g);
        refined.push({ type: "op", start: g.start, end: g.end - 0.3, episodeLength: duration });
      }
    }
    if (!refined.some((s) => s.type === "ed")) {
      const g = [...gaps].reverse().find((x) => !used.has(x) && x.start >= duration * 0.7);
      if (g) refined.push({ type: "ed", start: g.start, end: g.end - 0.3, episodeLength: duration });
    }
  }

  return refined.sort((a, b) => a.start - b.start);
}

/** Build a WEBVTT chapters track so the seek bar shows Intro/Outro segments. */
export function buildChaptersVtt(skips: SkipInterval[], duration: number): string | null {
  if (!duration || !skips.length) return null;
  const fmt = (t: number) => {
    const c = Math.max(0, Math.min(t, duration));
    const h = Math.floor(c / 3600);
    const m = Math.floor((c % 3600) / 60);
    const s = (c % 60).toFixed(3).padStart(6, "0");
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s}`;
  };
  const label: Record<string, string> = { op: "Intro", ed: "Outro", recap: "Recap" };

  const parts: string[] = ["WEBVTT", ""];
  let cursor = 0;
  for (const s of [...skips].sort((a, b) => a.start - b.start)) {
    const start = Math.max(cursor, s.start);
    const end = Math.min(duration, s.end);
    if (end - start < 1) continue;
    if (start - cursor >= 1) parts.push(`${fmt(cursor)} --> ${fmt(start)}`, "Episode", "");
    parts.push(`${fmt(start)} --> ${fmt(end)}`, label[s.type] || "Skip", "");
    cursor = end;
  }
  if (duration - cursor >= 1) parts.push(`${fmt(cursor)} --> ${fmt(duration)}`, "Episode", "");
  return parts.join("\n");
}

