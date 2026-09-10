import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { deleteSavedSpotifyPlaylist, getSavedSpotifyPlaylists, getSpotifyPlaylists, getSpotifyPlaylistTracks } from "../controllers/playlist.controller.js";
import { planRateLimit } from "../middleware/rate-limit.middleware.js";
const playlistRouter = Router();

// GET /api/playlist - Lists playlists previously imported for the current user.
playlistRouter.get("/", authenticate, planRateLimit({
	name: "playlist-saved",
	freeLimit: 60,
	premiumLimit: 180,
	windowSeconds: 15 * 60
}), getSavedSpotifyPlaylists);

// GET /api/playlist/spotify - Lists the user's playlists.
playlistRouter.get("/spotify", authenticate, planRateLimit({
	name: "playlist-import",
	freeLimit: 10,
	premiumLimit: 30,
	windowSeconds: 60 * 60,
	message: "Too many playlist imports. Please try again later."
}), getSpotifyPlaylists);

// GET /api/playlist/spotify/:playlistId - Lists all the tracks of the particular playlist.
playlistRouter.get("/spotify/:playlistId", authenticate, planRateLimit({
	name: "playlist-tracks",
	freeLimit: 30,
	premiumLimit: 120,
	windowSeconds: 60 * 60,
	message: "Too many playlist track requests. Please try again later."
}), getSpotifyPlaylistTracks);

// DELETE /api/playlist/:playlistId - Deletes a cached Spotify playlist and its local data.
playlistRouter.delete("/:playlistId", authenticate, planRateLimit({
	name: "playlist-delete",
	freeLimit: 30,
	premiumLimit: 120,
	windowSeconds: 60 * 60
}), deleteSavedSpotifyPlaylist);

// Backward-compatible alias used by clients that call /api/playlist/:playlistId
playlistRouter.get("/:playlistId", authenticate, planRateLimit({
	name: "playlist-tracks-legacy",
	freeLimit: 30,
	premiumLimit: 120,
	windowSeconds: 60 * 60,
	message: "Too many playlist track requests. Please try again later."
}), getSpotifyPlaylistTracks);

export default playlistRouter;
