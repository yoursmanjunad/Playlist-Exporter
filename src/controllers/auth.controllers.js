import userModel from "../models/user.models.js";
import mongoose from "mongoose";
import playlistModel from "../models/playlist.models.js";
import trackModel from "../models/track.models.js";
import playlistMatchModel from "../models/playlistMatch.models.js";
import connectedAccount from "../models/connectedAccount.models.js";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import { sendPasswordChangedEmail, sendPasswordResetEmail, sendVerificationEmail } from "../services/email/resend.service.js";
import { getUsageSummary } from "../services/billing/usage.service.js";

const isProduction = process.env.NODE_ENV === "production";

function hasCloudinaryConfiguration() {
    return /^cloudinary:\/\/[^:]+:[^@]+@[^/]+$/.test(
        process.env.CLOUDINARY_URI || ""
    );
}

function configureCloudinary() {
    if (!hasCloudinaryConfiguration()) {
        return false;
    }

    const cloudinaryUrl = new URL(process.env.CLOUDINARY_URI);
    cloudinary.config({
        cloud_name: cloudinaryUrl.hostname,
        api_key: decodeURIComponent(cloudinaryUrl.username),
        api_secret: decodeURIComponent(cloudinaryUrl.password)
    });
    const config = cloudinary.config();
    return Boolean(config.cloud_name && config.api_key && config.api_secret);
}

function generateTokens(userId) {
    const accessToken = jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    return {
        accessToken,
        refreshToken
    };
}

function setAuthCookies(res, accessToken, refreshToken) {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 15 * 60 * 1000
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function getTransferredPlaylistCount(userId) {
    return playlistModel.countDocuments({
        userId,
        provider: "youtube"
    });
}

function serializeUser(user, transferredPlaylists) {
    return {
        id: user._id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl || null,
        subscription: user.subscription,
        isActive: user.isActive,
        transferredPlaylists,
        usage: getUsageSummary(user)
    };
}

export async function register(req, res) {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
            return res.status(503).json({ message: "Email authentication is not configured" });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const isAlreadyRegistered = await userModel.findOne({ email: normalizedEmail });

        if (isAlreadyRegistered) {
            return res.status(409).json({
                message: "User with this email already exists"
            });
        }

        const hashedPassword = hashPassword(password);
        const verificationToken = crypto.randomBytes(32).toString("hex");

        const user = await userModel.create({
            email: normalizedEmail,
            name,
            passwordHash: hashedPassword,
            emailVerificationToken: hashToken(verificationToken),
            emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        const { data, error } = await sendVerificationEmail({
            email: user.email,
            name: user.name,
            token: verificationToken
        });
        if (error) {
            await userModel.findByIdAndDelete(user._id);
            console.error("Registration verification email error:", error);
            return res.status(502).json({ message: "Unable to send verification email" });
        }

        return res.status(201).json({
            success: true,
            message: "User created successfully. Check your email to verify your account.",
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                isEmailVerified: false
            },
            emailId: data?.id
        });

    } catch (error) {
        console.error("Register error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

export async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = await userModel
            .findOne({ email })
            .select("+passwordHash");

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const hashedPassword = hashPassword(password);

        if (user.passwordHash !== hashedPassword) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Please verify your email before signing in"
            });
        }

        if (user.isActive === false) {
            return res.status(403).json({
                message: "User account has been deactivated"
            });
        }

        const { accessToken, refreshToken } =
            generateTokens(user._id);

        setAuthCookies(res, accessToken, refreshToken);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                id: user._id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

export async function verifyEmail(req, res) {
    try {
        const { token } = req.query;
        if (!token || typeof token !== "string") {
            return res.status(400).json({ message: "Verification token is required" });
        }

        const user = await userModel
            .findOne({
                emailVerificationToken: hashToken(token),
                emailVerificationExpires: { $gt: new Date() }
            })
            .select("+emailVerificationToken +emailVerificationExpires");

        if (!user) {
            return res.status(400).json({ message: "Verification token is invalid or expired" });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        const { accessToken, refreshToken } = generateTokens(user._id);
        setAuthCookies(res, accessToken, refreshToken);

        return res.status(200).json({
            message: "Email verified successfully",
            accessToken
        });
    } catch (error) {
        console.error("Verify email error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function requestPasswordReset(req, res) {
    const genericResponse = {
        message: "If an account exists for that email, a password reset link has been sent"
    };

    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: "A valid email is required" });
        }

        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(200).json(genericResponse);
        }

        if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
            return res.status(200).json(genericResponse);
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        user.passwordResetToken = hashToken(resetToken);
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();

        const { data, error } = await sendPasswordResetEmail({
            email: user.email,
            name: user.name,
            token: resetToken
        });
        if (error) {
            console.error("Password reset email error:", error);
        }

        return res.status(200).json({
            ...genericResponse,
            emailId: data?.id
        });
    } catch (error) {
        console.error("Request password reset error:", error);
        return res.status(200).json(genericResponse);
    }
}

