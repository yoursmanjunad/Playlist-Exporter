import userModel from "../models/user.models.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";

export async function register(req, res) {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const isAlreadyRegistered = await userModel.findOne({ email });

        // If email already exists
        if (isAlreadyRegistered) {
            return res.status(409).json({
                message: "User with this email already exists"
            });
        }

        // Hash password
        const hashedPassword = crypto
            .createHash("sha256")
            .update(password)
            .digest("hex");

        // Create new user
        const user = await userModel.create({
            email,
            name,
            passwordHash: hashedPassword
        });

        // Generate JWT
        const accessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Set cookies (secure: false for local HTTP dev, sameSite: 'lax')
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

        return res.status(201).json({
            message: "User created successfully.",
            user: {
                id: user._id,
                email: user.email,
                name: user.name
            },
            accessToken,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
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

        const user = await userModel.findOne({ email }).select("+passwordHash");

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const hashedPassword = crypto
            .createHash("sha256")
            .update(password)
            .digest("hex");

        if (user.passwordHash !== hashedPassword) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Generate JWT
        const accessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Set accessToken & refreshToken cookies
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

        return res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                email: user.email,
                name: user.name
            },
            accessToken
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function getMe(req, res) {
    try {
        // req.user is set by authenticate middleware
        return res.status(200).json({
            message: "User fetched successfully",
            user: {
                id: req.user._id,
                email: req.user.email,
                name: req.user.name,
                subscription: req.user.subscription,
                isActive: req.user.isActive
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error"
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