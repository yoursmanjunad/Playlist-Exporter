import { Router } from "express";
import * as authController from "../controllers/auth.controllers.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { uploadAvatar } from "../middleware/upload.middleware.js";
import { rateLimit } from "../middleware/rate-limit.middleware.js";

const authRouter = Router();

// POST /api/auth/register
authRouter.post("/register", rateLimit({
	name: "auth-register",
	limit: 5,
	windowSeconds: 60 * 60,
	key: (req) => [
		"ip",
		`email:${String(req.body?.email || "unknown").trim().toLowerCase()}`
	],
	message: "Too many registration attempts. Please try again later."
}), authController.register);

// GET /api/auth/verify-email
authRouter.get("/verify-email", rateLimit({
	name: "auth-verify-email",
	limit: 10,
	windowSeconds: 15 * 60,
	message: "Too many email verification attempts. Please try again later."
}), authController.verifyEmail);

// POST /api/auth/forgot-password
authRouter.post("/forgot-password", rateLimit({
	name: "auth-forgot-password",
	limit: 3,
	windowSeconds: 60 * 60,
	key: (req) => [
		"ip",
		`email:${String(req.body?.email || "unknown").trim().toLowerCase()}`
	],
	message: "Too many password reset requests. Please try again later."
}), authController.requestPasswordReset);

// POST /api/auth/reset-password
authRouter.post("/reset-password", rateLimit({
	name: "auth-reset-password",
	limit: 5,
	windowSeconds: 60 * 60,
	message: "Too many password reset attempts. Please try again later."
}), authController.resetPassword);

// POST /api/auth/login
authRouter.post("/login", rateLimit({
	name: "auth-login",
	limit: 5,
	windowSeconds: 15 * 60,
	key: (req) => [
		"ip",
		`email:${String(req.body?.email || "unknown").trim().toLowerCase()}`
	],
	message: "Too many sign-in attempts. Please try again later."
}), authController.login);

// GET /api/auth/get-me (Protected route)
authRouter.get("/get-me", authenticate, authController.getMe);

// DELETE /api/auth/account (Protected, confirmation: { confirmation: "DELETE" })
authRouter.delete("/account", authenticate, authController.deleteAccount);

// PATCH /api/auth/profile (Protected)
authRouter.patch("/profile", authenticate, authController.updateProfile);

// PUT /api/auth/profile/photo (Protected, multipart/form-data)
authRouter.put("/profile/photo", authenticate, uploadAvatar, authController.uploadProfilePhoto);

// GET /api/auth/refresh-token
authRouter.get("/refresh-token", authController.refreshToken);

// POST /api/auth/logout
authRouter.post("/logout", authController.logout);

export default authRouter;