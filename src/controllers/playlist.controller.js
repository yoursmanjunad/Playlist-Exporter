import connectedAccount from "../models/connectedAccount.models.js";
import playlistModel from "../models/playlist.models.js";
import trackModel from "../models/track.models.js"
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

// Returns playlists previously imported from Spotify for the authenticated user.
// This keeps page loads local and leaves the Spotify API request as an explicit action.
export async function getSavedSpotifyPlaylists(req, res) {
    try {
        const playlists = await playlistModel
            .find({
                userId: req.user._id,
                provider: "spotify"
            })
            .sort({ updatedAt: -1 })
            .lean();

        return res.status(200).json({
            message: "Saved Spotify playlists fetched successfully",
            count: playlists.length,
            playlists
        });
    } catch (error) {
        console.error("Get saved Spotify playlists error:", error);

        return res.status(500).json({
            message: "Failed to fetch saved Spotify playlists"
        });
    }
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

        const playlists = [];
        let nextUrl = new URL("https://api.spotify.com/v1/me/playlists");
        nextUrl.searchParams.set("limit", "50");

        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({
                    message: "Failed to fetch Spotify playlists",
                    error: data
                });
            }

            playlists.push(...(data.items || []));
            nextUrl = data.next ? new URL(data.next) : null;
        }

        // Save every fetched playlist to the database matching PlaylistSchema attributes
        const savePromises = playlists.map((playlist) => {
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
                    isCollaborative: playlist.collaborative ?? false,
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

// Pulls all the tracks of the particular playlist and save to DB - SPOTIFY
export async function getSpotifyPlaylistTracks(req, res) {
    try {
        const userId = req.user._id;
        const { playlistId } = req.params;

        if (!playlistId) {
            return res.status(400).json({
                message: "Playlist ID is required."
            });
        }

        const playlist = await playlistModel.findOne({
            userId,
            provider: "spotify",
            providerPlaylistId: playlistId
        });

        if (!playlist) {
            return res.status(404).json({
                message: "Playlist not found in database. Fetch playlists first."
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

        const grantedScopes = new Set(account.scope || []);
        const requiredScope = playlist.isCollaborative
            ? "playlist-read-collaborative"
            : "playlist-read-private";

        if (!grantedScopes.has(requiredScope)) {
            return res.status(403).json({
                message: "Spotify authorization is missing playlist read permissions. Reconnect Spotify and approve playlist access.",
                missingScopes: [requiredScope],
                playlist: {
                    id: playlist.providerPlaylistId,
                    name: playlist.name,
                    owner: playlist.ownerDisplayName,
                    collaborative: playlist.isCollaborative
                }
            });
        }

        const accessToken = await getValidSpotifyAccessToken(account);

        const rawItems = [];
        let nextUrl = new URL(
            `https://api.spotify.com/v1/playlists/${playlistId}/items`
        );
        nextUrl.searchParams.set("limit", "100");

        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(
                    "Spotify API error response status:",
                    response.status
                );

                console.error(
                    "Spotify API error payload:",
                    JSON.stringify(data, null, 2)
                );

                return res.status(response.status).json({
                    message: response.status === 403
                        ? "Spotify denied access to this playlist. It may be private, collaborative, unavailable in your market, or no longer accessible to this account."
                        : "Failed to fetch playlist tracks.",
                    error: data,
                    playlist: {
                        id: playlist.providerPlaylistId,
                        name: playlist.name,
                        owner: playlist.ownerDisplayName,
                        collaborative: playlist.isCollaborative
                    }
                });
            }

            rawItems.push(...(data.items || []));
            nextUrl = data.next ? new URL(data.next) : null;
        }

        const tracks = rawItems
            .map((item) => item.track || item.item)
            .filter(Boolean);

        const trackDocuments = tracks.map((track, index) => ({
            playlistId: playlist._id,
            userId,

            provider: "spotify",

            providerTrackId: track.id,

            title: track.name,

            artists: (track.artists || []).map(
                (artist) => artist.name
            ),

            album: track.album?.name || null,

            albumArtUrl:
                track.album?.images?.[0]?.url || null,

            durationMs: track.duration_ms || null,

            isrc: track.external_ids?.isrc || null,

            position: index,

            selectedForTransfer: true
        }));

        if (trackDocuments.length > 0) {
            await trackModel.bulkWrite(
                trackDocuments.map((track) => ({
                    updateOne: {
                        filter: {
                            playlistId: playlist._id,
                            providerTrackId: track.providerTrackId
                        },

                        update: {
                            $set: track
                        },

                        upsert: true
                    }
                }))
            );
        }

        playlist.trackCount = trackDocuments.length;
        playlist.lastSyncedAt = new Date();

        await playlist.save();

        return res.status(200).json({
            message: "Playlist tracks fetched and saved successfully",

            playlistId: playlist._id,

            spotifyPlaylistId: playlistId,

            playlistName: playlist.name,

            count: trackDocuments.length,

            tracks: trackDocuments
        });

    } catch (error) {
    console.error("=================================");
    console.error("Get Spotify playlist tracks error:");
    console.error(error);
    console.error("=================================");

    return res.status(500).json({
        message: "Failed to fetch playlist tracks.",
        error: error.message
    });
}
}
