import mongoose from "mongoose";

import playlistModel from "../models/playlist.models.js";
import trackModel from "../models/track.models.js";
import playlistMatchModel from "../models/playlistMatch.models.js";

import { normalizeTrack } from "../services/matching/normalization.js";
import { searchYouTube } from "../services/youtube/searchYouTube.js";
import { findBestMatch } from "../services/matching/findBestMatch.js";

export async function generatePlaylistMatches(req, res) {
  try {
    console.log("GENERATE PLAYLIST MATCHES CONTROLLER IS RUNNING");

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

    console.log("Playlist found:", playlist.name);

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
        success: false,
        message: "No tracks found for this playlist",
      });
    }

    console.log(`Found ${tracks.length} tracks`);

    await playlistMatchModel.deleteMany({
      userId,
      playlistId: playlist._id,
    });

    console.log("Previous matches deleted");

    const results = [];

    for (const track of tracks) {
      try {
        const normalized = normalizeTrack(track);

        const searchQuery = [
          normalized.title,
          ...(normalized.artists || []),
        ]
          .filter(Boolean)
          .join(" ");

        console.log(
          `Searching YouTube for: ${searchQuery}`
        );

        const youtubeResults = await searchYouTube(
          searchQuery
        );

        if (!youtubeResults || youtubeResults.length === 0) {
          const match = await playlistMatchModel.create({
            userId,
            playlistId: playlist._id,
            trackId: track._id,

            normalized,
            searchQuery,

            alternatives: [],

            status: "no_match",

            error: "No YouTube results found",
          });

          results.push({
            track: {
              id: track._id,
              name: track.name,
              artists: track.artists,
              position: track.position,
            },

            normalized,

            searchQuery,

            bestMatch: null,

            alternatives: [],

            status: match.status,

            error: match.error,
          });

          continue;
        }

        const {
          bestMatch,
          allMatches,
        } = findBestMatch(
          normalized,
          youtubeResults
        );

        if (!bestMatch) {
          const match = await playlistMatchModel.create({
            userId,
            playlistId: playlist._id,
            trackId: track._id,

            normalized,
            searchQuery,

            alternatives: [],

            status: "no_match",

            error: "No suitable YouTube match found",
          });

          results.push({
            track: {
              id: track._id,
              name: track.name,
              artists: track.artists,
              position: track.position,
            },

            normalized,

            searchQuery,

            bestMatch: null,

            alternatives: [],

            status: match.status,

            error: match.error,
          });

          continue;
        }

        const alternatives = allMatches
          .filter(
            (match) =>
              match.videoId !== bestMatch.videoId
          )
          .slice(0, 4)
          .map((match) => ({
            videoId: match.videoId,
            title: match.title,
            channelTitle: match.channelTitle,
            url: match.url,
            score: match.score,
            breakdown: match.breakdown,
          }));

        const savedMatch = await playlistMatchModel.create({
          userId,
          playlistId: playlist._id,
          trackId: track._id,

          normalized,

          searchQuery,

          bestMatch: {
            videoId: bestMatch.videoId,
            title: bestMatch.title,
            channelTitle: bestMatch.channelTitle,
            url: bestMatch.url,
            score: bestMatch.score,
            breakdown: bestMatch.breakdown,
          },

          alternatives,

          status: "matched",

          error: null,
        });

        console.log("Best match saved:", {
          track: track.name,
          title: bestMatch.title,
          score: bestMatch.score,
        });

        results.push({
          matchId: savedMatch._id,

          track: {
            id: track._id,
            name: track.name,
            artists: track.artists,
            position: track.position,
          },

          normalized,

          searchQuery,

          bestMatch: {
            videoId: bestMatch.videoId,
            title: bestMatch.title,
            channelTitle: bestMatch.channelTitle,
            url: bestMatch.url,
            score: bestMatch.score,
            breakdown: bestMatch.breakdown,
          },

          alternatives,

          status: "matched",

          error: null,
        });
      } catch (error) {
        console.error(
          `MATCH ERROR FOR "${track.name}":`,
          error.message
        );

        const savedMatch = await playlistMatchModel.create({
          userId,
          playlistId: playlist._id,
          trackId: track._id,

          alternatives: [],

          status: "error",

          error: error.message,
        });

        results.push({
          matchId: savedMatch._id,

          track: {
            id: track._id,
            name: track.name,
            artists: track.artists,
            position: track.position,
          },

          bestMatch: null,

          alternatives: [],

          status: "error",

          error: error.message,
        });
      }
    }

    const summary = {
      total: results.length,

      matched: results.filter(
        (result) =>
          result.status === "matched"
      ).length,

      noMatch: results.filter(
        (result) =>
          result.status === "no_match"
      ).length,

      errors: results.filter(
        (result) =>
          result.status === "error"
      ).length,
    };

    return res.status(200).json({
      success: true,

      message:
        "Playlist matches generated and saved successfully",

      playlist: {
        id: playlist._id,
        name: playlist.name,
        totalTracks: tracks.length,
      },

      summary,

      results,
    });
  } catch (error) {
    console.error(
      "GENERATE PLAYLIST MATCHES ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to generate playlist matches",

      error: error.message,
    });
  }
}