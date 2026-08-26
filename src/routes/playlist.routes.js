import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { getSpotifyPlaylists, getSpotifyPlaylistTracks } from "../controllers/playlist.controller.js";
const playlistRouter = Router();

// GET /api/playlist/spotify - Lists the user's playlists. 
playlistRouter.get("/spotify", authenticate, getSpotifyPlaylists);
// GET /api/playlist/spotify/:playlistId - Lists all the tracks of the particular playlist. 
playlistRouter.get("/spotify/:playlistId", authenticate, getSpotifyPlaylistTracks);
export default playlistRouter;
