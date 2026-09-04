import { fuzzy } from "fast-fuzzy";
import { stripNoise, tokenize } from "./normalization.js";

// Plain Levenshtein distance, used to build a symmetric character-level
// similarity ratio. fast-fuzzy's `fuzzy` is asymmetric/subsequence-based
// (great for search-as-you-type), which can over-score partial substring
// matches when what we actually want is "how similar are these two full
// titles", so we don't rely on it alone.
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }
  return prevRow[n];
}

function levenshteinRatio(a, b) {
  if (!a && !b) return 100;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(a, b);
  return (1 - distance / maxLen) * 100;
}

// Order-independent word overlap (Dice coefficient over token sets).
// Handles "Artist - Title" vs "Title by Artist" style reordering, and
// is far less sensitive to a handful of extra/missing filler words than
// a raw character comparison is.
function tokenSetRatio(a, b) {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 && tokensB.size === 0) return 100;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
  }
  return ((2 * shared) / (tokensA.size + tokensB.size)) * 100;
}

// Combined similarity score (0-100) between two free-text strings.
// - Levenshtein ratio catches close character-level matches (typos,
//   minor punctuation differences).
// - Token set ratio catches reordered/rearranged matches.
// - fast-fuzzy catches partial/subsequence matches (useful when one
//   string is a short substring of the other).
// The three are blended rather than trusting any single one, since
// each fails in different, complementary ways.
export function calculateSimilarity(source = "", target = "") {
  if (!source || !target) return 0;

  const cleanSource = stripNoise(source);
  const cleanTarget = stripNoise(target);
  if (!cleanSource || !cleanTarget) return 0;

  const charScore = levenshteinRatio(cleanSource, cleanTarget);
  const tokenScore = tokenSetRatio(cleanSource, cleanTarget);
  const subsequenceScore = fuzzy(cleanSource, cleanTarget) * 100;

  const blended = charScore * 0.4 + tokenScore * 0.4 + subsequenceScore * 0.2;

  return Math.max(0, Math.min(100, blended));
}