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
  /\bspoiler\s*alert\b/i,
  /\b(?:he|she|they|mc|protagonist|villain|everyone|main character)\s+(?:dies|died|gets?\s+killed|betrays?|betrayed|is killed|was killed|turns?\s+evil)\b/i,
  /\b(?:dies|died|killed off|betrays?|betrayed|defeated|sealed\s+away)\s+in\s+(?:ep|episode|chapter|season|the\s+end|manga|finale|arc)\b/i,
  /\b(?:gets?|got)\s+(?:killed|murdered|executed|beheaded|stabbed|poisoned|betrayed|sealed|brainwashed|possessed|banished|kidnapped|captured)\b/i,
  /\b(?:killed|murdered|betrayed|defeated|brainwashed|possessed|resurrected|revived)\s+by\b/i,
  /\b(?:sacrifices?\s+(?:himself|herself|themselves|everything|his\s+life|her\s+life|their\s+lives)|sacrificed)\b/i,
  /\bplot\s+twist\b/i,
  /\b(?:ending|finale)\s+(?:twist|revealed|leak|leaked|explained)\b/i,
  /\bturns?\s+out\s+(?:that\s+)?(?:he|she|they|it|[A-Z][a-z]+)\s+(?:is|was|had|actually)\b/i,
  /\b(?:is|was|are|were)\s+(?:secretly|actually)\s+(?:the|a|an)?\s*(?:traitor|spy|villain|king|queen|demon|dead|alive|killer|boss|mastermind|imposter|father|mother|brother|sister|son|daughter|twin|clone)\b/i,
  /\bactually\s+(?:dies|died|alive|dead|survives|survived|betrays|betrayed|kills|killed|is\s+the|was\s+the)\b/i,
  /\bin\s+the\s+(?:manga|light\s+novel|web\s+novel)\b/i,
  /\b(?:manga|novel)\s+(?:spoilers?|readers?)\b/i,
  /\bin\s+(?:the\s+)?(?:next|future|later|last|final)\s+(?:ep|episode|chapter|arc|season)\b/i,
  /\b(?:ep|episode|chapter)\s*\d+\s+(?:twist|death|reveal|ending|spoiler)\b/i,
  /\bfinal\s+(?:boss|villain|episode\s+twist|form)\b/i,
  /\b(?:mamamatay|mamatay|namamatay|namatay|patay|pinatay)\s+(?:na|pala|si|sila|yung|ang|dito|sa\s+dulo)\b/i,
  /\b(?:taksil|traidor|traitor|kalaban|buhay|patay|impostor|espiya|spy)\s+(?:pala|si)\b/i,
  /\b(?:si|yung)\s+[a-z]+\s+(?:pala\s+)?(?:ang\s+)?(?:kalaban|taksil|traidor|killer|nagpapatay|mastermind)\b/i,
  /\b(?:nabuhay|muling\s+nabuhay|magiging\s+villain|naging\s+kalaban|tinalo\s+si|natalo\s+si)\b/i,
  /\b(?:pinagawa|inutusan|pinilit|linoko|trinaydor|iniligtas|sinaksak|napatay)\s+(?:si|ni|kay)\b/i,
  /\b(?:nagising|lumabas|nabunyag|nalaman)\s+(?:na\s+)?(?:ang|yung)\s+(?:kapangyarihan|sikreto|nakaraan|katotohanan|tunay)\b/i,
  /\bsa\s+(?:manga|novel|ending|dulo|huli|next\s+ep)\s*(?:mamamatay|namatay|maging|naging|pala)\b/i,
  /\b(?:hindi|di)\s+(?:ko|mo|namin)?\s*(?:akalain|inakala|inaasahan)\s+na\b/i,
];

