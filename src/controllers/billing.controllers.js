import mongoose from "mongoose";
import userModel from "../models/user.models.js";
import subscriptionModel from "../models/subscription.models.js";
import {
    getFrontendUrl,
    getPlanFromPriceId,
    getStripeClient,
    getStripePriceId
} from "../services/billing/stripe.service.js";
import { getUsageSummary } from "../services/billing/usage.service.js";

function requireStripe(res) {
    const stripe = getStripeClient();
    if (!stripe) {
        res.status(503).json({ message: "Stripe billing is not configured" });
        return null;
    }
    return stripe;
}

function getUserSubscriptionStatus(status) {
    return ["trialing", "active", "past_due", "canceled"].includes(status)
        ? status
        : "none";
}
function serializeSubscription(subscription) {
    if (!subscription) {
        return {
            plan: "free",
            status: "none",
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false
        };
    }

    return {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd || null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false
    };
}

export async function getBillingStatus(req, res) {
    try {
        const subscription = await subscriptionModel.findOne({ userId: req.user._id }).lean();
        return res.status(200).json({
            subscription: serializeSubscription(subscription),
            usage: getUsageSummary(req.user)
        });
    } catch (error) {
        console.error("Get billing status error:", error);
        return res.status(500).json({ message: "Failed to get billing status" });
    }
}

export async function createCheckoutSession(req, res) {
    try {
        const stripe = requireStripe(res);
        if (!stripe) return;

        const { plan = "premium_monthly" } = req.body || {};
        if (!["premium_monthly", "premium_yearly"].includes(plan)) {
            return res.status(400).json({ message: "Plan must be premium_monthly or premium_yearly" });
        }

        const priceId = getStripePriceId(plan);
        if (!priceId) {
            return res.status(400).json({ message: "Requested Stripe price is not configured" });
        }

        const user = await userModel.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        let subscription = await subscriptionModel.findOne({ userId: user._id });
        if (subscription?.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(subscription.status)) {
            return res.status(409).json({
                message: "User already has a Stripe subscription",
                subscription: serializeSubscription(subscription)
            });
        }

        let customerId = subscription?.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                metadata: { userId: user._id.toString() }
            });
            customerId = customer.id;
            subscription = await subscriptionModel.findOneAndUpdate(
                { userId: user._id },
                { userId: user._id, provider: "stripe", stripeCustomerId: customerId },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: getFrontendUrl("/billing/success?session_id={CHECKOUT_SESSION_ID}"),
            cancel_url: getFrontendUrl("/billing/cancel"),
            client_reference_id: user._id.toString(),
            metadata: { userId: user._id.toString(), plan },
            subscription_data: {
                metadata: { userId: user._id.toString(), plan }
            }
        });

        return res.status(201).json({ sessionId: session.id, checkoutUrl: session.url });
    } catch (error) {
        console.error("Create checkout session error:", error);
        return res.status(502).json({ message: "Unable to create Stripe checkout session" });
    }
}

export async function createPortalSession(req, res) {
    try {
        const stripe = requireStripe(res);
        if (!stripe) return;

        const subscription = await subscriptionModel.findOne({ userId: req.user._id });
        if (!subscription?.stripeCustomerId) {
            return res.status(404).json({ message: "No Stripe customer exists for this user" });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: getFrontendUrl("/account/billing")
        });

        return res.status(200).json({ portalUrl: session.url });
    } catch (error) {
        console.error("Create billing portal session error:", error);
        return res.status(502).json({ message: "Unable to create Stripe billing portal session" });
    }
}

export async function handleStripeWebhook(req, res) {
    const stripe = getStripeClient();
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(503).json({ message: "Stripe webhook is not configured" });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            req.headers["stripe-signature"],
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        console.error("Stripe webhook signature error:", error.message);
        return res.status(400).json({ message: "Invalid Stripe webhook signature" });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed":
                await syncCheckoutSession(event.data.object);
                break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
                await syncStripeSubscription(event.data.object);
                break;
            case "invoice.payment_failed":
                await markPaymentFailed(event.data.object);
                break;
            default:
                break;
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error("Stripe webhook processing error:", error);
        return res.status(500).json({ message: "Stripe webhook processing failed" });
    }
}

async function syncCheckoutSession(session) {
    const userId = session.client_reference_id || session.metadata?.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;

    await subscriptionModel.findOneAndUpdate(
        { userId },
        { userId, provider: "stripe", stripeCustomerId: session.customer },
        { upsert: true, setDefaultsOnInsert: true }
    );
}

async function syncStripeSubscription(subscription) {
    const userId = subscription.metadata?.userId;
    const existing = await subscriptionModel.findOne({
        $or: [
            { stripeSubscriptionId: subscription.id },
            { stripeCustomerId: subscription.customer }
        ]
    });
    const resolvedUserId = userId || existing?.userId;
    if (!resolvedUserId) return;

    const stripePriceId = subscription.items?.data?.[0]?.price?.id;
    const plan = subscription.status === "canceled" ? "free" : getPlanFromPriceId(stripePriceId);
    const status = subscription.status || "none";
        const userPlan = plan === "free" ? "free" : "premium";
        const userStatus = getUserSubscriptionStatus(status);

    await subscriptionModel.findOneAndUpdate(
        { userId: resolvedUserId },
        {
            userId: resolvedUserId,
            provider: "stripe",
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            stripePriceId,
            plan,
            status,
            currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000)
                : undefined,
            currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : undefined,
            cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
            canceledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : undefined
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await userModel.updateOne(
        { _id: resolvedUserId },
            { $set: { "subscription.plan": userPlan, "subscription.status": userStatus, "subscription.currentPeriodEnd": subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null } }
    );
}

async function markPaymentFailed(invoice) {
    const subscription = await subscriptionModel.findOneAndUpdate(
        { stripeCustomerId: invoice.customer },
        { status: "past_due", lastInvoiceId: invoice.id, lastPaymentStatus: "failed" },
        { new: true }
    );
    if (subscription) {
        await userModel.updateOne(
            { _id: subscription.userId },
            { $set: { "subscription.status": "past_due" } }
        );
    }
}