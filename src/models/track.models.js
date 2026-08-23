import mongoose from "mongoose";
import Schema from "mongoose"
/**
 * TRACK
 * A single song belonging to an imported Playlist. Kept as its own
 * collection (rather than embedded array) since playlists can have
 * hundreds/thousands of tracks and users select a subset to transfer.
 */
const TrackSchema = new Schema(
  {
    playlistId: {
      type: Schema.Types.ObjectId,
      ref: 'Playlist',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    provider: { type: String, enum: ['spotify'], default: 'spotify' },
    providerTrackId: { type: String, required: true }, // Spotify track id

    title: { type: String, required: true },
    artists: [{ type: String, required: true }],
    album: { type: String },
    albumArtUrl: { type: String },
    durationMs: { type: Number },
    isrc: { type: String }, // International Standard Recording Code — best signal for matching

    position: { type: Number, required: true }, // order within the playlist

    selectedForTransfer: { type: Boolean, default: true }, // user can deselect individual songs
  },
  { timestamps: true }
);

TrackSchema.index({ playlistId: 1, position: 1 });
TrackSchema.index({ playlistId: 1, providerTrackId: 1 }, { unique: true });
const trackModel = mongoose.model("tracks", trackModel );
export default trackModel;