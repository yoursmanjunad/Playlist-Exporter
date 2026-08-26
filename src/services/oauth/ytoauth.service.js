import { google } from "googleapis";

export const YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube"
];

export function createYouTubeOAuthClient() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

export function getYouTubeAuthorizationUrl(state) {
    const oauth2Client = createYouTubeOAuthClient();

    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: YOUTUBE_SCOPES,
        include_granted_scopes: true,
        state,
        prompt: "consent"
    });
}