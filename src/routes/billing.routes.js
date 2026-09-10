import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
    createCheckoutSession,
    createPortalSession,
    getBillingStatus,
    handleStripeWebhook
} from "../controllers/billing.controllers.js";

const billingRouter = Router();

billingRouter.get("/status", authenticate, getBillingStatus);
billingRouter.post("/checkout-session", authenticate, createCheckoutSession);
billingRouter.post("/portal-session", authenticate, createPortalSession);
billingRouter.post("/webhook", handleStripeWebhook);

export default billingRouter;