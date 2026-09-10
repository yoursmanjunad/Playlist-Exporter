import crypto from "crypto";
import { createClient } from "redis";

let redisClient;
let redisConnectionPromise;

function getRedisClient() {
    if (!process.env.REDIS_URL) {
        return null;
    }

    if (!redisClient) {
        redisClient = createClient({ url: process.env.REDIS_URL });
        redisClient.on("error", (error) => {
            console.error("Redis cache error:", error.message);
        });
    }

    return redisClient;
}

async function getConnectedClient() {
    const client = getRedisClient();
    if (!client) {
        return null;
    }

    if (!redisConnectionPromise) {
        redisConnectionPromise = client.connect().catch((error) => {
            redisConnectionPromise = null;
            console.error("Redis cache connection failed:", error.message);
            return null;
        });
    }

    await redisConnectionPromise;
    return client.isReady ? client : null;
}

export function getDeviceId(req) {
    const deviceId = req.get("X-Device-ID") || req.get("X-Device-Id");
    return deviceId?.trim() || "default";
}

export function getPlaylistCacheKey(userId, deviceId) {
    const deviceHash = crypto
        .createHash("sha256")
        .update(deviceId)
        .digest("hex");

    return `shipyourplaylists:playlists:${userId}:${deviceHash}`;
}

export async function getJson(key) {
    try {
        const client = await getConnectedClient();
        if (!client) return null;

        const value = await client.get(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.error("Redis cache read failed:", error.message);
        return null;
    }
}

export async function setJson(key, value, ttlSeconds) {
    try {
        const client = await getConnectedClient();
        if (!client) return false;

        await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
        return true;
    } catch (error) {
        console.error("Redis cache write failed:", error.message);
        return false;
    }
}

export async function deleteKey(key) {
    try {
        const client = await getConnectedClient();
        if (!client) return false;

        await client.del(key);
        return true;
    } catch (error) {
        console.error("Redis cache delete failed:", error.message);
        return false;
    }
}

export async function consumeRateLimit(key, windowSeconds) {
    try {
        const client = await getConnectedClient();
        if (!client) return null;

        const [count, ttl] = await client.eval(
            `local count = redis.call("INCR", KEYS[1])
             if count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
             return { count, redis.call("TTL", KEYS[1]) }`,
            {
                keys: [key],
                arguments: [String(windowSeconds)]
            }
        );

        return { count: Number(count), ttl: Math.max(Number(ttl), 1) };
    } catch (error) {
        console.error("Redis rate limit failed:", error.message);
        return null;
    }
}