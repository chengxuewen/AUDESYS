/**
 * In-memory token-bucket rate limiter.
 *
 * Matches STH-013:
 *   - compile_* : 10 req/min per session
 *   - signal_read: 1000 req/min per session
 *
 * ponytail: no external lib — 30 lines of token bucket vs. adding bottleneck/express-rate-limit.
 * Replace with redis-backed limiter if multi-instance deployments arise.
 */

interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

const BUCKETS: Record<string, TokenBucket> = {};

const LIMITS: Record<string, number> = {
    compile: 10,   // per minute
    signal: 1000,  // per minute
    default: 100,  // per minute
};

function getLimitForMethod(method: string): number {
    if (method.startsWith('compile')) return LIMITS.compile;
    if (method === 'readSignal' || method === 'signalSnapshot') return LIMITS.signal;
    return LIMITS.default;
}

/**
 * Returns true if the request is allowed, false if rate limited.
 * Session ID is used as bucket key.
 */
export function checkRateLimit(sessionId: string, method: string): boolean {
    const limit = getLimitForMethod(method);
    const key = `${sessionId}:${limit === LIMITS.compile ? 'compile' : (limit === LIMITS.signal ? 'signal' : 'default')}`;

    const now = Date.now();
    const bucket = BUCKETS[key];
    const intervalMs = 60_000; // 1 minute window

    if (!bucket) {
        BUCKETS[key] = { tokens: limit - 1, lastRefill: now };
        return true;
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refill = Math.floor(elapsed / intervalMs) * limit;
    if (refill > 0) {
        bucket.tokens = Math.min(limit, bucket.tokens + refill);
        bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
        bucket.tokens--;
        return true;
    }

    return false;
}

/** Clean up session on disconnect to prevent memory leak */
export function removeRateLimitSession(sessionId: string): void {
    Object.keys(BUCKETS).forEach((key) => {
        if (key.startsWith(sessionId)) {
            delete BUCKETS[key];
        }
    });
}
