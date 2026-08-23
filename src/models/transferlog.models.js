import mongoose from "mongoose";
import Schema from "mongoose"
/**
 * TRANSFER LOG
 * One doc per track per job — the audit trail the user sees, and
 * specifically what powers "these songs were not found on YouTube".
 */
const TransferLogSchema = new Schema(
  {
    transferJobId: {
      type: Schema.Types.ObjectId,
      ref: 'TransferJob',
      required: true,
      index: true,
    },
    trackId: {
      type: Schema.Types.ObjectId,
      ref: 'Track',
      required: true,
    },

    // Snapshot of source track info so the log reads fine even if Track is later deleted
    sourceTitle: { type: String, required: true },
    sourceArtists: [{ type: String }],
    sourceAlbumArtUrl: { type: String },

    status: {
      type: String,
      enum: ['matched', 'not_found', 'skipped', 'error'],
      required: true,
      index: true,
    },

    // Populated when status === 'matched'
    matchedYoutubeVideoId: { type: String },
    matchedTitle: { type: String },
    matchedChannelTitle: { type: String },
    matchConfidence: { type: Number, min: 0, max: 1 }, // similarity score from the matching algorithm

    errorMessage: { type: String }, // e.g. YouTube quota exceeded / insert failed

    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TransferLogSchema.index({ transferJobId: 1, status: 1 });

const transferLog = mongoose.model("transferlog", transferLog);
export default transferLog;