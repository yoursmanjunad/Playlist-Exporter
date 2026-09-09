import { Router } from "express";
import * as authController from "../controllers/auth.controllers.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { uploadAvatar } from "../middleware/upload.middleware.js";

const authRouter = Router();

// POST /api/auth/register
authRouter.post("/register", authController.register);

// POST /api/auth/login
authRouter.post("/login", authController.login);

// GET /api/auth/get-me (Protected route)
authRouter.get("/get-me", authenticate, authController.getMe);

// PATCH /api/auth/profile (Protected)
authRouter.patch("/profile", authenticate, authController.updateProfile);

// PUT /api/auth/profile/photo (Protected, multipart/form-data)
authRouter.put("/profile/photo", authenticate, uploadAvatar, authController.uploadProfilePhoto);

// GET /api/auth/refresh-token
authRouter.get("/refresh-token", authController.refreshToken);

// POST /api/auth/logout
authRouter.post("/logout", authController.logout);

export default authRouter;