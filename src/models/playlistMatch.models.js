import mongoose from "mongoose";

const playlistMatchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Playlist",
      required: true,
      index: true,
    },

    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Track",
      required: true,
    },

    normalized: {
      title: {
        type: String,
      },

      artists: {
        type: [String],
        default: [],
      },
    },

    searchQuery: {
      type: String,
    },

    bestMatch: {
      videoId: {
        type: String,
      },

      title: {
        type: String,
      },

      channelTitle: {
        type: String,
      },

      url: {
        type: String,
      },

      score: {
        type: Number,
      },

      breakdown: {
        type: mongoose.Schema.Types.Mixed,
      },
    },

    alternatives: [
      {
        videoId: String,

        title: String,

        channelTitle: String,

        url: String,

        score: Number,

        breakdown: mongoose.Schema.Types.Mixed,
      },
    ],

    status: {
      type: String,
      enum: [
        "matched",
        "no_match",
        "error",
      ],
      default: "matched",
    },

    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

playlistMatchSchema.index(
  {
    userId: 1,
    playlistId: 1,
    trackId: 1,
  },
  {
    unique: true,
  }
);

const playlistMatchModel = mongoose.model(
  "PlaylistMatch",
  playlistMatchSchema
);

export default playlistMatchModel;