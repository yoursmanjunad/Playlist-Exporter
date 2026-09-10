import { Resend } from "resend";

let resendClient;

function getResendClient() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is not configured");
    }

    resendClient ||= new Resend(process.env.RESEND_API_KEY);
    return resendClient;
}

function getEmailConfig() {
    if (!process.env.RESEND_FROM_EMAIL) {
        throw new Error("RESEND_FROM_EMAIL is not configured");
    }

    return {
        from: process.env.RESEND_FROM_EMAIL,
        frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000"
    };
}

export async function sendVerificationEmail({ email, name, token }) {
    const { from, frontendUrl } = getEmailConfig();
    const verificationUrl = `${frontendUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
        from,
        to: [email],
        subject: "Verify your Ship Your Playlists account",
        html: `<p>Hi ${escapeHtml(name)},</p><p>Verify your email address to activate your account:</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
        text: `Hi ${name}, verify your Ship Your Playlists account here: ${verificationUrl}. This link expires in 24 hours.`,
        idempotencyKey: `verify-user/${email}/${token}`
    });

    return { data, error };
}

export async function sendPasswordChangedEmail({ email, name }) {
    const { from } = getEmailConfig();
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
        from,
        to: [email],
        subject: "Your Ship Your Playlists password was changed",
        html: `<p>Hi ${escapeHtml(name)},</p><p>Your password was changed successfully. If you did not make this change, reset your password immediately and contact support.</p>`,
        text: `Hi ${name}, your Ship Your Playlists password was changed successfully. If you did not make this change, reset your password immediately and contact support.`,
        idempotencyKey: `password-changed/${email}/${Date.now()}`
    });

    return { data, error };
}

export async function sendPasswordResetEmail({ email, name, token }) {
    const { from, frontendUrl } = getEmailConfig();
    const resetUrl = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
        from,
        to: [email],
        subject: "Reset your Ship Your Playlists password",
        html: `<p>Hi ${escapeHtml(name)},</p><p>Reset your password using this link:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`,
        text: `Hi ${name}, reset your Ship Your Playlists password here: ${resetUrl}. This link expires in 1 hour. If you did not request this, you can ignore this email.`,
        idempotencyKey: `password-reset/${email}/${token}`
    });

    return { data, error };
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        "\"": "&quot;"
    }[character]));
}