/**
 * lib/rate-limit.js — In-memory Sliding Window Rate Limiter
 *
 * Enforces rate limits per IP / key to prevent brute-force attacks and abuse.
 */

const hitMap = new Map();

// Periodic cleanup of expired entries (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of hitMap.entries()) {
      if (now > data.resetTime) {
        hitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Check if request exceeds rate limit.
 *
 * @param {string} key - Unique identifier (e.g., IP address or route+IP)
 * @param {number} limit - Maximum allowed requests in window
 * @param {number} windowMs - Window duration in milliseconds (default 60000ms = 1 min)
 * @returns {{ success: boolean, limit: number, remaining: number, resetTime: number }}
 */
export function checkRateLimit(key, limit = 60, windowMs = 60 * 1000) {
  const now = Date.now();
  const record = hitMap.get(key);

  if (!record || now > record.resetTime) {
    hitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, limit, remaining: limit - 1, resetTime: now + windowMs };
  }

  if (record.count >= limit) {
    return { success: false, limit, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { success: true, limit, remaining: limit - record.count, resetTime: record.resetTime };
}
