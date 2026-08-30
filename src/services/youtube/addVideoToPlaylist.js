import { google } from "googleapis";

export async function addVideoToYouTubePlaylist({
  accessToken,
  refreshToken,
  playlistId,
  videoId,
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

    const response = await youtube.playlistItems.insert({
      part: ["snippet"],

      requestBody: {
        snippet: {
          playlistId,

          resourceId: {
            kind: "youtube#video",
            videoId,
          },
        },
      },
    });

    return response.data;
  } catch (error) {
    console.error(
      "ADD VIDEO TO PLAYLIST ERROR:",
      error.response?.data || error.message
    );

    throw error;
  }
}