import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function getSecretKey() {
    const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default_encryption_secret_key_32bytes!!";
    return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts plaintext string using AES-256-CBC.
 */
export function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts ciphertext string using AES-256-CBC.
 */
export function decrypt(encryptedText) {
    if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
    const [ivHex, encrypted] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
