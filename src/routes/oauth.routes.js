import { Router } from "express";
import getYouTubeMe, { spotifyCallback, spotifyLogin, spotifyRefreshToken, getSpotifyStatus, getYouTubeStatus, connectYouTube, youtubeOAuthCallback } from "../controllers/oauth.controllers.js";
import { authenticate } from "../middleware/auth.middleware.js";

const oauthRouter = Router();

// GET /api/oauth/spotify-login (Protected: Initiates OAuth for logged-in user and sets state = userId)
oauthRouter.get("/spotify-login", authenticate, spotifyLogin);

// GET /api/oauth/spotify-callback (PUBLIC: Redirect target from Spotify; authenticates user via state parameter)
oauthRouter.get("/spotify-callback", spotifyCallback);

// GET /api/oauth/spotify-refresh-token (Protected)
oauthRouter.get("/spotify-refresh-token", authenticate, spotifyRefreshToken);

// GET /api/oauth/spotify-status (Protected: Check connection status)
oauthRouter.get("/spotify-status", authenticate, getSpotifyStatus);

// GET /api/oauth/youtube-status (Protected: Check connection status)
oauthRouter.get("/youtube-status", authenticate, getYouTubeStatus);

// GET /api/oauth/youtube-login
oauthRouter.get("/youtube-login", authenticate, connectYouTube);

// GET /api/oauth/youtube-callback
oauthRouter.get("/youtube-callback", youtubeOAuthCallback)

// GET /api/youtube/me
oauthRouter.get("/youtube/getme", authenticate, getYouTubeMe)

export default oauthRouter;
