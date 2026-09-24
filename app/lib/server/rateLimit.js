import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = UPSTASH_URL && UPSTASH_TOKEN ? new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN }) : null;

if (!redis) {
  console.warn("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — rate limiting is disabled.");
}

const lookupLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(8, "60 s"), prefix: "ratelimit:lookup", analytics: true })
  : null;

const submitLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "10 m"), prefix: "ratelimit:submit", analytics: true })
  : null;

export function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function checkLookupRateLimit(req) {
  if (!lookupLimiter) return { allowed: true };
  const ip = getClientIp(req);
  try {
    const { success } = await lookupLimiter.limit(ip);
    return { allowed: success };
  } catch (err) {
    console.error("Rate limit check failed (failing open):", err);
    return { allowed: true };
  }
}

export async function checkSubmitRateLimit(req) {
  if (!submitLimiter) return { allowed: true };
  const ip = getClientIp(req);
  try {
    const { success } = await submitLimiter.limit(ip);
    return { allowed: success };
  } catch (err) {
    console.error("Rate limit check failed (failing open):", err);
    return { allowed: true };
  }
}
