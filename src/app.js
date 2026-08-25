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

const result = dotenv.config({
    path: ".env",
    debug: true
});

console.log("dotenv result:", result);
console.log("Current directory:", process.cwd());
console.log("JWT_SECRET:", process.env.JWT_SECRET);

const port = process.env.PORT || 3000;

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

app.use("/api/auth", authRouter);
app.use("/api/oauth", oauthRouter);
app.use("/api/playlist", playlistRouter);
app.use("/api/sync/", syncRouter);
await connectDb();
app.listen(port, () => {
    console.log(`This app is running on port ${port}`);
});