import {
  scoreMatch,
} from "./scoreMatch.js";


export function findBestMatch(
  normalizedTrack,
  youtubeResults
) {
  if (
    !youtubeResults ||
    youtubeResults.length === 0
  ) {
    return {
      bestMatch: null,
      allMatches: [],
    };
  }


  const scoredResults =
    youtubeResults.map((result) => {
      const scoring =
        scoreMatch(
          normalizedTrack,
          result
        );


      return {
        ...result,

        score:
          scoring.score,

        breakdown:
          scoring.breakdown,
      };
    });


  scoredResults.sort(
    (a, b) => b.score - a.score
  );


  return {
    bestMatch:
      scoredResults[0],

    allMatches:
      scoredResults,
  };
}