const SAFE_ACTUALLY_FOLLOWERS = new Set([
  "so",
  "really",
  "very",
  "quite",
  "pretty",
  "kind",
  "sort",
  "not",
  "good",
  "great",
  "nice",
  "cool",
  "fun",
  "funny",
  "bad",
  "mid",
  "peak",
  "fire",
  "worth",
  "true",
  "sounds",
  "sounded",
  "looks",
  "looked",
  "feels",
  "felt",
  "seems",
  "seemed",
  "liked",
  "like",
  "loved",
  "love",
  "enjoyed",
  "enjoy",
  "watched",
  "watch",
  "hated",
  "hate",
  "thought",
  "think",
  "wanted",
  "want",
  "needed",
  "need",
  "forgot",
  "forget",
  "remember",
  "remembered",
  "started",
  "just",
  "only",
  "also",
  "even",
  "still",
  "already",
  "never",
  "always",
  "the",
  "this",
  "that",
  "for",
  "about",
  "with",
  "into",
  "from",
  "here",
  "there",
  "one",
  "two",
  "make",
  "makes",
  "made",
  "have",
  "has",
  "had",
  "getting",
  "going",
  "gonna",
]);

const NON_CHARACTER_CAPITALS = new Set([
  "Episode",
  "Season",
  "Chapter",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "English",
  "Japanese",
  "Sub",
  "Dub",
  "AniVerse",
  "Anime",
  "Manga",
  "Opening",
  "Ending",
  "God",
  "Bro",
  "Man",
  "The",
  "And",
  "But",
  "For",
  "This",
  "That",
  "What",
  "When",
  "Why",
  "How",
  "Can",
  "Not",
  "Yes",
]);

