import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, removeRateLimitSession } from '../src/node/rate-limiter';

describe('Rate Limiter', () => {
    const sessionId = 'test-session-1';

    beforeEach(() => {
        // Use fake timers so we control Date.now()
        vi.useFakeTimers();
        // Clean up any leftover buckets between tests
        removeRateLimitSession(sessionId);
        removeRateLimitSession('other-session');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ---------- compile rate limit (10/min) ----------
    describe('compile methods (limit: 10/min)', () => {
        it('allows first 10 compile calls', () => {
            for (let i = 0; i < 10; i++) {
                expect(checkRateLimit(sessionId, 'compileSt')).toBe(true);
            }
        });

        it('rejects 11th compile call within the same minute', () => {
            for (let i = 0; i < 10; i++) {
                checkRateLimit(sessionId, 'compileSt');
            }
            // 11th call — bucket exhausted
            expect(checkRateLimit(sessionId, 'compileSt')).toBe(false);
        });

        it('allows compile again after 60s window resets', () => {
            // Exhaust the bucket
            for (let i = 0; i < 11; i++) {
                checkRateLimit(sessionId, 'compileSt');
            }
            // Advance 60 seconds
            vi.advanceTimersByTime(61_000);

            // Should refill and allow again
            expect(checkRateLimit(sessionId, 'compileSt')).toBe(true);
        });
    });

    // ---------- signal read rate limit (1000/min) ----------
    describe('signal_read methods (limit: 1000/min)', () => {
        it('allows 100 readSignal calls within same minute', () => {
            for (let i = 0; i < 100; i++) {
                expect(checkRateLimit(sessionId, 'readSignal')).toBe(true);
            }
        });

        it('rejects after exhausting signal bucket (1001 calls)', () => {
            // 1000/min — first call creates bucket with 999 tokens,
            // remaining 999 consume them, 1001st fails
            for (let i = 0; i < 1000; i++) {
                checkRateLimit(sessionId, 'readSignal');
            }
            expect(checkRateLimit(sessionId, 'readSignal')).toBe(false);
        });
    });

    // ---------- separate buckets per session ----------
    describe('session isolation', () => {
        it('has separate rate limits per session', () => {
            // Exhaust session-1 compile bucket
            for (let i = 0; i < 10; i++) {
                checkRateLimit('session-1', 'compileSt');
            }
            // session-2 still has full bucket
            expect(checkRateLimit('session-2', 'compileSt')).toBe(true);
        });

        it('removeRateLimitSession cleans up all buckets for session', () => {
            checkRateLimit('session-cleanup', 'compileSt');
            checkRateLimit('session-cleanup', 'readSignal');
            removeRateLimitSession('session-cleanup');

            // After cleanup, new calls start fresh
            expect(checkRateLimit('session-cleanup', 'compileSt')).toBe(true);
        });
    });
});