export async function resetPassword(req, res) {
    try {
        const { token, newPassword } = req.body || {};
        if (!token || typeof token !== "string") {
            return res.status(400).json({ message: "Reset token is required" });
        }

        if (typeof newPassword !== "string" || newPassword.length < 8) {
            return res.status(400).json({ message: "New password must be at least 8 characters" });
        }

        const user = await userModel
            .findOne({
                passwordResetToken: hashToken(token),
                passwordResetExpires: { $gt: new Date() }
            })
            .select("+passwordHash +passwordResetToken +passwordResetExpires");

        if (!user) {
            return res.status(400).json({ message: "Reset token is invalid or expired" });
        }

        user.passwordHash = hashPassword(newPassword);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        const { accessToken, refreshToken } = generateTokens(user._id);
        setAuthCookies(res, accessToken, refreshToken);

        if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
            const { error: emailError } = await sendPasswordChangedEmail({
                email: user.email,
                name: user.name
            });
            if (emailError) {
                console.error("Password reset notification error:", emailError);
            }
        }

        return res.status(200).json({ message: "Password reset successfully", accessToken });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function getMe(req, res) {
    try {
        const transferredPlaylists = await getTransferredPlaylistCount(req.user._id);

        return res.status(200).json({
            message: "User fetched successfully",
            user: serializeUser(req.user, transferredPlaylists)
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function deleteAccount(req, res) {
    try {
        const { currentPassword, confirmation } = req.body || {};
        if (confirmation !== "DELETE") {
            return res.status(400).json({
                message: "Type DELETE to confirm account deletion"
            });
        }

        const user = await userModel.findById(req.user._id).select("+passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.passwordHash && user.passwordHash !== hashPassword(currentPassword || "")) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        const playlists = await playlistModel.find({ userId: user._id }).select("_id").lean();
        const playlistIds = playlists.map((playlist) => playlist._id);
        const transferJobs = await mongoose.connection
            .collection("transfer")
            .find({ userId: user._id }, { projection: { _id: 1 } })
            .toArray();
        const transferJobIds = transferJobs.map((job) => job._id);

        await Promise.all([
            trackModel.deleteMany({ userId: user._id }),
            playlistMatchModel.deleteMany({ userId: user._id }),
            playlistModel.deleteMany({ userId: user._id }),
            connectedAccount.deleteMany({ userId: user._id }),
            mongoose.connection.collection("transferlog").deleteMany({
                transferJobId: { $in: transferJobIds }
            }),
            mongoose.connection.collection("transfer").deleteMany({ userId: user._id }),
            mongoose.connection.collection("subscriptions").deleteMany({ userId: user._id }),
            userModel.deleteOne({ _id: user._id })
        ]);

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        return res.status(200).json({
            message: "Account and associated data deleted successfully",
            deletedPlaylists: playlistIds.length
        });
    } catch (error) {
        console.error("Delete account error:", error);
        return res.status(500).json({ message: "Failed to delete account" });
    }
}

export async function updateProfile(req, res) {
    try {
        const { name, email, currentPassword, newPassword } = req.body || {};
        const hasProfileUpdate = name !== undefined || email !== undefined;
        const hasPasswordUpdate = newPassword !== undefined;

        if (!hasProfileUpdate && !hasPasswordUpdate) {
            return res.status(400).json({
                message: "Provide a name, email, or new password"
            });
        }

        if (name !== undefined && (typeof name !== "string" || !name.trim())) {
            return res.status(400).json({ message: "Name must be a non-empty string" });
        }

        const normalizedEmail = email === undefined ? undefined : String(email).trim().toLowerCase();
        if (normalizedEmail !== undefined && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
            return res.status(400).json({ message: "A valid email is required" });
        }

        if (hasPasswordUpdate) {
            if (typeof newPassword !== "string" || newPassword.length < 8) {
                return res.status(400).json({ message: "New password must be at least 8 characters" });
            }

            if (typeof currentPassword !== "string" || !currentPassword) {
                return res.status(400).json({ message: "Current password is required to change password" });
            }
        }

        const user = await userModel.findById(req.user._id).select("+passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (hasPasswordUpdate && (!user.passwordHash || user.passwordHash !== hashPassword(currentPassword))) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        if (normalizedEmail !== undefined && normalizedEmail !== user.email) {
            const emailInUse = await userModel.findOne({
                email: normalizedEmail,
                _id: { $ne: user._id }
            });
            if (emailInUse) {
                return res.status(409).json({ message: "User with this email already exists" });
            }
            user.email = normalizedEmail;
        }

        if (name !== undefined) user.name = name.trim();
        if (hasPasswordUpdate) user.passwordHash = hashPassword(newPassword);

        await user.save();
        let passwordChangeEmailId;
        let passwordChangeEmailSent;
        if (hasPasswordUpdate) {
            if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
                const { data: emailData, error: emailError } = await sendPasswordChangedEmail({
                    email: user.email,
                    name: user.name
                });
                passwordChangeEmailId = emailData?.id;
                passwordChangeEmailSent = !emailError;
                if (emailError) {
                    console.error("Password change notification error:", emailError);
                }
            } else {
                passwordChangeEmailSent = false;
                console.error("Password change notification skipped: Resend is not configured");
            }
        }
        const transferredPlaylists = await getTransferredPlaylistCount(user._id);

        return res.status(200).json({
            message: "Profile updated successfully",
            passwordChangeEmailId,
            passwordChangeEmailSent,
            user: serializeUser(user, transferredPlaylists)
        });
    } catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function uploadProfilePhoto(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "An image file is required in the photo field" });
        }

        if (!configureCloudinary()) {
            return res.status(503).json({
                message: "Profile image storage is not configured correctly",
                detail: "CLOUDINARY_URI must use cloudinary://<api_key>:<api_secret>@<cloud_name>"
            });
        }

        const avatarUrl = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: "shipyourplaylists/avatars",
                    public_id: req.user._id.toString(),
                    resource_type: "image",
                    overwrite: true,
                    invalidate: true
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result.secure_url);
                }
            );

            uploadStream.end(req.file.buffer);
        });

        const user = await userModel.findByIdAndUpdate(
            req.user._id,
            { avatarUrl },
            { new: true, runValidators: true }
        );

        const transferredPlaylists = await getTransferredPlaylistCount(user._id);
        return res.status(200).json({
            message: "Profile photo uploaded successfully",
            user: serializeUser(user, transferredPlaylists)
        });
    } catch (error) {
        console.error("Cloudinary profile photo upload error:", {
            message: error.message,
            httpCode: error.http_code,
            name: error.name
        });
        return res.status(502).json({
            message: "Profile image provider unavailable",
            detail: "Cloudinary rejected or could not process the image upload"
        });
    }
}

export async function refreshToken(req, res) {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({
                message: "Token Not Found"
            });
        }
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        const accessToken = jwt.sign({
            id: decoded.id
        }, process.env.JWT_SECRET, {
            expiresIn: "15m"
        });
        const newRefreshToken = jwt.sign({
            id: decoded.id
        }, process.env.JWT_SECRET, {
            expiresIn: "7d"
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            maxAge: 15 * 60 * 1000
        });
        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message: "Access token refreshed successfully!",
            accessToken
        });
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired refresh token"
        });
    }
}

export async function logout(req, res) {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.status(200).json({ message: "Logged out successfully" });
}