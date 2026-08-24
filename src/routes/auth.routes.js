import { Router } from "express";
import * as authController from "../controllers/auth.controllers.js";
import { authenticate } from "../middleware/auth.middleware.js";

const authRouter = Router();

// POST /api/auth/register
authRouter.post("/register", authController.register);

// POST /api/auth/login
authRouter.post("/login", authController.login);

// GET /api/auth/get-me (Protected route)
authRouter.get("/get-me", authenticate, authController.getMe);

// GET /api/auth/refresh-token
authRouter.get("/refresh-token", authController.refreshToken);

export default authRouter;