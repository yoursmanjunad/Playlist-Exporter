import mongoose from "mongoose";

import connectedAccount from "../models/connectedAccount.models.js";
import playlistModel from "../models/playlist.models.js";
import playlistMatchModel from "../models/playlistMatch.models.js";

import { decrypt } from "../utils/encryption.js";

import {
  createYouTubePlaylist,
} from "../services/youtube/createPlaylist.js";

import {
  addVideoToYouTubePlaylist,
} from "../services/youtube/addVideoToPlaylist.js";

export async function createYouTubePlaylistFromSpotify(
  req,
  res
) {
  try {
    console.log(
      "CREATE YOUTUBE PLAYLIST CONTROLLER IS RUNNING"
    );

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
        message: "Spotify playlist not found",
      });
    }

    const matches = await playlistMatchModel
      .find({
        userId,
        playlistId: playlist._id,
        status: "matched",
        "bestMatch.videoId": {
          $exists: true,
          $ne: null,
        },
      })
      .populate(
        "trackId",
        "name artists position"
      );

    if (!matches.length) {
      return res.status(400).json({
        success: false,
        message:
          "No matches found. Generate matches before transferring the playlist.",
      });
    }

    const sortedMatches = matches.sort((a, b) => {
      return (
        (a.trackId?.position ?? 0) -
        (b.trackId?.position ?? 0)
      );
    });

    console.log(
      `Found ${sortedMatches.length} saved matches`
    );

    const youtubeAccount = await connectedAccount
      .findOne({
        userId,
        provider: "youtube",
        status: "connected",
      })
      .select("+accessToken +refreshToken");

    if (
      !youtubeAccount ||
      !youtubeAccount.accessToken
    ) {
      return res.status(401).json({
        success: false,
        message:
          "YouTube account is not connected",
      });
    }

    const youtubeAccessToken = decrypt(
      youtubeAccount.accessToken
    );

    const youtubeRefreshToken =
      youtubeAccount.refreshToken
        ? decrypt(youtubeAccount.refreshToken)
        : undefined;

    const youtubePlaylist =
      await createYouTubePlaylist({
        accessToken: youtubeAccessToken,
        refreshToken: youtubeRefreshToken,
        name: playlist.name,
        description:
          playlist.description ||
          "Transferred from Spotify",
      });

    console.log(
      "YouTube playlist created:",
      youtubePlaylist.playlistId
    );

    const transferredTracks = [];
    const failedTracks = [];

    for (const match of sortedMatches) {
      try {
        const videoId =
          match.bestMatch.videoId;

        await addVideoToYouTubePlaylist({
          accessToken: youtubeAccessToken,
          refreshToken: youtubeRefreshToken,
          playlistId:
            youtubePlaylist.playlistId,
          videoId,
        });

        transferredTracks.push({
          track: {
            id: match.trackId._id,
            name: match.trackId.name,
            artists: match.trackId.artists,
            position: match.trackId.position,
          },

          youtube: {
            videoId:
              match.bestMatch.videoId,

            title:
              match.bestMatch.title,

            channelTitle:
              match.bestMatch.channelTitle,

            url:
              match.bestMatch.url,
          },

          match: {
            score:
              match.bestMatch.score,

            breakdown:
              match.bestMatch.breakdown,
          },
        });

        console.log(
          `Transferred: ${match.trackId.name}`
        );
      } catch (error) {
        console.error(
          "VIDEO TRANSFER ERROR:",
          error.message
        );

        failedTracks.push({
          track: {
            id: match.trackId?._id,
            name: match.trackId?.name,
            artists: match.trackId?.artists,
            position: match.trackId?.position,
          },

          youtube:
            match.bestMatch,

          reason:
            error.response?.data ||
            error.message,
        });
      }
    }

    return res.status(201).json({
      success: true,

      message:
        "YouTube playlist created successfully",

      spotifyPlaylist: {
        id: playlist._id,
        name: playlist.name,
      },

      youtubePlaylist: {
        id:
          youtubePlaylist.playlistId,

        name:
          youtubePlaylist.title,

        description:
          youtubePlaylist.description,

        url:
          youtubePlaylist.url,
      },

      totalMatches:
        sortedMatches.length,

      successfullyTransferred:
        transferredTracks.length,

      failed:
        failedTracks.length,

      transferredTracks,

      failedTracks,
    });
  } catch (error) {
    console.error(
      "CREATE YOUTUBE PLAYLIST ERROR:",
      error.response?.data ||
      error.message
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to create YouTube playlist",

      error:
        error.response?.data ||
        error.message,
    });
  }
}