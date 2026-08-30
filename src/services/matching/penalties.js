const NEGATIVE_KEYWORDS = {
  cover: 40,
  karaoke: 40,
  instrumental: 25,
  live: 15,
  remix: 20,
  "sped up": 20,
  slowed: 20,
  reverb: 15,
  nightcore: 25,
  "8d audio": 25,
  bass: 10,
};

export function calculatePenalties(title = "") {
  const lowerTitle = title.toLowerCase();

  let penalty = 0;

  const matchedKeywords = [];

  for (const [keyword, value] of Object.entries(
    NEGATIVE_KEYWORDS
  )) {
    if (lowerTitle.includes(keyword)) {
      penalty += value;

      matchedKeywords.push({
        keyword,
        penalty: value,
      });
    }
  }

  return {
    penalty,
    matchedKeywords,
  };
}