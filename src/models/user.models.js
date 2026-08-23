import mongoose from "mongoose";
import { Schema } from "mongoose";

/**
 * USER
 * Core account. Auth can be email/password and/or "sign in with Google" etc.
 * Spotify/YouTube are NOT login providers here — they're connected separately
 * in ConnectedAccount, since a user can link/unlink them independently of login.
 */
const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: [true, "Already registered"],
      lowercase: [true, "Must be in lowercase"],
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String, // null if user signed up via OAuth-only login
      select: false,
    },
    name: { type: String, trim: true },
    avatarUrl: { type: String },

    authProvider: {
      type: String,
    },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Denormalized snapshot for fast access-control checks (source of truth is Subscription collection)
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'premium'],
        default: 'free',
      },
      status: {
        type: String,
        enum: ['none', 'active', 'trialing', 'past_due', 'canceled'],
        default: 'none',
      },
      currentPeriodEnd: { type: Date },
    },

    // Usage counters for free-tier limits (e.g. "3 playlist transfers/month")
    usage: {
      transfersThisMonth: { type: Number, default: 0 },
      usageResetAt: { type: Date, default: Date.now },
    },

    lastLoginAt: { type: Date },
    isActive: { type: Boolean, default: true }, // soft-disable / ban flag
  },
  { timestamps: true }
);

UserSchema.index({ 'subscription.plan': 1 });

const userModel = mongoose.model("users", UserSchema);
export default userModel;