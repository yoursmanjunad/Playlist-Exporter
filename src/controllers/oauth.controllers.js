import connectedAccount from "../models/connectedAccount.models.js";
import { encrypt, decrypt } from "../utils/encryption.js";

// Handles Spotify Login & initiates OAuth redirect
export async function spotifyLogin(req, res) {
    try {
        const scopes = [
            "user-read-private",
            "playlist-read-private",
            "playlist-read-collaborative",
            "user-read-email"
        ];

        // Pass authenticated user ID in state parameter for callback verification
        const state = req.user ? req.user._id.toString() : "";

        const params = new URLSearchParams({
            client_id: process.env.SPOTIFY_CLIENT_ID,
            response_type: "code",
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            scope: scopes.join(" "),
            state
        });

        const authorizationUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
        res.redirect(authorizationUrl);
    } catch (error) {
        console.error("Spotify login initiation error:", error);
        return res.status(500).json({
            message: "Failed to initiate Spotify authorization"
        });
    }
}

// Handles Spotify OAuth callback & saves account details to DB
export async function spotifyCallback(req, res) {
    try {
        const { code, state } = req.query;
        if (!code) {
            return res.status(400).json({
                message: "Authorization code missing."
            });
        }

        // Determine user ID from authenticate middleware or state param
        const userId = req.user?._id || state;

        if (!userId) {
            return res.status(401).json({
                message: "User context missing during OAuth callback. User must be authenticated."
            });
        }

        // Exchange authorization code for access & refresh tokens
        const response = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization:
                        "Basic " +
                        Buffer.from(
                            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                        ).toString("base64")
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: process.env.SPOTIFY_REDIRECT_URI
                })
            }
        );

        const tokenData = await response.json();

        if (!response.ok) {
            return res.status(400).json({
                message: "Failed to get Spotify tokens",
                error: tokenData
            });
        }

        // Fetch Spotify user profile details
        const profileResponse = await fetch(
            "https://api.spotify.com/v1/me",
            {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`
                }
            }
        );
        const spotifyProfile = await profileResponse.json();

        if (!profileResponse.ok) {
            return res.status(400).json({
                message: "Failed to fetch Spotify user profile",
                error: spotifyProfile
            });
        }

        // Calculate token expiration date (expires_in is in seconds)
        const tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
        const scopeArray = tokenData.scope ? tokenData.scope.split(" ") : [];

        // Encrypt tokens before storing in database at rest
        const encryptedAccessToken = encrypt(tokenData.access_token);
        const encryptedRefreshToken = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : undefined;

        // Construct update object matching connectedAccount schema
        const updateData = {
            userId,
            provider: "spotify",
            providerAccountId: spotifyProfile.id,
            providerEmail: spotifyProfile.email || null,
            providerDisplayName: spotifyProfile.display_name || null,
            providerAvatarUrl: spotifyProfile.images?.[0]?.url || null,
            accessToken: encryptedAccessToken,
            tokenExpiresAt,
            scope: scopeArray,
            status: "connected",
            lastSyncedAt: new Date()
        };

        if (encryptedRefreshToken) {
            updateData.refreshToken = encryptedRefreshToken;
        }

        // Upsert into connectedAccount collection (one per user per provider)
        const account = await connectedAccount.findOneAndUpdate(
            { userId, provider: "spotify" },
            updateData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // If request originates from browser OAuth redirect flow, redirect back to frontend
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
            return res.redirect("/?spotify=connected");
        }

        return res.status(200).json({
            message: "Spotify connected and saved to database successfully",
            account: {
                id: account._id,
                userId: account.userId,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                providerDisplayName: account.providerDisplayName,
                providerEmail: account.providerEmail,
                providerAvatarUrl: account.providerAvatarUrl,
                status: account.status,
                tokenExpiresAt: account.tokenExpiresAt
            }
        });

    } catch (error) {
        console.error("Spotify callback error:", error);
        return res.status(500).json({
            message: "Error during Spotify OAuth callback processing",
            error: error.message
        });
    }
}

// Check if user has connected Spotify account
export async function getSpotifyStatus(req, res) {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const account = await connectedAccount.findOne({ userId, provider: "spotify" });
        if (!account) {
            return res.status(200).json({ connected: false });
        }

        return res.status(200).json({
            connected: true,
            account: {
                providerAccountId: account.providerAccountId,
                providerDisplayName: account.providerDisplayName,
                providerEmail: account.providerEmail,
                providerAvatarUrl: account.providerAvatarUrl,
                status: account.status,
                tokenExpiresAt: account.tokenExpiresAt
            }
        });
    } catch (error) {
        console.error("Spotify status error:", error);
        return res.status(500).json({ message: "Error checking Spotify status" });
    }
}

// Refreshes Spotify access token and updates database
export async function spotifyRefreshToken(req, res) {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        // Retrieve existing connected account with select:false tokens
        const account = await connectedAccount
            .findOne({ userId, provider: "spotify" })
            .select("+accessToken +refreshToken");

        if (!account || !account.refreshToken) {
            return res.status(404).json({
                message: "No Spotify refresh token found for this user account"
            });
        }

        const decryptedRefreshToken = decrypt(account.refreshToken);

        const response = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization:
                        "Basic " +
                        Buffer.from(
                            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                        ).toString("base64")
                },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: decryptedRefreshToken
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            account.status = "error";
            account.lastError = data.error_description || "Failed to refresh token";
            await account.save();
            return res.status(400).json({
                message: "Failed to refresh Spotify token",
                error: data
            });
        }

        // Update encrypted tokens and expiration in DB
        account.accessToken = encrypt(data.access_token);
        if (data.refresh_token) {
            account.refreshToken = encrypt(data.refresh_token);
        }
        account.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
        account.status = "connected";
        account.lastError = null;
        await account.save();

        return res.status(200).json({
            message: "Spotify access token refreshed successfully",
            tokenExpiresAt: account.tokenExpiresAt
        });

    } catch (error) {
        console.error("Spotify refresh token error:", error);
        return res.status(500).json({
            message: "Error refreshing Spotify token",
            error: error.message
        });
    }
}