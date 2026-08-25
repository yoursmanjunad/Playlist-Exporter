import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { matchPlaylistTracks } from "../controllers/sync.controller.js";

const syncRouter = Router();

// Pass the playlist ID (supports GET and POST)
syncRouter.get("/matchplaylistTrack/:playlistId", authenticate, matchPlaylistTracks);
syncRouter.post("/matchplaylistTrack/:playlistId", authenticate, matchPlaylistTracks);

export default syncRouter;