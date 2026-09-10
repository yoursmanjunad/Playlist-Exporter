import Stripe from "stripe";

let stripeClient;

export function getStripeClient() {
    if (!process.env.STRIPE_SECRET_KEY) {
        return null;
    }

    stripeClient ||= new Stripe(process.env.STRIPE_SECRET_KEY);
    return stripeClient;
}

export function getStripePriceId(plan) {
    const priceId = plan === "premium_yearly"
        ? process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID
        : process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID;

    return priceId || null;
}

export function getPlanFromPriceId(priceId) {
    if (priceId === process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID) return "premium_yearly";
    if (priceId === process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID) return "premium_monthly";
    return "free";
}

export function getFrontendUrl(path) {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return new URL(path, baseUrl).toString();
}