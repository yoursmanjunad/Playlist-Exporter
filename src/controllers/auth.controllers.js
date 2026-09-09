import userModel from "../models/user.models.js";
import playlistModel from "../models/playlist.models.js";
import crypto from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import jwt from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";

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
        transferredPlaylists
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

        const isAlreadyRegistered = await userModel.findOne({ email });

        if (isAlreadyRegistered) {
            return res.status(409).json({
                message: "User with this email already exists"
            });
        }

        const hashedPassword = hashPassword(password);

        const user = await userModel.create({
            email,
            name,
            passwordHash: hashedPassword
        });

        const { accessToken, refreshToken } =
            generateTokens(user._id);

        setAuthCookies(res, accessToken, refreshToken);

        return res.status(201).json({
            success: true,
            message: "User created successfully",
            user: {
                id: user._id,
                email: user.email,
                name: user.name
            }
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
        const transferredPlaylists = await getTransferredPlaylistCount(user._id);

        return res.status(200).json({
            message: "Profile updated successfully",
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

        const extension = req.file.mimetype.split("/")[1].replace("jpeg", "jpg");
        const filename = `${req.user._id}-${crypto.randomBytes(16).toString("hex")}.${extension}`;
        const uploadDirectory = path.join(process.cwd(), "public", "uploads", "avatars");
        const filePath = path.join(uploadDirectory, filename);

        await mkdir(uploadDirectory, { recursive: true });
        await writeFile(filePath, req.file.buffer);

        const avatarUrl = `/uploads/avatars/${filename}`;
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
        console.error("Upload profile photo error:", error);
        return res.status(500).json({ message: "Internal server error" });
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