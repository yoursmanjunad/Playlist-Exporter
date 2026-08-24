import connectedAccount from "../models/connectedAccount.models.js";
import playlistModel from "../models/playlist.models.js";
import { decrypt, encrypt } from "../utils/encryption.js";

/**
 * Helper function to ensure we always have an active Spotify access token.
 * Automatically refreshes the token using the refresh_token if expired or near expiry.
 */
async function getValidSpotifyAccessToken(account) {
    const isExpired = !account.tokenExpiresAt || new Date(account.tokenExpiresAt) <= new Date(Date.now() + 60000);

    if (isExpired && account.refreshToken) {
        try {
            const decryptedRefreshToken = decrypt(account.refreshToken);
            const response = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Basic " + Buffer.from(
                        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                    ).toString("base64")
                },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: decryptedRefreshToken
                })
            });

            const data = await response.json();
            if (response.ok && data.access_token) {
                account.accessToken = encrypt(data.access_token);
                if (data.refresh_token) {
                    account.refreshToken = encrypt(data.refresh_token);
                }
                account.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
                account.status = "connected";
                await account.save();
                return data.access_token;
            }
        } catch (err) {
            console.error("Auto token refresh error:", err);
        }
    }

    return decrypt(account.accessToken);
}

// Pulls all the playlists of the user - SPOTIFY
export async function getSpotifyPlaylists(req, res) {
    try {
        const userId = req.user._id;

        const account = await connectedAccount
            .findOne({
                userId,
                provider: "spotify",
                status: "connected"
            })
            .select("+accessToken +refreshToken");

        if (!account || !account.accessToken) {
            return res.status(404).json({
                message: "Spotify account is not connected."
            });
        }

        const accessToken = await getValidSpotifyAccessToken(account);

        const response = await fetch(
            "https://api.spotify.com/v1/me/playlists",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                message: "Failed to fetch Spotify playlists",
                error: data
            });
        }

        // Save every fetched playlist to the database matching PlaylistSchema attributes
        const savePromises = (data.items || []).map((playlist) => {
            return playlistModel.findOneAndUpdate(
                {
                    userId,
                    provider: "spotify",
                    providerPlaylistId: playlist.id
                },
                {
                    userId,
                    provider: "spotify",
                    providerPlaylistId: playlist.id,
                    name: playlist.name,
                    description: playlist.description || "",
                    coverImageUrl: playlist.images?.[0]?.url || null,
                    ownerDisplayName: playlist.owner?.display_name || playlist.owner?.id || null,
                    isPublic: playlist.public ?? false,
                    trackCount: playlist.tracks?.total ?? playlist.items?.total ?? 0,
                    selectedForTransfer: false,
                    importedAt: new Date(),
                    lastSyncedAt: new Date()
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        });

        const savedPlaylists = await Promise.all(savePromises);

        return res.status(200).json({
            message: "Playlists fetched and saved to database successfully",
            count: savedPlaylists.length,
            playlists: savedPlaylists
        });

    } catch (error) {
        console.error("Get Spotify playlists error:", error);

        return res.status(500).json({
            message: "Failed to fetch Spotify playlists"
        });
    }
}

// Pulls all the tracks of the particular playlist - SPOTIFY
export async function getSpotifyPlaylistTracks(req, res) {
    try {
        const userId = req.user._id;
        const { playlistId } = req.params;

        if (!playlistId) {
            return res.status(400).json({
                message: "Playlist ID is required."
            });
        }

        const account = await connectedAccount
            .findOne({
                userId,
                provider: "spotify",
                status: "connected"
            })
            .select("+accessToken +refreshToken");

        if (!account || !account.accessToken) {
            return res.status(404).json({
                message: "Spotify account is not connected."
            });
        }

        const accessToken = await getValidSpotifyAccessToken(account);

        const response = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistId}/items`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Spotify API error response status:", response.status);
            console.error("Spotify API error payload:", JSON.stringify(data, null, 2));
            return res.status(response.status).json({
                message: "Failed to fetch playlist tracks.",
                error: data
            });
        }

        const rawItems = data.tracks?.items || data.items || [];
        const tracks = rawItems
            .map(item => item.track || item.item)
            .filter(Boolean)
            .map(t => ({
                id: t.id,
                name: t.name,
                artists: (t.artists || []).map(artist => artist.name),
                album: t.album?.name || null,
                albumImage: t.album?.images?.[0]?.url || null,
                durationMs: t.duration_ms
            }));

        return res.status(200).json({
            playlistId,
            playlistName: data.name || null,
            tracks
        });

    } catch (error) {
        console.error("Get Spotify playlist tracks error:", error);
        return res.status(500).json({
            message: "Failed to fetch playlist tracks."
        });
    }
}