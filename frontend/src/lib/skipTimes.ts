import type { SkipInterval } from "@/lib/api";

export interface Cue {
  start: number;
  end: number;
  text?: string;
}

interface SongCandidate {
  start: number;
  end: number;
  type: "op" | "ed";
  source: string;
}

function toSeconds(ts: string): number {
  const parts = ts.trim().replace(",", ".").split(":").map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Parse WEBVTT/SRT text into a sorted list of subtitle cues with timestamps and dialogue text. */
export function parseCues(text: string): Cue[] {
  const cues: Cue[] = [];
  const re = /((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const start = toSeconds(match[1]);
    const end = toSeconds(match[2]);
    if (end > start) {
      const idx = match.index + match[0].length;
      const snippet = text.slice(idx, idx + 250).split(/\r?\n\r?\n/)[0] || "";
      const cleanText = snippet
        .replace(/<[^>]+>/g, "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.includes("-->") && !/^\d+$/.test(l))
        .join(" ");
      cues.push({ start, end, text: cleanText });
    }
  }
  return cues.sort((a, b) => a.start - b.start);
}

/**
 * Checks if a given time range contains spoken character dialogue rather than a song.
 *
 * Spoken anime scenes have rapid back-and-forth lines (short cues <= 2.5s) and conversational words.
 * An OP/ED song has long sustained musical phrasing (avg display duration >= 2.4s), music symbols (♪, ♫), or silence.
 */
export function isHighDensityDialogue(cues: Cue[], start: number, end: number): boolean {
  const inRange = cues.filter((c) => c.start >= start - 1.5 && c.end <= end + 1.5);
  if (inRange.length < 3) return false;

  // If there are explicit song/music markers, it's definitely a song, not dialogue
  const hasMusicMarkers = inRange.some((c) =>
    /[♪♫♬♩]|\b(?:music|song|opening|ending|theme)\b/i.test(c.text || "")
  );
  if (hasMusicMarkers) return false;

  const shortCues = inRange.filter((c) => c.end - c.start <= 2.4);
  const conversationalCues = inRange.filter(
    (c) =>
      /\b(i|you|he|she|we|they|my|your|what|why|how|who|where|when|is|are|was|were|don't|can't|won't|no|yes|please|look|wait|stop|listen|hey|tanjiro|nezuko|asta|luffy|goku)\b/i.test(
        c.text || ""
      ) || /[?!]/.test(c.text || "")
  );

  // If there are many short back-and-forth lines or conversational words without music symbols
  if (shortCues.length >= 5 || (shortCues.length >= 3 && conversationalCues.length >= 2)) {
    return true;
  }
  return false;
}

/**
 * Find candidate OP and ED song time intervals from subtitle cues:
 * 1. Unsubbed gaps (silent stretches where theme songs play).
 * 2. Subbed song lyrics (sustained poetic lyrics followed/preceded by silence).
 */
export function findSongCandidates(cues: Cue[], duration: number): SongCandidate[] {
  const candidates: SongCandidate[] = [];

  // 1. Silent gaps (unsubbed OP / ED)
  let cursor = 0;
  for (const cue of cues) {
    const gap = cue.start - cursor;
    if (gap >= 65 && gap <= 120) {
      if (cursor <= 260) {
        candidates.push({
          start: cursor,
          end: Math.max(cursor, cue.start - 0.8),
          type: "op",
          source: "unsubbed-gap",
        });
      } else if (duration > 0 && cursor >= duration * 0.78) {
        candidates.push({ start: cursor, end: cue.start, type: "ed", source: "unsubbed-gap" });
      }
    }
    cursor = Math.max(cursor, cue.end);
  }
  if (duration > 0 && duration - cursor >= 65 && duration - cursor <= 120) {
    candidates.push({ start: cursor, end: duration, type: "ed", source: "unsubbed-gap" });
  }

  // 2. Subbed song lyrics
  // Opening theme: in first 4.5 minutes (0 to 260s)
  // Ending theme: in last 3.5 minutes (after duration * 0.80)
  for (let i = 0; i < cues.length; i++) {
    const startCue = cues[i];
    const isOp = startCue.start <= 260;
    const isEd = duration > 0 && startCue.start >= duration * 0.8;
    if (!isOp && !isEd) continue;

    for (let j = i + 4; j < Math.min(cues.length, i + 28); j++) {
      const endCue = cues[j];
      const cueSpan = endCue.end - startCue.start;
      if (cueSpan >= 70 && cueSpan <= 96) {
        const subCues = cues.slice(i, j + 1);
        const avgDur = subCues.reduce((a, c) => a + (c.end - c.start), 0) / subCues.length;
        const nextCue = cues[j + 1];
        const gapAfter = nextCue ? nextCue.start - endCue.end : duration > 0 ? duration - endCue.end : 0;
        const prevCue = i > 0 ? cues[i - 1] : null;
        const gapBefore = prevCue ? startCue.start - prevCue.end : startCue.start;

        if (avgDur >= 2.4 && (gapAfter >= 2.5 || gapBefore >= 2.5)) {
          const safeAfterEnd = nextCue
            ? Math.min(endCue.end + 0.4, Math.max(endCue.end - 0.2, nextCue.start - 0.8))
            : endCue.end;
          const candidateTotalLen = safeAfterEnd - startCue.start;
          if (candidateTotalLen >= 72 && candidateTotalLen <= 98) {
            const cand: SongCandidate = {
              start: Math.max(0, startCue.start - 0.4),
              end: safeAfterEnd,
              type: isOp ? "op" : "ed",
              source: "subbed-lyrics",
            };
            if (!isHighDensityDialogue(cues, cand.start, cand.end)) {
              candidates.push(cand);
            }
          }
        }
      }
    }
  }

  return candidates;
}

const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

function isMusicMarkerCue(cue: Cue): boolean {
  return /[♪♫♬♩]|\b(?:music|song|opening|ending|theme)\b/i.test(cue.text || "");
}

function isConversationalCue(cue: Cue): boolean {
  const dur = cue.end - cue.start;
  const text = cue.text || "";
  return (
    dur <= 2.5 ||
    /[?!]/.test(text) ||
    /\b(i|you|he|she|we|they|my|your|what|why|how|who|where|when|don't|can't|won't|please|look|wait|stop|listen|hey)\b/i.test(
      text
    )
  );
}

/**
 * Apply baseline safety guards when subtitle cues are absent or before subtitle parsing completes:
 * 1. Discards false Episode 1 prologues marked as recaps (< 60s).
 * 2. Applies a conservative end-cushion on OP skips so distributor bumper offsets in AniSkip
 *    (commonly +4s to +5s) or HLS keyframe rounding never jump past the first lines of the scene.
 */
export function applySafeSkipBaseline(
  skips: SkipInterval[],
  episodeNumber?: number
): SkipInterval[] {
  return skips
    .filter((s) => !(s.type === "recap" && episodeNumber === 1 && s.start < 60))
    .map((s) => {
      if (s.type !== "op" || s.source === "subtitles") return s;
      const span = s.end - s.start;
      if (s.source === "stream") {
        if (span <= 25) return s;
        return { ...s, end: Math.max(s.start + 15, s.end - 1.5) };
      }
      // Community AniSkip timestamps frequently include a +4-5s Crunchyroll/broadcast bumper offset
      if (span <= 30) return s;
      return { ...s, end: Math.max(s.start + 15, s.end - 4.5) };
    });
}

/**
 * Make skip intervals match *this* video file.
 *
 * 1. Filters out bogus recaps on Episode 1 (cold opens / series prologues).
 * 2. Validates OP/ED intervals against subtitle dialogue density to discard false intervals.
 * 3. Snaps valid intervals to frame-accurate song boundaries and trims tails that overlap scene dialogue.
 * 4. Applies baseline safety cushions when no subtitle cues confirm the boundary.
 * 5. Automatically detects and synthesizes OP and ED when absent or invalid.
 */
export function refineSkips(
  skips: SkipInterval[],
  cues: Cue[],
  duration: number,
  episodeNumber?: number
): SkipInterval[] {
  // 1. In episode 1, recaps starting under 60 seconds are always series prologues, never recaps
  const cleanSkips = skips.filter((s) => {
    if (s.type === "recap" && episodeNumber === 1 && s.start < 60) {
      return false;
    }
    return true;
  });

  if (!cues.length) return applySafeSkipBaseline(cleanSkips, episodeNumber);

  const candidates = findSongCandidates(cues, duration);
  const used = new Set<SongCandidate>();
  const refined: SkipInterval[] = [];

  for (const s of cleanSkips) {
    if (s.type !== "op" && s.type !== "ed") {
      refined.push(s);
      continue;
    }

    // Check core body of OP/ED so a +5s shifted AniSkip tail over scene dialogue trims rather than discards the whole OP
    const coreStart = s.start + 8;
    const coreEnd = Math.max(coreStart + 10, s.end - 14);
    if (isHighDensityDialogue(cues, coreStart, coreEnd)) {
      continue;
    }

    // Try to snap to the closest matching song candidate
    const matching = candidates
      .filter((c) => c.type === s.type && !used.has(c))
      .map((c) => ({ c, o: overlap(c, s) }))
      .filter((x) => x.o >= 20)
      .sort((a, b) => Math.abs(a.c.end - a.c.start - 89.5) - Math.abs(b.c.end - b.c.start - 89.5))[0];

    if (matching) {
      used.add(matching.c);
      refined.push({
        ...s,
        start: matching.c.start,
        end: Math.max(matching.c.start + 15, matching.c.end),
        source: "subtitles",
      });
      continue;
    }

    // Tail-dialogue guard for OP when no full song candidate matched cleanly
    if (s.type === "op") {
      const midStart = s.start + 12;
      const midEnd = Math.max(midStart, s.end - 18);
      const midCues = cues.filter((c) => c.start >= midStart && c.end <= midEnd && !isMusicMarkerCue(c));
      const tailStart = Math.max(s.start + 45, s.end - 18);
      const tailCues = cues.filter((c) => c.start >= tailStart && c.start < s.end && !isMusicMarkerCue(c));

      if (midCues.length <= 2 && tailCues.length >= 1) {
        // Unsubbed OP where actual scene cues began before s.end
        const firstSceneCue = tailCues[0];
        const trimmedEnd = Math.max(s.start + 45, firstSceneCue.start - 0.8);
        if (trimmedEnd < s.end) {
          refined.push({ ...s, end: trimmedEnd, source: "subtitles" });
          continue;
        }
      } else if (tailCues.filter(isConversationalCue).length >= 2) {
        const firstDialogue = tailCues.find(isConversationalCue);
        if (firstDialogue) {
          const trimmedEnd = Math.max(s.start + 55, firstDialogue.start - 0.8);
          if (trimmedEnd < s.end) {
            refined.push({ ...s, end: trimmedEnd, source: "subtitles" });
            continue;
          }
        }
      }
    }

    refined.push(...applySafeSkipBaseline([s], episodeNumber));
  }

  // If OP was missing or discarded because it was dialogue, pick the best OP candidate
  if (duration > 0 && !refined.some((s) => s.type === "op")) {
    const opCandidates = candidates
      .filter((c) => c.type === "op" && !used.has(c))
      .sort((a, b) => Math.abs(a.end - a.start - 89.5) - Math.abs(b.end - b.start - 89.5));
    const bestOp = opCandidates[0];
    if (bestOp) {
      used.add(bestOp);
      refined.push({
        type: "op",
        start: bestOp.start,
        end: Math.max(bestOp.start + 15, bestOp.end),
        episodeLength: duration,
        source: "subtitles",
      });
    }
  }

  // If ED was missing, pick the best ED candidate
  if (duration > 0 && !refined.some((s) => s.type === "ed")) {
    const edCandidates = candidates
      .filter((c) => c.type === "ed" && !used.has(c))
      .sort((a, b) => Math.abs(a.end - a.start - 89.5) - Math.abs(b.end - b.start - 89.5));
    const bestEd = edCandidates[0];
    if (bestEd) {
      used.add(bestEd);
      refined.push({
        type: "ed",
        start: bestEd.start,
        end: Math.max(bestEd.start, bestEd.end - 0.2),
        episodeLength: duration,
        source: "subtitles",
      });
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
