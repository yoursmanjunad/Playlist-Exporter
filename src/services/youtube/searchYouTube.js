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

    const html = response.data;

    // ==========================================
    // EXTRACT VIDEO IDs
    // ==========================================

    const videoIdMatches = [
      ...html.matchAll(/"videoId":"([^"]+)"/g),
    ];

    const results = [];

    const seen = new Set();

    for (const match of videoIdMatches) {
      const videoId = match[1];

      if (!videoId || seen.has(videoId)) {
        continue;
      }

      seen.add(videoId);

      // ==========================================
      // FIND VIDEO TITLE
      // ==========================================

      const videoIndex = html.indexOf(
        `"videoId":"${videoId}"`
      );

      const nearbyContent = html.slice(
        videoIndex,
        videoIndex + 10000
      );

      const titleMatch = nearbyContent.match(
        /"title":\{"runs":\[\{"text":"([^"]+)"/
      );

      const channelMatch = nearbyContent.match(
        /"ownerText":\{"runs":\[\{"text":"([^"]+)"/
      );

      const thumbnailMatch = nearbyContent.match(
        /"thumbnails":\[\{"url":"([^"]+)"/
      );

      const title =
        titleMatch?.[1] || "Unknown Title";

      const channelTitle =
        channelMatch?.[1] || "Unknown Channel";

      const thumbnail =
        thumbnailMatch?.[1]?.replace(/\\u0026/g, "&") ||
        null;

      results.push({
        videoId,

        title,

        channelTitle,

        thumbnail,

        url: `https://www.youtube.com/watch?v=${videoId}`,
      });

      console.log("YouTube Result:", {
        videoId,
        title,
        channelTitle,
      });

      // Return only top 5 results

      if (results.length >= 5) {
        break;
      }
    }

    return results;
  } catch (error) {
    console.error(
      "YouTube search error:",
      error.message
    );

    return [];
  }
}