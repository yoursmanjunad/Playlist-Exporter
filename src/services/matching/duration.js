// duration.js
// Scores how closely two track durations match. This is one of the
// strongest signals available: a wrong-length result (full album, DJ
// mix, looped upload, truncated clip) can look like an excellent text
// match while being an entirely wrong video.

const TOLERANT_DIFF_SECONDS = 3; // essentially a perfect match
const MAX_USEFUL_DIFF_SECONDS = 45; // beyond this, treat as unrelated

/**
 * @param {number} spotifyDurationMs - track duration from Spotify, in ms
 * @param {number} youtubeDurationSeconds - result duration, in seconds
 * @returns {number|null} 0-100 score, or null if either duration is
 *   unavailable (caller should skip this signal / redistribute weight)
 */
export function calculateDurationScore(spotifyDurationMs, youtubeDurationSeconds) {
  if (!spotifyDurationMs || !youtubeDurationSeconds) {
    return null;
  }

  const spotifySeconds = spotifyDurationMs / 1000;
  const diff = Math.abs(spotifySeconds - youtubeDurationSeconds);

  if (diff <= TOLERANT_DIFF_SECONDS) return 100;
  if (diff >= MAX_USEFUL_DIFF_SECONDS) return 0;

  const range = MAX_USEFUL_DIFF_SECONDS - TOLERANT_DIFF_SECONDS;
  return Math.round((1 - (diff - TOLERANT_DIFF_SECONDS) / range) * 100);
}