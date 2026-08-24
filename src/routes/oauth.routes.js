import { Router } from "express";
import { spotifyCallback, spotifyLogin, spotifyRefreshToken, getSpotifyStatus } from "../controllers/oauth.controllers.js";
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

export default oauthRouter;
