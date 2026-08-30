import mongoose from "mongoose";

import playlistModel from "../models/playlist.models.js";
import playlistMatchModel from "../models/playlistMatch.models.js";

export async function getPlaylistMatches(req, res) {
  try {
    const userId = req.user._id?.toString();
    const { playlistId } = req.params;

    if (!playlistId) {
      return res.status(400).json({
        success: false,
        message: "Playlist ID is required",
      });
    }

    const query = {
      userId,
      provider: "spotify",
    };

    if (mongoose.Types.ObjectId.isValid(playlistId)) {
      query.$or = [
        {
          _id: playlistId,
        },
        {
          providerPlaylistId: playlistId,
        },
      ];
    } else {
      query.providerPlaylistId = playlistId;
    }

    const playlist = await playlistModel.findOne(query);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    const matches = await playlistMatchModel
      .find({
        userId,
        playlistId: playlist._id,
      })
      .populate(
        "trackId",
        "name artists position"
      )
      .lean();

    const sortedMatches = matches.sort((a, b) => {
      return (
        (a.trackId?.position ?? 0) -
        (b.trackId?.position ?? 0)
      );
    });

    return res.status(200).json({
      success: true,

      playlist: {
        id: playlist._id,
        name: playlist.name,
      },

      totalMatches: sortedMatches.length,

      matches: sortedMatches,
    });
  } catch (error) {
    console.error(
      "GET PLAYLIST MATCHES ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve playlist matches",
      error: error.message,
    });
  }
}