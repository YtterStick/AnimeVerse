/**
 * Client-side content moderation helper mirroring backend moderation rules.
 * Blocks Filipino (Tagalog/Taglish/Bisaya) and English explicit/profane words
 * and detects spoiler cues so users get instant feedback before submitting.
 */

export interface ModerationResult {
  isExplicit: boolean;
  isSpoiler: boolean;
  cleanText: string;
  reason?: string;
}

const ENGLISH_EXPLICIT_BOUNDARY_WORDS = [
  "fuck",
  "fucker",
  "fuckers",
  "fucking",
  "fucked",
  "fucks",
  "fuckoff",
  "fuckface",
  "fuckhead",
  "motherfucker",
  "motherfucking",
  "mofo",
  "shit",
  "shits",
  "shitty",
  "shitting",
  "shithead",
  "bullshit",
  "dipshit",
  "bitch",
  "bitches",
  "bitching",
  "bitchy",
  "biatch",
  "cunt",
  "cunts",
  "dick",
  "dicks",
  "dickhead",
  "cock",
  "cocks",
  "cocksucker",
  "pussy",
  "pussies",
  "asshole",
  "assholes",
  "arsehole",
  "dumbass",
  "jackass",
  "bastard",
  "bastards",
  "whore",
  "whores",
  "slut",
  "sluts",
  "skank",
  "cum",
  "cumming",
  "cumshot",
  "jizz",
  "spunk",
  "blowjob",
  "handjob",
  "rimjob",
  "tit",
  "tits",
  "titties",
  "boob",
  "boobs",
  "boobies",
  "dildo",
  "masturbate",
  "masturbating",
  "masturbation",
  "orgasm",
  "ejaculate",
  "ejaculation",
  "penis",
  "vagina",
  "clitoris",
  "clit",
  "testicles",
  "scrotum",
  "porn",
  "porno",
  "pornography",
  "nudes",
  "onlyfans",
  "sexting",
  "rape",
  "rapist",
  "raping",
  "molest",
  "molester",
  "pedophile",
  "pedo",
  "nigger",
  "niggers",
  "nigga",
  "niggas",
  "faggot",
  "faggots",
  "fag",
  "fags",
  "dyke",
  "tranny",
  "retard",
  "retarded",
  "kys",
];

const FILIPINO_EXPLICIT_BOUNDARY_WORDS = [
  "puta",
  "pota",
  "putangina",
  "putanginamo",
  "potangina",
  "potanginamo",
  "tangina",
  "tanginamo",
  "taena",
  "taenamo",
  "tngina",
  "tnginamo",
  "pucha",
  "puchangina",
  "kingina",
  "kinginamo",
  "amputa",
  "ampota",
  "putragis",
  "punyeta",
  "punyemas",
  "pakshet",
  "pakshit",
  "pakyu",
  "pakyo",
  "pakyow",
  "gago",
  "gaga",
  "gagong",
  "tarantado",
  "tarantada",
  "ulol",
  "ulul",
  "bobo",
  "tanga",
  "inutil",
  "hinayupak",
  "hayup",
  "kupal",
  "ungas",
  "siraulo",
  "buwisit",
  "bwisit",
  "leche",
  "letse",
  "lintik",
  "lintek",
  "tite",
  "titi",
  "etits",
  "burat",
  "puke",
  "puki",
  "pekpek",
  "kipay",
  "bilat",
  "puday",
  "bayag",
  "tamod",
  "semilya",
  "jakol",
  "jabol",
  "salsal",
  "kantot",
  "kantutan",
  "iyot",
  "iyutan",
  "hindot",
  "hindutan",
  "kadyot",
  "torjak",
  "totnak",
  "bembang",
  "chupa",
  "tsupa",
  "chupain",
  "tsupain",
  "libog",
  "malibog",
  "tigang",
  "pokpok",
  "laspag",
  "yawa",
  "giatay",
  "piste",
  "pisti",
  "pisteng",
  "buang",
  "boang",
  "otin",
  "oten",
  "kayat",
  "kayata",
];

const JOINED_EXPLICIT_PHRASES = [
  "motherfucker",
  "cocksucker",
  "sonofabitch",
  "bullshit",
  "putangina",
  "potangina",
  "tanginamo",
  "tangina",
  "taenamo",
  "puchangina",
  "kinginamo",
  "pistengyawa",
  "hinayupak",
  "tarantado",
  "tarantada",
  "jerkoff",
  "jackoff",
  "blowjob",
  "handjob",
  "kilurself",
  "killyourself",
];

