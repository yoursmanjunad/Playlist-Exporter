import { calculateSimilarity } from "./similarity.js";

import {
  calculatePenalties,
} from "./penalties.js";


export function scoreMatch(
  normalizedTrack,
  youtubeResult
) {
  const spotifyTitle =
    normalizedTrack.title || "";

  const spotifyArtists =
    (normalizedTrack.artists || [])
      .join(" ");


  const youtubeTitle =
    youtubeResult.title || "";

  const youtubeChannel =
    youtubeResult.channelTitle || "";


  // ==============================
  // TITLE SIMILARITY
  // ==============================

  const titleScore =
    calculateSimilarity(
      spotifyTitle,
      youtubeTitle
    );


  // ==============================
  // ARTIST SIMILARITY
  // ==============================

  const artistScore =
    calculateSimilarity(
      spotifyArtists,
      `${youtubeTitle} ${youtubeChannel}`
    );


  // ==============================
  // PENALTIES
  // ==============================

  const {
    penalty,
    matchedKeywords,
  } = calculatePenalties(
    youtubeTitle
  );


  // ==============================
  // FINAL SCORE
  // ==============================

  const rawScore =
    titleScore * 0.65 +
    artistScore * 0.35;


  const finalScore =
    Math.max(
      0,
      Math.min(
        100,
        rawScore - penalty
      )
    );


  return {
    score:
      Math.round(finalScore),

    breakdown: {
      titleScore:
        Math.round(titleScore),

      artistScore:
        Math.round(artistScore),

      penalty,

      matchedKeywords,
    },
  };
}