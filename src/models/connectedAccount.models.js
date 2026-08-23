import mongoose from "mongoose";
import Schema from "mongoose"

/**
 * CONNECTED ACCOUNT
 * One doc per (user, provider). Holds OAuth tokens needed to call
 * Spotify Web API / YouTube Data API on the user's behalf.
 *
 * IMPORTANT: accessToken/refreshToken must be encrypted at rest
 * (e.g. AES-256-GCM via a field-level encryption lib, or KMS-backed
 * envelope encryption) — never store them in plaintext. Fields below
 * are marked select:false so they're never returned by default queries.
 */
const ConnectedAccountSchema = new Schema(
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

    providerAccountId: { type: String, required: true }, // spotify user id / google account id
    providerEmail: { type: String },
    providerDisplayName: { type: String },
    providerAvatarUrl: { type: String },

    accessToken: { type: String, required: true, select: false }, // encrypted
    refreshToken: { type: String, select: false }, // encrypted; YouTube always returns one on first consent
    tokenExpiresAt: { type: Date, required: true },
    scope: [{ type: String }], // e.g. ['playlist-read-private'] or ['https://www.googleapis.com/auth/youtube']

    status: {
      type: String,
      enum: ['connected', 'expired', 'revoked', 'error'],
      default: 'connected',
    },
    lastError: { type: String },

    connectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

// A user can only connect each provider once
ConnectedAccountSchema.index({ userId: 1, provider: 1 }, { unique: true });
const connectedAccount = mongoose.model("accounts", ConnectedAccountSchema);
export default connectedAccount;