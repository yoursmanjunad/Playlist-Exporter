// normalize.js
// Shared text-cleaning utilities used by the matching pipeline.

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

// Noise phrases that show up in YouTube titles but carry no matching
// information. These are stripped before comparing strings.
const NOISE_PATTERNS = [
  /\(?\[?official\s*(music\s*)?video\]?\)?/gi,
  /\(?\[?official\s*audio\]?\)?/gi,
  /\(?\[?official\]?\)?/gi,
  /\(?\[?lyrics?\s*(video)?\]?\)?/gi,
  /\(?\[?visualizer\]?\)?/gi,
  /\(?\[?audio\]?\)?/gi,
  /\(?\[?hd\]?\)?/gi,
  /\(?\[?hq\]?\)?/gi,
  /\(?\[?4k\]?\)?/gi,
  /\(?\[?mv\]?\)?/gi,
  /\(?\[?explicit\]?\)?/gi,
  /\(?\[?clean\s*version\]?\)?/gi,
];

// Words that indicate a *different version* of the track. These are
// extracted (not discarded) so scoreMatch can compare them against the
// Spotify track's own title, rather than blindly penalizing them.
const VERSION_TOKENS = [
  "remix",
  "live",
  "acoustic",
  "cover",
  "instrumental",
  "karaoke",
  "sped up",
  "slowed",
  "nightcore",
  "8d audio",
  "extended",
  "remastered",
  "demo",
  "edit",
];

export function stripDiacritics(str) {
  return str.normalize("NFD").replace(DIACRITICS_REGEX, "");
}

export function basicClean(str = "") {
  return stripDiacritics(str)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’‘]/g, "'")
    .replace(/["“”]/g, "")
    .trim();
}

// Removes decorative noise (official video, HD, lyrics, etc.) while
// preserving substantive content like "feat." credits and version markers.
export function stripNoise(str = "") {
  let cleaned = basicClean(str);
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  return cleaned.replace(/[\(\)\[\]]/g, " ").replace(/\s+/g, " ").trim();
}

// Extracts version tokens (remix, live, cover, ...) present in a string.
// Returns a Set so callers can compare Spotify vs YouTube version
// markers directly instead of treating every occurrence as noise.
export function extractVersionTokens(str = "") {
  const cleaned = basicClean(str);
  const found = new Set();
  for (const token of VERSION_TOKENS) {
    if (cleaned.includes(token)) {
      found.add(token);
    }
  }
  return found;
}

export function tokenize(str = "") {
  return stripNoise(str)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

export function normalizeTrack(track = {}) {
  return {
    title: stripNoise(track.title || ""),
    artists: (track.artists || [])
      .map((artist) => stripNoise(artist))
      .filter(Boolean),
    durationMs: track.durationMs ?? null,
  };
}