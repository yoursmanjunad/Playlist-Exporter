import mongoose, { Schema } from "mongoose";

/**
 * PLAYLIST
 * A cached copy of a playlist pulled from the source platform (Spotify),
 * OR a record of a playlist created on the destination platform (YouTube)
 * as the result of a transfer. `provider` + `providerPlaylistId` tell you which.
 */
const PlaylistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['spotify', 'youtube'],
      required: true,
    },
    providerPlaylistId: { type: String, required: true },

    name: { type: String, required: true },
    description: { type: String },
    coverImageUrl: { type: String }, // Spotify playlist cover / YT thumbnail
    ownerDisplayName: { type: String },
    isPublic: { type: Boolean, default: false },

    trackCount: { type: Number, default: 0 },

    // For imported (source) playlists only:
    selectedForTransfer: { type: Boolean, default: false },

    // For created (destination) playlists only:
    createdFromPlaylistId: { type: Schema.Types.ObjectId, ref: 'Playlist' },

    importedAt: { type: Date },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

PlaylistSchema.index({ userId: 1, provider: 1, providerPlaylistId: 1 }, { unique: true });

const playlistModel = mongoose.model("Playlist", PlaylistSchema);
export default playlistModel;