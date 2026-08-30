import { fuzzy } from "fast-fuzzy";

export function calculateSimilarity(source = "", target = "") {
  if (!source || !target) {
    return 0;
  }

  return fuzzy(
    source.toLowerCase(),
    target.toLowerCase()
  ) * 100;
}