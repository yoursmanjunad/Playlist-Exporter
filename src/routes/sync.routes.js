import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { matchPlaylistTracks } from "../controllers/sync.controller.js";
import { createYouTubePlaylistFromSpotify } from "../controllers/transferPlaylist.controller.js";
import { previewPlaylistMatches } from "../controllers/matchPreview.controllers.js";
import { generatePlaylistMatches } from "../controllers/generateMatches.controller.js";
import { getPlaylistMatches } from "../controllers/getPlaylistMatches.controller.js";
import { planRateLimit } from "../middleware/rate-limit.middleware.js";

const syncRouter = Router();

// Pass the playlist ID (supports GET and POST)
// This Normalizes the tracks in a playlist. 
// /api/sync/
syncRouter.get("/matchplaylistTrack/:playlistId", authenticate, planRateLimit({
	name: "sync-match",
	freeLimit: 5,
	premiumLimit: 30,
	windowSeconds: 60 * 60,
	message: "Too many playlist matching requests. Please try again later."
}), matchPlaylistTracks);
syncRouter.post("/matchplaylistTrack/:playlistId", authenticate, planRateLimit({
	name: "sync-match",
	freeLimit: 5,
	premiumLimit: 30,
	windowSeconds: 60 * 60,
	message: "Too many playlist matching requests. Please try again later."
}), matchPlaylistTracks);
// /api/sync/create-youtube-playlist/:playlistId
syncRouter.post("/create-youtube-playlist/:playlistId", authenticate, planRateLimit({
	name: "sync-export",
	freeLimit: 5,
	premiumLimit: 30,
	windowSeconds: 60 * 60,
	message: "Too many playlist export requests. Please try again later."
}), createYouTubePlaylistFromSpotify);
syncRouter.get("/preview-matches/:playlistId", authenticate, planRateLimit({
	name: "sync-preview",
	freeLimit: 20,
	premiumLimit: 60,
	windowSeconds: 60 * 60,
	message: "Too many match preview requests. Please try again later."
}), previewPlaylistMatches);

syncRouter.post("/generate-matches/:playlistId", authenticate, planRateLimit({
	name: "sync-generate",
	freeLimit: 5,
	premiumLimit: 30,
	windowSeconds: 60 * 60,
	message: "Too many playlist matching requests. Please try again later."
}), generatePlaylistMatches);
syncRouter.get("/matches/:playlistId", authenticate, planRateLimit({
	name: "sync-matches-read",
	freeLimit: 60,
	premiumLimit: 180,
	windowSeconds: 15 * 60
}), getPlaylistMatches)
syncRouter.post("/transfer-playlist/:playlistId", authenticate, planRateLimit({
	name: "sync-export",
	freeLimit: 5,
	premiumLimit: 30,
	windowSeconds: 60 * 60,
	message: "Too many playlist export requests. Please try again later."
}), createYouTubePlaylistFromSpotify);
export default syncRouter;