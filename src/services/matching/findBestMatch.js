import { scoreMatch } from "./scoreMatch.js";

// Below this score, the "best" match is unreliable enough that callers
// should probably treat it as "no match" rather than trust it blindly.
export const CONFIDENCE_THRESHOLD = 55;

export function findBestMatch(normalizedTrack, youtubeResults) {
  if (!youtubeResults || youtubeResults.length === 0) {
    return { bestMatch: null, allMatches: [], confident: false };
  }

  const scoredResults = youtubeResults.map((result) => {
    const scoring = scoreMatch(normalizedTrack, result);
    return {
      ...result,
      score: scoring.score,
      breakdown: scoring.breakdown,
    };
  });

  scoredResults.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: prefer the result whose duration is actually known and
    // close — two candidates can land on the same rounded score for
    // very different underlying reasons.
    const aDur = a.breakdown.durationScore ?? -1;
    const bDur = b.breakdown.durationScore ?? -1;
    return bDur - aDur;
  });

  const bestMatch = scoredResults[0];

  return {
    bestMatch,
    allMatches: scoredResults,
    confident: bestMatch.score >= CONFIDENCE_THRESHOLD,
  };
}