const NON_SPOILER_DISBELIEF =
  /\b(?:can'?t|cannot|couldn'?t|hard\s+to)\s+believe\s+(?:how\s+(?:good|great|amazing|awesome|cool|insane|fire|peak|cute|funny|sad|beautiful)|it'?s\s+(?:already|finally)\s+over)\b/i;

const PLOT_ACTION_VERBS_REGEX =
  /\b(?:tasks?|tasked|tasking|forces?|forced|forcing|compels?|compelled|orders?|ordered|ordering|commands?|commanded|confronts?|confronted|confronting|reveals?|revealed|revealing|confesses?|confessed|exposes?|exposed|discovers?|discovered|learns?|learned|realizes?|realized|unlocks?|unlocked|awakens?|awakened|awakening|unleashes?|unleashed|transforms?|transformed|evolves?|evolved|absorbs?|absorbed|steals?|stole|stolen|escapes?|escaped|traps?|trapped|captures?|captured|kidnaps?|kidnapped|imprisons?|imprisoned|banishes?|banished|assassinates?|assassinated|executes?|executed|ambushes?|ambushed|defeats?|defeated|overpowers?|overpowered|beats?|destroys?|destroyed|slays?|slain|slices?|sliced|stabs?|stabbed|shoots?|shot|poisons?|poisoned|curses?|cursed|seals?|sealed|unseals?|unsealed|revives?|revived|resurrects?|resurrected|heals?|healed|rescues?|rescued|sacrifices?|sacrificed|betrays?|betrayed|tricks?|tricked|manipulates?|manipulated|controls?|controlled|brainwashes?|brainwashed|possesses?|possessed|swaps?|swapped|kills?|killed|murders?|murdered|dies|died|loses\s+to|wins\s+against)\b/gi;

const PLOT_CONSEQUENCE_PATTERNS: RegExp[] = [
  /\bforcing\s+(?:him|her|them|everyone|[a-z]+)\s+to\b/i,
  /\btasks?\s+(?:him|her|them|[a-z]+)\s+with\b/i,
  /\b(?:causing|compelling|tricking|manipulating|blackmailing)\s+(?:him|her|them|[a-z]+)\s+(?:to|into)\b/i,
  /\b(?:finds?|found)\s+out\s+(?:that|who|what|about|the)\b/i,
  /\bends?\s+up\s+[a-z]+ing\b/i,
  /\bright\s+before\b/i,
  /\bonly\s+to\s+(?:find|realize|discover|lose|die)\b/i,
  /\bconfront(?:s|ed|ing)?\s+(?:his|her|their|its|own)\s+(?:past|fears?|fate|destiny|truth)\b/i,
];

const DIRECT_TARGET_ACTION_REGEX =
  /\b(?:tasks?|forces?|forcing|confronts?|reveals?|defeats?|overpowers?|beats?|destroys?|slices?|stabs?|shoots?|poisons?|curses?|seals?|revives?|rescues?|saves?|sacrifices?|betrays?|tricks?|manipulates?|controls?|brainwashes?|possesses?|kills?|murders?|unlocks?|awakens?)\s+(?:him|her|them|[A-Z][a-z]{2,}|the\s+[A-Z][a-z]{2,})\b/;

const PLOT_STAKES_NOUNS_REGEX =
  /\b(?:past|own\s+past|curse|curse-breaking|potion|ingredients|prophecy|truth|secret|identity|bloodline|memories|backstory|seal|weakness|betrayal|downfall|origin|mastermind|traitor|imposter|villain|boss|climax|twist|ending\s+scene|post[- ]credits|cliffhanger)\b/gi;

function scorePlotSpoilerSignals(cleaned: string): number {
  const text = cleaned.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  let score = 0;

  // 1. Reaction-to-event opener
  const hasDisbelief =
    (/\b(?:can'?t|cannot|couldn'?t|hard\s+to|still\s+can'?t)\s+believe\b/i.test(text) &&
      !NON_SPOILER_DISBELIEF.test(text)) ||
    /\b(?:didn'?t|did\s+not|never)\s+(?:expect|see\s+that\s+coming|think\s+that|realize)\b/i.test(text) ||
    /\bwho\s+(?:knew|would'?ve\s+thought)\b/i.test(text) ||
    /\bshocked\s+(?:that|when)\b/i.test(text);
  if (hasDisbelief) {
    score += 1.5;
  }

  // 2. "actually <plot verb>" modifier
  const actuallyMatches = text.match(/\bactually\s+([a-z]{3,})\b/gi) || [];
  const hasActuallyAction = actuallyMatches.some((pair) => {
    const follower = pair.split(/\s+/)[1]?.toLowerCase() || "";
    return follower.length >= 3 && !SAFE_ACTUALLY_FOLLOWERS.has(follower);
  });
  if (hasActuallyAction) {
    score += 1.5;
  }

  // 3. Plot narration verbs, causal clauses, and direct character targeting
  const verbMatches = new Set(
    (text.match(PLOT_ACTION_VERBS_REGEX) || []).map((v) => v.toLowerCase())
  );
  if (verbMatches.size >= 2) {
    score += 2.5;
  } else if (verbMatches.size === 1) {
    score += 1.5;
  }

  if (PLOT_CONSEQUENCE_PATTERNS.some((pattern) => pattern.test(text))) {
    score += 1.0;
  }
  if (DIRECT_TARGET_ACTION_REGEX.test(text)) {
    score += 1.0;
  }

  // 4. Story/lore stakes nouns (ignoring OP/ED song references)
  const textWithoutMusic = text.replace(/\b(?:opening|ending)\s+(?:song|theme|credits)\b/gi, "");
  const stakesMatches = new Set(
    (textWithoutMusic.match(PLOT_STAKES_NOUNS_REGEX) || []).map((n) => n.toLowerCase())
  );
  if (stakesMatches.size >= 2) {
    score += 1.5;
  } else if (stakesMatches.size === 1) {
    score += 0.5;
  }

  // 5. Named entities mid-sentence paired with multi-word narration
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 8) {
    const midSentenceCapitals = new Set<string>();
    for (let i = 1; i < words.length; i++) {
      const cleanToken = words[i].replace(/[^A-Za-z']/g, "");
      if (/^[A-Z][a-z]{2,}$/.test(cleanToken) && !NON_CHARACTER_CAPITALS.has(cleanToken)) {
        midSentenceCapitals.add(cleanToken);
      }
    }
    if (midSentenceCapitals.size >= 2) {
      score += 1.0;
    } else if (midSentenceCapitals.size === 1) {
      score += 0.5;
    }
  }

  return score;
}

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
  if (SPOILER_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return true;
  }
  return scorePlotSpoilerSignals(cleaned) >= 3.0;
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
