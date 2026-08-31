import jwt from "jsonwebtoken";

export function generateAccessToken(userId) {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        {
            expiresIn: "1d"
        }
    );
}

export function generateRefreshToken(userId) {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}

export function setAuthCookies(res, userId) {
    const isProduction =
        process.env.NODE_ENV === "production";

    const accessToken = generateAccessToken(userId);

    const refreshToken = generateRefreshToken(userId);

    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return {
        accessToken,
        refreshToken
    };
}