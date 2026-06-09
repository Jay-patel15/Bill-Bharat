/**
 * lib/redis/redis.js — Redis Client
 *
 * Provides a lightweight Redis client for:
 *   - OTP / token storage (with TTL)
 *   - Report/query result caching
 *   - Any future session-adjacent caching needs
 *
 * Sessions themselves remain stateless JWT cookies — Redis is NOT required
 * for the app to function. If REDIS_URL is not set or Redis is unreachable,
 * all helpers gracefully degrade (return null / execute fetchFn directly).
 *
 * Environment:
 *   REDIS_URL=redis://redis:6379
 *   REDIS_URL=redis://:password@redis:6379  (with auth)
 *
 * Usage:
 *   import { setEx, get, del, getOrSet } from "@/lib/redis/redis";
 */

import Redis from "ioredis";

// ---------------------------------------------------------------------------
// Client singleton with graceful degradation
// ---------------------------------------------------------------------------
let _client = null;
let _failed  = false;   // Once we know Redis is down, stop retrying

function getRedis() {
  if (_failed) return null;
  if (_client) return _client;

  const url = process.env.REDIS_URL;
  if (!url) return null;  // Redis not configured — silent no-op

  try {
    _client = new Redis(url, {
      lazyConnect:         true,
      enableReadyCheck:    true,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        // Give up after 3 attempts so we don't stall the app
        if (times > 3) {
          _failed = true;
          console.warn("[redis] Giving up after 3 connection attempts. Redis features disabled.");
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      }
    });

    _client.on("error", (err) => {
      // Silence ECONNREFUSED noise after initial failure
      if (!_failed) {
        console.warn("[redis] Connection error:", err.message);
      }
    });

    _client.on("ready", () => {
      _failed = false;
      console.log("[redis] Connected");
    });

  } catch {
    _failed = true;
  }

  return _client;
}

// ---------------------------------------------------------------------------
// Public helpers — all return null/false on Redis unavailability
// ---------------------------------------------------------------------------

/**
 * Set a key with a TTL (time-to-live in seconds).
 * Value is JSON-serialised automatically.
 */
export async function setEx(key, seconds, value) {
  const client = getRedis();
  if (!client) return false;
  try {
    await client.set(key, JSON.stringify(value), "EX", seconds);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a key. Returns the parsed value or null if missing / Redis unavailable.
 */
export async function get(key) {
  const client = getRedis();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Delete one or more keys.
 */
export async function del(...keys) {
  const client = getRedis();
  if (!client) return false;
  try {
    await client.del(...keys);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cache-aside helper.
 * Returns cached value if present; otherwise calls fetchFn, stores the
 * result in Redis with the given TTL, and returns it.
 *
 * @param {string}   key      - Redis key
 * @param {number}   ttl      - TTL in seconds
 * @param {Function} fetchFn  - async () => value
 */
export async function getOrSet(key, ttl, fetchFn) {
  const cached = await get(key);
  if (cached !== null) return cached;

  const value = await fetchFn();
  await setEx(key, ttl, value);
  return value;
}

/**
 * Store an OTP or short-lived token.
 * @param {string} key   - e.g. "otp:user@example.com"
 * @param {string} value - OTP / token string
 * @param {number} ttl   - seconds (default 10 minutes)
 */
export async function setOtp(key, value, ttl = 600) {
  return setEx(key, ttl, value);
}

/**
 * Verify and consume an OTP/token. Returns the stored value and deletes it.
 * Returns null if not found or Redis unavailable.
 */
export async function consumeOtp(key) {
  const value = await get(key);
  if (value !== null) await del(key);
  return value;
}

/** Export raw client for advanced use cases */
export { getRedis };
