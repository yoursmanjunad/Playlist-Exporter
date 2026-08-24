import ConnectedAccount from "../models/connectedAccount.model.js";

export async function getSpotifyPlaylists(req, res) {
    try {
        const userId = req.user._id;

        const account = await ConnectedAccount
            .findOne({
                userId,
                provider: "spotify",
                status: "connected"
            })
            .select("+accessToken +refreshToken");

        if (!account) {
            return res.status(404).json({
                message: "Spotify account is not connected."
            });
        }

        const response = await fetch(
            "https://api.spotify.com/v1/me/playlists",
            {
                headers: {
                    Authorization: `Bearer ${account.accessToken}`
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

        const playlists = data.items.map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            image: playlist.images?.[0]?.url || null,
            tracksCount: playlist.items?.total ?? playlist.tracks?.total ?? 0
        }));

        return res.status(200).json({
            playlists
        });

    } catch (error) {
        console.error("Get Spotify playlists error:", error);

        return res.status(500).json({
            message: "Failed to fetch Spotify playlists"
        });
    }
}