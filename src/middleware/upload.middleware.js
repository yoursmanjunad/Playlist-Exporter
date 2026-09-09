import multer from "multer";

const allowedImageTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
]);

export const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        if (!allowedImageTypes.has(file.mimetype)) {
            return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "photo"));
        }

        callback(null, true);
    }
});

export function uploadAvatar(req, res, next) {
    avatarUpload.single("photo")(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            const message = error.code === "LIMIT_FILE_SIZE"
                ? "Profile photo must be 5 MB or smaller"
                : "Profile photo must be a JPEG, PNG, WebP, or GIF image";
            return res.status(400).json({ message });
        }

        if (error) {
            return res.status(400).json({ message: "Invalid profile photo upload" });
        }

        next();
    });
}