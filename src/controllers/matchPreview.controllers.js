import mongoose from "mongoose";

import playlistModel from "../models/playlist.models.js";
import trackModel from "../models/track.models.js";

import {
  normalizeTrack,
} from "../services/matching/normalization.js";

import {
  searchYouTube,
} from "../services/youtube/searchYouTube.js";

import {
  findBestMatch,
} from "../services/matching/findBestMatch.js";


export async function previewPlaylistMatches(
  req,
  res
) {
  try {

    console.log(
      "MATCH PREVIEW CONTROLLER IS RUNNING"
    );


    const userId = req.user._id;

    const { playlistId } =
      req.params;


    // ==============================
    // VALIDATE PLAYLIST ID
    // ==============================

    if (!playlistId) {
      return res.status(400).json({
        success: false,

        message:
          "Playlist ID is required",
      });
    }


    // ==============================
    // FIND PLAYLIST
    // ==============================

    const query = {
      userId,

      provider: "spotify",
    };


    if (
      mongoose.Types.ObjectId.isValid(
        playlistId
      )
    ) {
      query.$or = [
        {
          _id: playlistId,
        },

        {
          providerPlaylistId:
            playlistId,
        },
      ];
    } else {
      query.providerPlaylistId =
        playlistId;
    }


    const playlist =
      await playlistModel.findOne(
        query
      );


    if (!playlist) {
      return res.status(404).json({
        success: false,

        message:
          "Playlist not found",
      });
    }


    console.log(
      "Playlist found:",
      playlist.name
    );


    // ==============================
    // GET TRACKS
    // ==============================

    const tracks =
      await trackModel
        .find({
          playlistId:
            playlist._id,

          userId,
        })
        .sort({
          position: 1,
        })
        .lean();


    if (!tracks.length) {
      return res.status(404).json({
        success: false,

        message:
          "No tracks found",
      });
    }


    console.log(
      `Found ${tracks.length} tracks`
    );


    const previewResults = [];


    // ==============================
    // PROCESS EACH TRACK
    // ==============================

    for (const track of tracks) {

      try {

        // ==========================
        // NORMALIZE TRACK
        // ==========================

        const normalized =
          normalizeTrack(track);


        // ==========================
        // CREATE SEARCH QUERY
        // ==========================

        const searchQuery = [
          normalized.title,

          ...(normalized.artists || []),
        ]
          .filter(Boolean)
          .join(" ");


        console.log(
          `\nSearching: ${searchQuery}`
        );


        // ==========================
        // SEARCH YOUTUBE
        // ==========================

        const youtubeResults =
          await searchYouTube(
            searchQuery
          );


        // ==========================
        // FIND BEST MATCH
        // ==========================

        const {
          bestMatch,
          allMatches,
        } = findBestMatch(
          normalized,
          youtubeResults
        );


        console.log(
          "Best Match:",
          bestMatch
            ? `${bestMatch.title} (${bestMatch.score})`
            : "NO MATCH"
        );


        // ==========================
        // ADD TO PREVIEW RESULTS
        // ==========================

        previewResults.push({

          track: {
            id:
              track._id,

            name:
              track.name,

            artists:
              track.artists,

            position:
              track.position,
          },


          normalized,


          searchQuery,


          bestMatch,


          alternatives:
            allMatches.slice(1, 5),

        });

      } catch (error) {

        console.error(
          `ERROR MATCHING TRACK "${track.name}":`,
          error.message
        );


        previewResults.push({

          track: {
            id:
              track._id,

            name:
              track.name,

            artists:
              track.artists,

            position:
              track.position,
          },


          error:
            error.message,


          bestMatch:
            null,


          alternatives:
            [],
        });

      }

    }


    // ==============================
    // RETURN PREVIEW
    // ==============================

    return res.status(200).json({

      success: true,


      message:
        "Playlist match preview generated successfully",


      playlist: {

        id:
          playlist._id,

        name:
          playlist.name,

        totalTracks:
          tracks.length,
      },


      results:
        previewResults,

    });


  } catch (error) {

    console.error(
      "MATCH PREVIEW ERROR:",
      error.message
    );


    return res.status(500).json({

      success: false,

      message:
        "Failed to generate match preview",

      error:
        error.message,
    });

  }
}