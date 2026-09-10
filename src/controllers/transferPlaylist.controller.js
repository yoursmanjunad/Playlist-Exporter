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
import {
  getUsageSummary,
  releaseTrackCredits,
  reconcileTransferCredits,
  reserveTrackCredits,
} from "../services/billing/usage.service.js";

export async function createYouTubePlaylistFromSpotify(
  req,
  res
) {
  let reservedTrackCount = 0;
  const userId = req.user._id?.toString();

  try {
    console.log(
      "CREATE YOUTUBE PLAYLIST CONTROLLER IS RUNNING"
    );

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

    let creditReservation = await reserveTrackCredits(
      userId,
      sortedMatches.length
    );

    if (!creditReservation.allowed && creditReservation.usage?.tracksRemaining > 0) {
      creditReservation = await reserveTrackCredits(
        userId,
        creditReservation.usage.tracksRemaining
      );
    }

    if (!creditReservation.allowed) {
      return res.status(429).json({
        success: false,
        code: "TRACK_CREDIT_LIMIT_REACHED",
        message: "Your monthly track export limit has been reached.",
        usage: creditReservation.usage,
      });
    }

    reservedTrackCount = creditReservation.reserved || 0;
    const matchesToTransfer = creditReservation.reserved
      ? sortedMatches.slice(0, creditReservation.reserved)
      : sortedMatches;

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

    for (const match of matchesToTransfer) {
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

    await playlistModel.findOneAndUpdate(
      {
        userId,
        provider: "youtube",
        providerPlaylistId: youtubePlaylist.playlistId,
      },
      {
        userId,
        provider: "youtube",
        providerPlaylistId: youtubePlaylist.playlistId,
        name: youtubePlaylist.title || playlist.name,
        description: youtubePlaylist.description || playlist.description,
        createdFromPlaylistId: playlist._id,
        trackCount: transferredTracks.length,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await reconcileTransferCredits(
      userId,
      reservedTrackCount,
      transferredTracks.length
    );

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

      tracksAttempted:
        matchesToTransfer.length,

      successfullyTransferred:
        transferredTracks.length,

      failed:
        failedTracks.length,

      transferredTracks,

      failedTracks,

      usage: getUsageSummary({
        ...req.user.toObject(),
        usage: {
          ...(req.user.usage?.toObject?.() || req.user.usage || {}),
          tracksExportedThisMonth:
            (req.user.usage?.tracksExportedThisMonth || 0)
            - reservedTrackCount
            + transferredTracks.length,
          transfersThisMonth:
            (req.user.usage?.transfersThisMonth || 0) + 1,
        },
      }),
    });
  } catch (error) {
    await releaseTrackCredits(userId, reservedTrackCount);
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