import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { matchPlaylistTracks } from "../controllers/sync.controller.js";
import { createYouTubePlaylistFromSpotify } from "../controllers/transferPlaylist.controller.js";
import { previewPlaylistMatches } from "../controllers/matchPreview.controllers.js";
import { generatePlaylistMatches } from "../controllers/generateMatches.controller.js";
import { getPlaylistMatches } from "../controllers/getPlaylistMatches.controller.js";

const syncRouter = Router();

// Pass the playlist ID (supports GET and POST)
// This Normalizes the tracks in a playlist. 
// /api/sync/
syncRouter.get("/matchplaylistTrack/:playlistId", authenticate, matchPlaylistTracks);
syncRouter.post("/matchplaylistTrack/:playlistId", authenticate, matchPlaylistTracks);
// /api/sync/create-youtube-playlist/:playlistId
syncRouter.post("/create-youtube-playlist/:playlistId", authenticate, createYouTubePlaylistFromSpotify);
syncRouter.get("/preview-matches/:playlistId", authenticate, previewPlaylistMatches);

syncRouter.post("/generate-matches/:playlistId", authenticate, generatePlaylistMatches);
syncRouter.get("/matches/:playlistId", authenticate, getPlaylistMatches)
syncRouter.post("/transfer-playlist/:playlistId", authenticate, createYouTubePlaylistFromSpotify);
export default syncRouter;