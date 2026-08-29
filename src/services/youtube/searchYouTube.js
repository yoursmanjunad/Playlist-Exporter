import axios from "axios";

export async function searchYouTube(query) {
  try {

    if (!query) {
      console.log("Search query is empty!");
      return [];
    }

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      query
    )}`;

    const response = await axios.get(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    // Extract all video IDs from YouTube's embedded data
    const videoIdMatches = [
      ...response.data.matchAll(/"videoId":"([^"]+)"/g),
    ];

    const results = [];
    const seen = new Set();

    for (const match of videoIdMatches) {
      const videoId = match[1];

      if (!videoId || seen.has(videoId)) {
        continue;
      }

      seen.add(videoId);

      results.push({
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });

      // Return only the top 5 unique results
      if (results.length >= 5) {
        break;
      }
    }
    return results;
  } catch (error) {
    console.error("YouTube search error:", error.message);

    return [];
  }
}