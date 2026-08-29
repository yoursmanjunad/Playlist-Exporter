import mongoose from "mongoose";

import playlistModel from "../models/playlist.models.js";
import trackModel from "../models/track.models.js";

import { normalizeTrack } from "../services/matching/normalization.js";
import { searchYouTube } from "../services/youtube/searchYouTube.js";
// GET or POST:
// /api/sync/matchplaylistTrack/:playlistId

export async function matchPlaylistTracks(req, res) {
  try {
    console.log("MATCH PLAYLIST CONTROLLER IS RUNNING");

    const userId = req.user._id;
    const { playlistId } = req.params;

    console.log("Playlist ID received:", playlistId);

    if (!playlistId) {
      return res.status(400).json({
        message: "Playlist ID is required",
      });
    }

    const query = {
      userId,
      provider: "spotify",
    };

    if (mongoose.Types.ObjectId.isValid(playlistId)) {
      query.$or = [
        { _id: playlistId },
        { providerPlaylistId: playlistId },
      ];
    } else {
      query.providerPlaylistId = playlistId;
    }

    const playlist = await playlistModel.findOne(query);

    if (!playlist) {
      return res.status(404).json({
        message: "Playlist not found.",
      });
    }

    const tracks = await trackModel
      .find({
        playlistId: playlist._id,
        userId,
      })
      .sort({ position: 1 })
      .lean();

    if (!tracks.length) {
      return res.status(404).json({
        message: "No tracks found for this playlist.",
      });
    }

    const matchedTracks = [];

    // Process tracks one by one for easier debugging
    for (const track of tracks) {
      const normalized = normalizeTrack(track);


      // Create a YouTube search query
      const searchQuery = [
        normalized.title,
        ...(normalized.artists || []),
      ]
        .filter(Boolean)
        .join(" ");

      console.log("YouTube search query:", searchQuery);

      // Search YouTube
      const youtubeResults = await searchYouTube(searchQuery);

      console.log(
        "YouTube results found:",
        youtubeResults.length
      );

      matchedTracks.push({
        trackId: track._id,

        spotify: {
          name: track.name,
          artists: track.artists,
          position: track.position,
        },

        normalized,

        searchQuery,

        youtubeResults,
      });
    }

    return res.status(200).json({
      message:
        "Tracks normalized and YouTube results fetched successfully",

      playlist: {
        id: playlist._id,
        providerPlaylistId: playlist.providerPlaylistId,
        name: playlist.name,
      },

      count: matchedTracks.length,

      tracks: matchedTracks,
    });
  } catch (error) {
    console.error(
      "Match playlist tracks error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to match playlist tracks with YouTube.",
      error: error.message,
    });
  }
}