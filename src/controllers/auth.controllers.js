import userModel from "../models/user.models.js";
import crypto from "crypto";
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
        const token = jwt.sign(
            {
                id: user._id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        return res.status(201).json({
            message: "User created successfully.",
            user: {
                email: user.email,
                name: user.name
            },
            token
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