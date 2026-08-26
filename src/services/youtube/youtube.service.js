import { google } from "googleapis";
import connectedAccount from "../../models/connectedAccount.models.js";
import { decrypt, encrypt } from "../../utils/encryption.js";

export async function getYouTubeClient(userId) {
    const account = await connectedAccount
        .findOne({
            userId,
            provider: "youtube",
            status: "connected"
        })
        .select("+accessToken +refreshToken");

    if (!account) {
        throw new Error("YouTube account is not connected.");
    }
    console.error("YouTube search error:", error.stack || error);

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: account.refreshToken
        ? decrypt(account.refreshToken)
        : undefined,
    expiry_date: account.tokenExpiresAt
        ? new Date(account.tokenExpiresAt).getTime()
        : undefined
});

    oauth2Client.on("tokens", async (tokens) => {
        try {
            const update = {};

            if (tokens.access_token) {
                update.accessToken = encrypt(tokens.access_token);
            }

            if (tokens.refresh_token) {
                update.refreshToken = encrypt(tokens.refresh_token);
            }

            if (tokens.expiry_date) {
                update.tokenExpiresAt = new Date(tokens.expiry_date);
            }

            if (Object.keys(update).length > 0) {
                await connectedAccount.updateOne(
                    { _id: account._id },
                    { $set: update }
                );
            }

        } catch (error) {
            console.error(
                "Failed to save refreshed YouTube token:",
                error
            );
        }
    });

    return google.youtube({
        version: "v3",
        auth: oauth2Client
    });
}