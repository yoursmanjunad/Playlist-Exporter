import userModel from "../models/user.models.js";
import crypto, { secureHeapUsed } from "crypto";
import { access } from "fs";
import jwt from "jsonwebtoken";

export async function register(req, res) {
    try {
        const { email, password, name } = req.body;

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
            password: hashedPassword
        });

        // Generate JWT
        const accessToken = jwt.sign(
            {
                id: user._id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "15m"
            }
        );
        const refreshToken = jwt.sign({
            id: user._id
        }, process.env.JWT_SECRET, {
            expiresIn: "7d"
        })

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true, 
            sameSite: "strict",
            maxAge: 7*24*60*60*1000
        })
        return res.status(201).json({
            message: "User created successfully.",
            user: {
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

export async function getMe(req, res) {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                message: "Token not found"
            });
        }
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
        const user = await userModel.findById(decoded.id);
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        return res.status(200).json({
            message: "User fetched successfully",
            user: {
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error"
    });
}
}

export async function refreshToken(req, res){
    const refreshToken = req.cookies.refreshToken;
    if(!refreshToken){
        res.status(401).json({
            message: "Token Not Found"
        })
    }
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const accessToken = jwt.sign({
        id: decoded.id
    }, process.env.JWT_SECRET, {
        expiresIn: "15m"
    })
    const newRefreshToken = jwt.sign({
        id: decoded.id
    }, process.env.JWT_SECRET, {
        expiresIn: "7d"
    })
    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true, 
        secure: true, 
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    })
    res.status(200).json({
        message: "Access token refreshed successfully!",
        accessToken
    })
}