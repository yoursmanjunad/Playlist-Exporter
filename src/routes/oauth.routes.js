import {Router} from "express";
import { spotifyCallback, spotifyLogin } from "../controllers/oauth.controllers.js";
const oauthRouter = Router();

oauthRouter.get("/spotify-login",spotifyLogin)
oauthRouter.get("/spotify-callback", spotifyCallback)
export default oauthRouter;
