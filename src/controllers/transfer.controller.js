import mongoose from "mongoose";

import connectedAccount from "../models/connectedAccount.models.js";
import playlistModel from "../models/playlist.models.js";
import trackModel from "../models/track.models.js";

import { decrypt } from "../utils/encryption.js";
import { normalizeTrack } from "../services/matching/normalization.js";
import { searchYouTube } from "../services/youtube/searchYouTube.js";

import {
  createYouTubePlaylist,
} from "../services/youtube/createPlaylist.js";

import {
  addVideoToYouTubePlaylist,
} from "../services/youtube/addVideoToPlaylist.js";

export async function createYouTubePlaylistFromSpotify(req, res) {
  try {
    console.log("CREATE YOUTUBE PLAYLIST CONTROLLER IS RUNNING");

    // ==============================
    // GET USER + PLAYLIST ID
    // ==============================

    const userId = req.user._id?.toString();
    const { playlistId } = req.params;

    if (!playlistId) {
      return res.status(400).json({
        message: "Playlist ID is required",
      });
    }

    // ==============================
    // FIND SPOTIFY PLAYLIST
    // ==============================

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
        message: "Spotify playlist not found.",
      });
    }

    console.log("Playlist found:", playlist.name);

    // ==============================
    // GET PLAYLIST TRACKS
    // ==============================

    const tracks = await trackModel
      .find({
        playlistId: playlist._id,
        userId,
      })
      .sort({
        position: 1,
      })
      .lean();

    if (!tracks.length) {
      return res.status(404).json({
        message: "No tracks found for this playlist.",
      });
    }

    console.log(`Found ${tracks.length} tracks`);

    // ==============================
    // GET YOUTUBE ACCESS TOKEN
    // ==============================

    const youtubeAccount = await connectedAccount
      .findOne({
        userId,
        provider: "youtube",
        status: "connected",
      })
      .select("+accessToken +refreshToken");

    if (!youtubeAccount || !youtubeAccount.accessToken) {
      return res.status(401).json({
        message: "YouTube account is not connected.",
      });
    }

    const youtubeAccessToken = decrypt(youtubeAccount.accessToken);
    const youtubeRefreshToken = youtubeAccount.refreshToken
      ? decrypt(youtubeAccount.refreshToken)
      : undefined;

    // ==============================
    // CREATE YOUTUBE PLAYLIST
    // ==============================

    const youtubePlaylist = await createYouTubePlaylist({
      accessToken: youtubeAccessToken,
      refreshToken: youtubeRefreshToken,
      name: playlist.name,
      description:
        playlist.description || "Transferred from Spotify",
    });

    console.log(
      "YouTube playlist created:",
      youtubePlaylist.playlistId
    );

    // ==============================
    // SEARCH + ADD TRACKS
    // ==============================

    const transferredTracks = [];
    const failedTracks = [];

    for (const track of tracks) {
      try {
        // ==============================
        // NORMALIZE TRACK
        // ==============================

        const normalized = normalizeTrack(track);

        // ==============================
        // CREATE SEARCH QUERY
        // ==============================

        const searchQuery = [
          normalized.title,
          ...(normalized.artists || []),
        ]
          .filter(Boolean)
          .join(" ");

        console.log("Searching YouTube:", searchQuery);

        // ==============================
        // SEARCH YOUTUBE
        // ==============================

        const youtubeResults = await searchYouTube(searchQuery);

        // ==============================
        // NO RESULTS FOUND
        // ==============================

        if (!youtubeResults || youtubeResults.length === 0) {
          console.log("No YouTube results found");

          failedTracks.push({
            spotifyTrack: {
              name: track.name,
              artists: track.artists,
              position: track.position,
            },
            reason: "No YouTube results found",
          });

          continue;
        }

        // ==============================
        // TEMPORARILY TAKE FIRST RESULT
        // ==============================

        const selectedVideo = youtubeResults[0];

        console.log(
          "Selected YouTube video:",
          selectedVideo.title
        );

        // ==============================
        // ADD VIDEO TO PLAYLIST
        // ==============================

        await addVideoToYouTubePlaylist({
          accessToken: youtubeAccessToken,
          refreshToken: youtubeRefreshToken,
          playlistId: youtubePlaylist.playlistId,
          videoId: selectedVideo.videoId,
        });

        // ==============================
        // SAVE TRANSFER RESULT
        // ==============================

        transferredTracks.push({
          spotifyTrack: {
            name: track.name,
            artists: track.artists,
            position: track.position,
          },

          normalized,

          youtube: {
            videoId: selectedVideo.videoId,
            title: selectedVideo.title,
            channelTitle: selectedVideo.channelTitle,
          },
        });

        console.log(
          `Added track ${track.position} successfully`
        );
      } catch (error) {
        console.error(
          `TRACK TRANSFER ERROR FOR "${track.name}":`,
          error.message
        );

        failedTracks.push({
          spotifyTrack: {
            name: track.name,
            artists: track.artists,
            position: track.position,
          },

          reason: error.message,
        });
      }
    }

    // ==============================
    // RETURN SUCCESS RESPONSE
    // ==============================

    return res.status(201).json({
      success: true,

      message:
        "YouTube playlist created successfully",

      spotifyPlaylist: {
        id: playlist._id,
        name: playlist.name,
      },

      youtubePlaylist: {
        id: youtubePlaylist.playlistId,
        name: youtubePlaylist.title,
        description: youtubePlaylist.description,
        url: youtubePlaylist.url,
      },

      totalTracks: tracks.length,

      successfullyTransferred:
        transferredTracks.length,

      failed: failedTracks.length,

      transferredTracks,

      failedTracks,
    });
  } catch (error) {
    console.error(
      "CREATE YOUTUBE PLAYLIST ERROR:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to create YouTube playlist.",

      error:
        error.response?.data || error.message,
    });
  }
}