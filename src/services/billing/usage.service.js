import userModel from "../../models/user.models.js";

export const FREE_TRACK_LIMIT = 100;

function monthStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function nextMonthStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function isPremium(user) {
    return user?.subscription?.plan === "premium";
}

export function getUsageSummary(user, now = new Date()) {
    const usage = user?.usage || {};
    const isCurrentMonth = usage.usageResetAt
        && usage.usageResetAt >= monthStart(now);
    const tracksExported = isCurrentMonth
        ? usage.tracksExportedThisMonth || 0
        : 0;
    const playlistsTransferred = isCurrentMonth
        ? usage.transfersThisMonth || 0
        : 0;
    const premium = isPremium(user);

    return {
        period: "monthly",
        plan: premium ? "premium" : "free",
        playlistsTransferred,
        playlistsLimit: null,
        tracksExported,
        tracksLimit: premium ? null : FREE_TRACK_LIMIT,
        tracksRemaining: premium
            ? null
            : Math.max(FREE_TRACK_LIMIT - tracksExported, 0),
        resetAt: nextMonthStart(now),
    };
}

async function resetUsageIfNeeded(userId) {
    await userModel.updateOne(
        {
            _id: userId,
            $or: [
                { "usage.usageResetAt": { $lt: monthStart() } },
                { "usage.usageResetAt": { $exists: false } },
            ],
        },
        {
            $set: {
                "usage.transfersThisMonth": 0,
                "usage.tracksExportedThisMonth": 0,
                "usage.usageResetAt": monthStart(),
            },
        }
    );
}

export async function reserveTrackCredits(userId, trackCount) {
    await resetUsageIfNeeded(userId);

    const user = await userModel.findById(userId).select("subscription usage");
    if (!user) return { allowed: false, reason: "user_not_found" };

    if (isPremium(user)) {
        return { allowed: true, reserved: 0, usage: getUsageSummary(user) };
    }

    const reservedUser = await userModel.findOneAndUpdate(
        {
            _id: userId,
            "usage.tracksExportedThisMonth": {
                $lte: FREE_TRACK_LIMIT - trackCount,
            },
        },
        { $inc: { "usage.tracksExportedThisMonth": trackCount } },
        { new: true }
    ).select("subscription usage");

    if (!reservedUser) {
        const currentUser = await userModel.findById(userId).select("subscription usage");
        return {
            allowed: false,
            reason: "track_limit_reached",
            usage: getUsageSummary(currentUser),
        };
    }

    return {
        allowed: true,
        reserved: trackCount,
        usage: getUsageSummary(reservedUser),
    };
}

export async function reconcileTransferCredits(userId, reserved, exported) {
    const tracksAdjustment = exported - reserved;
    await userModel.updateOne(
        { _id: userId },
        {
            $inc: {
                "usage.transfersThisMonth": 1,
                "usage.tracksExportedThisMonth": tracksAdjustment,
            },
        }
    );
}

export async function releaseTrackCredits(userId, reserved) {
    if (!reserved) return;

    await userModel.updateOne(
        { _id: userId },
        { $inc: { "usage.tracksExportedThisMonth": -reserved } }
    );
}