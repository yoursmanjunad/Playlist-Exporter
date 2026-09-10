import { consumeRateLimit } from "../services/cache/redis.service.js";

const localCounters = new Map();

function clientIp(req) {
	return req.ip || req.socket?.remoteAddress || "unknown";
}

function localConsume(key, windowSeconds) {
	const now = Date.now();
	const existing = localCounters.get(key);

	if (!existing || existing.expiresAt <= now) {
		const next = { count: 1, expiresAt: now + windowSeconds * 1000 };
		localCounters.set(key, next);
		return { count: next.count, ttl: windowSeconds };
	}

	existing.count += 1;
	return {
		count: existing.count,
		ttl: Math.max(Math.ceil((existing.expiresAt - now) / 1000), 1)
	};
}

function resolveKeys(key, req) {
	const value = typeof key === "function" ? key(req) : key;
	return (Array.isArray(value) ? value : [value]).map((item) => {
		if (item === "user") return `user:${req.user?._id || "anonymous"}`;
		if (item === "ip") return `ip:${clientIp(req)}`;
		return String(item);
	});
}

export function rateLimit({
	name,
	limit,
	windowSeconds,
	key = "ip",
	message = "Too many requests. Please try again later."
}) {
	return async (req, res, next) => {
		const max = typeof limit === "function" ? limit(req) : limit;
		const keys = resolveKeys(key, req);
		const results = [];

		for (const identity of keys) {
			const counterKey = `shipyourplaylists:ratelimit:${name}:${identity}`;
			const result = await consumeRateLimit(counterKey, windowSeconds);
			results.push(result || localConsume(counterKey, windowSeconds));
		}

		const blocked = results.find((result) => result.count > max);
		const remaining = Math.max(0, max - Math.max(...results.map((result) => result.count)));
		const retryAfter = blocked?.ttl || windowSeconds;

		res.set({
			"RateLimit-Limit": String(max),
			"RateLimit-Remaining": String(remaining),
			"RateLimit-Reset": String(retryAfter)
		});

		if (blocked) {
			res.set("Retry-After", String(retryAfter));
			return res.status(429).json({
				error: "RATE_LIMITED",
				message,
				retryAfter
			});
		}

		return next();
	};
}

export function planRateLimit(options) {
	return rateLimit({
		...options,
		limit: (req) => {
			const isPremium = req.user?.subscription?.plan === "premium";
			return isPremium ? options.premiumLimit : options.freeLimit;
		},
		key: (req) => `user:${req.user?._id || "anonymous"}`
	});
}
