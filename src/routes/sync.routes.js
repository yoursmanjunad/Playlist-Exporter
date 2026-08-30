import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { matchPlaylistTracks } from "../controllers/sync.controller.js";
import { createYouTubePlaylistFromSpotify } from "../controllers/transfer.controller.js";

const syncRouter = Router();

// Pass the playlist ID (supports GET and POST)
// This Normalizes the tracks in a playlist. 
// /api/sync/
syncRouter.get("/matchplaylistTrack/:playlistId", authenticate, matchPlaylistTracks);
syncRouter.post("/matchplaylistTrack/:playlistId", authenticate, matchPlaylistTracks);
// /api/sync/create-youtube-playlist/:playlistId
syncRouter.post("/create-youtube-playlist/:playlistId", authenticate, createYouTubePlaylistFromSpotify)
export default syncRouter;