const MASKED_EXPLICIT_PATTERNS: RegExp[] = [
  /\bf[*@#$!._-]+(?:c?k|uc?k|uk)\b/i,
  /\bs[*@#$!._-]*h[*@#$!._-]*[i1!][*@#$!._-]*t\b/i,
  /\bb[*@#$!._-]*[i1!][*@#$!._-]*t[*@#$!._-]*c[*@#$!._-]*h\b/i,
  /\bc[*@#$!._-]*u[*@#$!._-]*n[*@#$!._-]*t\b/i,
  /\bp[*@#$!._-]*u[*@#$!._-]*s[*@#$!._-]*s[*@#$!._-]*y\b/i,
  /\bp[*@#$!._-]*[uo0][*@#$!._-]*t[*@#$!._-]*[a@4]\b/i,
  /\bp[*@#$!._-]*[uo0][*@#$!._-]*t[*@#$!._-]*[a@4][*@#$!._-]*n[*@#$!._-]*g[*@#$!._-]*[i1!][*@#$!._-]*n[*@#$!._-]*[a@4]\b/i,
  /\bt[*@#$!._-]*[a@4][*@#$!._-]*n[*@#$!._-]*g[*@#$!._-]*[i1!][*@#$!._-]*n[*@#$!._-]*[a@4]\b/i,
  /\bg[*@#$!._-]*[a@4][*@#$!._-]*g[*@#$!._-]*[o0]\b/i,
  /\bp[*@#$!._-]*[a@4][*@#$!._-]*k[*@#$!._-]*y[*@#$!._-]*[uo0]\b/i,
  /\bk[*@#$!._-]*[u0][*@#$!._-]*p[*@#$!._-]*[a@4][*@#$!._-]*l\b/i,
  /\bf\s*k\s*u\b/i,
  /\bf\s*u\s*c\s*k\b/i,
  /\bt\s*a\s*n\s*g\s*i\s*n\s*a\b/i,
  /\bp\s*u\s*t\s*a\b/i,
];

const ALL_BOUNDARY_WORDS = new Set<string>([
  ...ENGLISH_EXPLICIT_BOUNDARY_WORDS,
  ...FILIPINO_EXPLICIT_BOUNDARY_WORDS,
]);

const SAFE_WORDS = new Set<string>([
  "putahe",
  "cockatoo",
  "cocktail",
  "cockpit",
  "peacock",
  "shuttlecock",
  "woodcock",
  "hancock",
  "classic",
  "class",
  "classes",
  "assassin",
  "assassination",
  "assassinate",
  "document",
  "documented",
  "circumstance",
  "accumulator",
  "title",
  "subtitle",
  "subtitles",
  "entitled",
  "therapist",
  "analysis",
  "analogue",
  "analog",
  "analyze",
  "canal",
  "banal",
  "arsenal",
  "basement",
  "butter",
  "button",
  "scunthorpe",
  "dickens",
  "scrap",
  "crap",
  "grape",
  "drape",
  "scrape",
  "boboiboy",
  "chupacabra",
]);

const SPOILER_PATTERNS: RegExp[] = [
  /\|\|[\s\S]+?\|\|/,
  /\[spoiler\][\s\S]*?/i,
  /\/spoiler\b/i,
  /\bspoilers?\b/i,
  /\b(?:he|she|they|mc|protagonist|villain|everyone|main character)\s+(?:dies|died|gets?\s+killed|betrays?|is killed|was killed)\b/i,
  /\b(?:dies|died|killed off)\s+in\s+(?:ep|episode|chapter|season|the\s+end|manga)\b/i,
  /\bgets?\s+killed\b/i,
  /\bplot\s+twist\b/i,
  /\bturns?\s+out\s+(?:he|she|they|it)\s+(?:is|was)\b/i,
  /\bin\s+the\s+manga\b/i,
  /\bmanga\s+(?:spoilers?|readers?)\b/i,
  /\blight\s+novel\s+spoilers?\b/i,
  /\bfinal\s+(?:boss|villain|episode\s+twist)\b/i,
  /\bmamamatay\s+(?:si|sila|yung|ang)\b/i,
  /\bnamatay\s+(?:si|sila|yung)\b/i,
  /\bpinatay\s+(?:si|nila|nya|niya)\b/i,
  /\btaksil\s+(?:pala|si)\b/i,
  /\bsa\s+manga\s+(?:mamamatay|namatay|maging|naging)\b/i,
];

function stripDiacritics(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function normalizeLeet(input: string): string {
  return input
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/4/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/8/g, "b");
}

function collapseRepeated(word: string, maxRepeat: number): string {
  if (maxRepeat === 1) {
    return word.replace(/(.)\1+/g, "$1");
  }
  return word.replace(/(.)\1{2,}/g, "$1$1");
}

export function detectExplicitContent(rawText: string): boolean {
  const cleaned = stripDiacritics(rawText).trim();
  if (!cleaned) return false;

  for (const pattern of MASKED_EXPLICIT_PATTERNS) {
    if (pattern.test(cleaned)) {
      return true;
    }
  }

  const lower = cleaned.toLowerCase();
  const alphaTokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  const leetTokens = lower
    .split(/[\s,;.?()[\]{}"'<>/\\~]+/)
    .map((t) => t.replace(/^[!*+_-]+|[!*+_-]+$/g, ""))
    .filter(Boolean);

  for (const rawToken of [...alphaTokens, ...leetTokens]) {
    if (SAFE_WORDS.has(rawToken)) continue;
    const leet = normalizeLeet(rawToken).replace(/[^a-z]/g, "");
    if (!leet || SAFE_WORDS.has(leet)) continue;

    const c2 = collapseRepeated(leet, 2);
    const c1 = collapseRepeated(leet, 1);

    if (
      ALL_BOUNDARY_WORDS.has(leet) ||
      ALL_BOUNDARY_WORDS.has(c2) ||
      ALL_BOUNDARY_WORDS.has(c1)
    ) {
      return true;
    }
  }

  const separatedWordGroups = lower.match(/(?:[a-z0-9@!$+|][._*\-]+){2,}[a-z0-9@!$+|]/g) || [];
  for (const group of separatedWordGroups) {
    const joined = normalizeLeet(group).replace(/[^a-z]/g, "");
    if (!joined || SAFE_WORDS.has(joined)) continue;
    const c2 = collapseRepeated(joined, 2);
    const c1 = collapseRepeated(joined, 1);
    if (
      ALL_BOUNDARY_WORDS.has(joined) ||
      ALL_BOUNDARY_WORDS.has(c2) ||
      ALL_BOUNDARY_WORDS.has(c1)
    ) {
      return true;
    }
  }

  const spacedRuns = lower.match(/\b(?:[a-z0-9@!$+|]\s+){2,}[a-z0-9@!$+|]\b/g) || [];
  for (const run of spacedRuns) {
    const joined = normalizeLeet(run).replace(/[^a-z]/g, "");
    if (!joined || SAFE_WORDS.has(joined)) continue;
    if (ALL_BOUNDARY_WORDS.has(joined) || ALL_BOUNDARY_WORDS.has(collapseRepeated(joined, 1))) {
      return true;
    }
  }

  const compactAll = collapseRepeated(normalizeLeet(lower).replace(/[^a-z]/g, ""), 2);
  for (const phrase of JOINED_EXPLICIT_PHRASES) {
    if (compactAll.includes(phrase)) {
      return true;
    }
  }

  if (
    /\bputang\s+ina(?:\s+mo)?\b/i.test(lower) ||
    /\bpotang\s+ina(?:\s+mo)?\b/i.test(lower) ||
    /\btang\s+ina(?:\s+mo)?\b/i.test(lower) ||
    /\bking\s+ina(?:\s+mo)?\b/i.test(lower) ||
    /\bhayop\s+ka\b/i.test(lower) ||
    /\banimal\s+ka\b/i.test(lower) ||
    /\bpisteng\s+yawa\b/i.test(lower) ||
    /\bjerk\s+off\b/i.test(lower) ||
    /\bjack\s+off\b/i.test(lower) ||
    /\bkill\s+yourself\b/i.test(lower)
  ) {
    return true;
  }

  return false;
}

export function detectSpoilerContent(rawText: string): boolean {
  const cleaned = rawText.trim();
  if (!cleaned) return false;
  return SPOILER_PATTERNS.some((pattern) => pattern.test(cleaned));
}

export function moderateCommentContent(
  rawText: string,
  userMarkedSpoiler = false
): ModerationResult {
  const cleanText = String(rawText || "").replace(/\r\n/g, "\n").trim();
  const isExplicit = detectExplicitContent(cleanText);
  const isSpoiler = Boolean(userMarkedSpoiler) || detectSpoilerContent(cleanText);

  return {
    isExplicit,
    isSpoiler,
    cleanText,
    reason: isExplicit
      ? "Explicit or offensive language (English/Filipino) is not allowed and was blocked."
      : undefined,
  };
}
