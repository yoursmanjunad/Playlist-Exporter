import dotenv from "dotenv";
dotenv.config();

if(!process.env.JWT_SECRET){
    throw new Error("JWT_SECRET is not defined in environment variables");
}

if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.warn("RESEND_API_KEY and RESEND_FROM_EMAIL are required for email authentication flows");
}

if (!/^cloudinary:\/\/[^:]+:[^@]+@[^/]+$/.test(process.env.CLOUDINARY_URI || "")) {
    console.warn("CLOUDINARY_URI must use cloudinary://<api_key>:<api_secret>@<cloud_name> for profile image uploads");
}

if (!process.env.REDIS_URL) {
    console.warn("REDIS_URL is not configured; playlist reads will use MongoDB");
}

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required for Stripe billing");
}
