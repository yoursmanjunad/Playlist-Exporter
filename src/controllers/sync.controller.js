import mongoose from "mongoose";
import playlistModel from "../models/playlist.models.js";
import trackModel from "../models/track.models.js";
import { normalizeTrack } from "../services/matching/normalization.js";

// /api/sync/matchplaylistTrack/:playlistId
// This takes the playlist ID and normalize the tracks of it. 
// Playlist and tracks should be fetched first to execute this. 
export async function matchPlaylistTracks(req, res) {
    try {
        const userId = req.user._id;
        const { playlistId } = req.params;
        if (!playlistId) {
            return res.status(400).json({
                message: "Playlist ID is required"
            })
        }

        const query = { userId, provider: "spotify" };
        if (mongoose.Types.ObjectId.isValid(playlistId)) {
            query.$or = [{ _id: playlistId }, { providerPlaylistId: playlistId }];
        } else {
            query.providerPlaylistId = playlistId;
        }

        const playlist = await playlistModel.findOne(query);

        if (!playlist) {
            return res.status(404).json({
                message: "Playlist not found."
            })
        }

        const tracks = await trackModel
            .find({
                playlistId: playlist._id,
                userId
            })
            .sort({ position: 1 })
            .lean();

        if (!tracks.length) {
            return res.status(404).json({
                message: "No tracks found for this playlist."
            })
        }

        const normalizedTracks = tracks.map(track => ({
            ...track,
            normalized: normalizeTrack(track)
        }));

        return res.status(200).json({
            message: "Tracks normalized successfully",
            playlistId: playlist._id,
            providerPlaylistId: playlist.providerPlaylistId,
            count: normalizedTracks.length,
            tracks: normalizedTracks
        })
    } catch (error) {
        console.error("Match playlist tracks error: ", error);
        return res.status(500).json({
            message: "Failed to match playlist tracks.",
            error: error.message
        })
    }
}