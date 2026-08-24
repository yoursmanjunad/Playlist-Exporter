import jwt from "jsonwebtoken";
import userModel from "../models/user.models.js";

/**
 * Middleware to verify JWT authentication.
 * Checks for token in Authorization header (Bearer <token>) or cookies.
 * Attaches authenticated user object to req.user.
 */
export async function authenticate(req, res, next) {
    try {
        let token;

        // 1. Check Authorization header for Bearer token
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer ")
        ) {
            token = req.headers.authorization.split(" ")[1];
        } 
        // 2. Fallback to cookies if token not in Authorization header
        else if (req.cookies && (req.cookies.accessToken || req.cookies.token)) {
            token = req.cookies.accessToken || req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                message: "Authentication required. No token provided."
            });
        }

        // 3. Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Find user by id from decoded token payload
        const user = await userModel.findById(decoded.id).select("-passwordHash");

        if (!user) {
            return res.status(401).json({
                message: "User not found or token invalid."
            });
        }

        if (user.isActive === false) {
            return res.status(403).json({
                message: "User account has been deactivated."
            });
        }

        // 5. Attach user object to request
        req.user = user;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token has expired."
            });
        }
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token."
            });
        }
        console.error("Auth middleware error:", error);
        return res.status(500).json({
            message: "Internal server error during authentication."
        });
    }
}
