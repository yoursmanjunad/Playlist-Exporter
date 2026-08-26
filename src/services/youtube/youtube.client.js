import { decrypt } from "../../utils/encryption.js";
import connectedAccount from "../../models/connectedAccount.models.js";
import { google } from "googleapis";
export async function testYouTubeSearch(req,res){
    try {
        const userId = req.user._id;
        const query = "Aaya sher - anirudh ravichander, nani, the paradise.";
        const account = await connectedAccount
            .findOne({
                userId,
                provider: "youtube",
                status: "connected"
            })
            .select("+accessToken +refreshToken");
        if (!account){
            return res.status(404).json({
                message: "YouTube account is not connected."
            })
        }
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
        const youtube = google.youtube({
            version: "v3",
            auth: oauth2Client
        });

        const response = await youtube.search.list({
            part: ["snippet"],
            q: query,
            maxResults: 10
        });
        return res.status(200).json({
            message: "YouTube Search Successful",
            query, 
            count: response.data.items?.length || 0,
            results: response.data.items || []
        })
    } catch (error) {
        console.error(
            "YouTube search error:",
            error.response?.data || error
        );

        return res.status(500).json({
            message: "YouTube search failed.",

            error:
                error.response?.data ||
                error.message
        });
    }
}