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
/**
 * Returns true if the request is allowed, false if rate limited.
 * Session ID is used as bucket key.
 */
export declare function checkRateLimit(sessionId: string, method: string): boolean;
/** Clean up session on disconnect to prevent memory leak */
export declare function removeRateLimitSession(sessionId: string): void;
//# sourceMappingURL=rate-limiter.d.ts.map