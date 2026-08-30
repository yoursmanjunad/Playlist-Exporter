import { google } from "googleapis";

export async function createYouTubePlaylist({
  accessToken,
  refreshToken,
  name,
  description,
}) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    const response = await youtube.playlists.insert({
      part: ["snippet", "status"],

      requestBody: {
        snippet: {
          title: name,
          description: description || "",
        },

        status: {
          privacyStatus: "private",
        },
      },
    });

    const playlist = response.data;

    return {
      playlistId: playlist.id,
      title: playlist.snippet.title,
      description: playlist.snippet.description,

      url: `https://www.youtube.com/playlist?list=${playlist.id}`,
    };
  } catch (error) {
    console.error(
      "CREATE YOUTUBE PLAYLIST ERROR.",
      error.response?.data || error.message
    );

    throw error;
  }
}