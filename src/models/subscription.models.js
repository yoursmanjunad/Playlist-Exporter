import mongoose from "mongoose";
import { Schema } from "mongoose";
/**
 * SUBSCRIPTION
 * Source of truth for billing state; User.subscription is a denormalized
 * snapshot kept in sync via webhook handlers for fast reads elsewhere.
 */
const SubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    provider: { type: String, enum: ['stripe'], default: 'stripe' },
    stripeCustomerId: { type: String, required: true },
    stripeSubscriptionId: { type: String },
    stripePriceId: { type: String }, // identifies monthly vs yearly plan

    plan: {
      type: String,
      enum: ['free', 'premium_monthly', 'premium_yearly'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'],
      default: 'none',
      index: true,
    },

    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: { type: Date },

    lastInvoiceId: { type: String },
    lastPaymentStatus: { type: String },
  },
  { timestamps: true }
);

const subscriptionModel = mongoose.model("subscriptions", SubscriptionSchema);
export default subscriptionModel;