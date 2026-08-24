import { Router } from "express";
import { spotifyCallback, spotifyLogin, spotifyRefreshToken } from "../controllers/oauth.controllers.js";
import { authenticate } from "../middleware/auth.middleware.js"
const oauthRouter = Router();
// GET /api/oauth/spotify-login
oauthRouter.get("/spotify-login", authenticate, spotifyLogin)
// GET /api/oauth/spotify-callback
oauthRouter.get("/spotify-callback", authenticate, spotifyCallback)
// GET /api/oauth/spotify-refresh-token
oauthRouter.get("/spotify-refresh-token", authenticate, spotifyRefreshToken)
export default oauthRouter;
