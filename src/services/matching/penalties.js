// penalties.js
// Detects keywords that should push a result's score down (or, for a
// few reliability signals, up) beyond what text/duration similarity
// alone would suggest.

const HARD_NEGATIVE_KEYWORDS = [
  "cover",
  "karaoke",
  "reaction",
  "tutorial",
  "lesson",
  "how to play",
  "type beat",
  "8d audio",
  "backing track",
  "instrumental",
  "ringtone",
  "loop",
  "1 hour",
  "trailer",
];

const SOFT_NEGATIVE_KEYWORDS = [
  "remix",
  "live",
  "acoustic",
  "sped up",
  "slowed",
  "nightcore",
  "extended",
  "remastered",
  "edit",
  "demo",
];

const POSITIVE_KEYWORDS = ["official audio", "official video", "official music video"];

const HARD_NEGATIVE_PENALTY = 40;
const SOFT_NEGATIVE_PENALTY = 20;
const POSITIVE_BONUS = 5;

/**
 * @param {string} youtubeTitle
 * @param {Set<string>} spotifyVersionTokens - version words already
 *   present in the Spotify track's own title (e.g. the track itself is
 *   "X (Remix)"). Soft-negative keywords are only penalized when the
 *   Spotify title does NOT already indicate that same version, so a
 *   genuine remix result isn't punished for correctly matching a
 *   remix request.
 */
export function calculatePenalties(youtubeTitle = "", spotifyVersionTokens = new Set()) {
  const lower = youtubeTitle.toLowerCase();
  const matchedKeywords = [];
  let penalty = 0;
  let bonus = 0;

  for (const keyword of HARD_NEGATIVE_KEYWORDS) {
    if (lower.includes(keyword)) {
      matchedKeywords.push(keyword);
      penalty += HARD_NEGATIVE_PENALTY;
    }
  }

  for (const keyword of SOFT_NEGATIVE_KEYWORDS) {
    if (lower.includes(keyword) && !spotifyVersionTokens.has(keyword)) {
      matchedKeywords.push(keyword);
      penalty += SOFT_NEGATIVE_PENALTY;
    }
  }

  for (const keyword of POSITIVE_KEYWORDS) {
    if (lower.includes(keyword)) {
      matchedKeywords.push(`+${keyword}`);
      bonus += POSITIVE_BONUS;
    }
  }

  return { penalty, bonus, matchedKeywords };
}