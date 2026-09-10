import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import connectDb from "./database/db.js";
import authRouter from "./routes/auth.routes.js";
import oauthRouter from "./routes/oauth.routes.js";
import cookieParser from "cookie-parser";
import playlistRouter from "./routes/playlist.routes.js";
import syncRouter from "./routes/sync.routes.js";
import billingRouter from "./routes/billing.routes.js";
import { authenticate } from "./middleware/auth.middleware.js";
import { testYouTubeSearch } from "./services/youtube/youtube.client.js";
import { rateLimit } from "./middleware/rate-limit.middleware.js";

dotenv.config({ path: ".env" });

const port = process.env.PORT || 5000;

const frontendOrigin = new URL(
    process.env.FRONTEND_URL || "http://localhost:3000"
).origin;

const app = express();
app.set("trust proxy", process.env.TRUST_PROXY === "true");

app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(cors({
    origin: frontendOrigin,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));
app.use("/api", rateLimit({
    name: "api-ip",
    key: "ip",
    limit: 120,
    windowSeconds: 60
}));

app.use("/api/auth", authRouter);
app.use("/api/oauth", oauthRouter);
app.use("/api/playlist", playlistRouter);
app.use("/api/sync/", syncRouter);
app.use("/api/billing", billingRouter);
app.get("/api/test-search", authenticate, testYouTubeSearch)
await connectDb();
app.listen(port, () => {
    console.log(`This app is running on port ${port}`);
});