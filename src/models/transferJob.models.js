import mongoose from "mongoose";
import Schema from "mongoose"

/**
 * TRANSFER JOB
 * Represents one "ship this playlist" run: source playlist -> destination
 * platform. Processed asynchronously by a worker/queue (e.g. BullMQ) since
 * matching + inserting tracks one-by-one against YouTube's API is slow
 * and rate-limited.
 */
const TransferJobSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    sourcePlaylistId: {
      type: Schema.Types.ObjectId,
      ref: 'Playlist',
      required: true,
    },
    sourceProvider: { type: String, enum: ['spotify'], default: 'spotify' },

    destinationProvider: { type: String, enum: ['youtube'], default: 'youtube' },
    destinationPlaylistId: {
      type: Schema.Types.ObjectId,
      ref: 'Playlist', // populated once the YouTube playlist is created
    },
    destinationPlaylistTitle: { type: String }, // allow user to rename on create

    status: {
      type: String,
      enum: ['queued', 'matching', 'transferring', 'completed', 'partial', 'failed', 'canceled'],
      default: 'queued',
      index: true,
    },

    totalTracks: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    transferredCount: { type: Number, default: 0 },
    notFoundCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },

    errorMessage: { type: String }, // top-level failure reason (e.g. token revoked)

    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

TransferJobSchema.index({ userId: 1, createdAt: -1 });

const transferSchema = mongoose.model("transfer", transferSchema);
export default transferSchema