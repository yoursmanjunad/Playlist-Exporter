// Handles Spotify Login
export async function spotifyLogin(req, res) {
    try {
        const scopes = [
            "user-read-private",
            "playlist-read-private",
            "playlist-read-collaborative"
        ];

        const params = new URLSearchParams({
            client_id: process.env.SPOTIFY_CLIENT_ID,
            response_type: "code",
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            scope: scopes.join(" ")
        });

        const authorizationUrl =
            `https://accounts.spotify.com/authorize?${params.toString()}`;
        res.redirect(authorizationUrl);
    } catch (error) {
        console.log(error);
    }
}

export async function spotifyCallback(req, res) {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({
                message: "Authorization code missing."
            });
        }

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

        return res.json({
            message: "Spotify connected successfully",
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            scope: tokenData.scope
        });

    } catch (error) {
        console.error("Spotify callback error:", error);

        return res.status(500).json({
            message: "There's some error at callback."
        });
    }
}