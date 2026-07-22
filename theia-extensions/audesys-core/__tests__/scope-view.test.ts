import { describe, it, expect } from 'vitest';
import { TimeSeriesBuffer } from '../src/browser/scope-view/time-series-buffer';

describe('TimeSeriesBuffer', () => {
    it('should return empty data for an empty buffer', () => {
        const buf = new TimeSeriesBuffer(100);
        expect(buf.length).toBe(0);
        expect(buf.getTimestamps()).toEqual([]);
        expect(buf.getChannels()).toEqual([]);
        expect(buf.getData('any')).toEqual([]);
    });

    it('should handle a single data point correctly', () => {
        const buf = new TimeSeriesBuffer(100);
        buf.push(1000, { 'ch1': 3.14 });

        expect(buf.length).toBe(1);
        expect(buf.getTimestamps()).toEqual([1000]);
        expect(buf.getChannels()).toEqual(['ch1']);
        expect(buf.getData('ch1')).toEqual([3.14]);
    });

    it('should drop oldest entries when buffer overflows', () => {
        const buf = new TimeSeriesBuffer(5);

        for (let i = 0; i < 8; i++) {
            buf.push(i * 100, { 'signal': i });
        }

        // Only last 5 points retained
        expect(buf.length).toBe(5);
        expect(buf.getTimestamps()).toEqual([300, 400, 500, 600, 700]);
        expect(buf.getData('signal')).toEqual([3, 4, 5, 6, 7]);
    });

    it('should isolate data across channels', () => {
        const buf = new TimeSeriesBuffer(100);

        buf.push(0, { 'A': 10, 'B': 20 });
        buf.push(1, { 'A': 11 });
        buf.push(2, { 'B': 22 });
        buf.push(3, { 'A': 13, 'B': 23 });

        expect(buf.getChannels().sort()).toEqual(['A', 'B']);
        expect(buf.getData('A')).toEqual([10, 11, 0, 13]);
        expect(buf.getData('B')).toEqual([20, 0, 22, 23]);
    });

    it('getData returns 0 for missing channel in a point', () => {
        const buf = new TimeSeriesBuffer(100);
        buf.push(1, { 'ch1': 5 });
        buf.push(2, { 'ch2': 7 });

        // ch1 was only in first point, missing in second
        expect(buf.getData('ch1')).toEqual([5, 0]);
        // ch2 was only in second point, missing in first
        expect(buf.getData('ch2')).toEqual([0, 7]);
    });

    it('clear empties the buffer but preserves channel set', () => {
        const buf = new TimeSeriesBuffer(100);
        buf.push(1, { 'ch1': 5, 'ch2': 10 });
        buf.clear();

        expect(buf.length).toBe(0);
        expect(buf.getTimestamps()).toEqual([]);
        expect(buf.getData('ch1')).toEqual([]);
        // channelSet is preserved (not cleared by design)
    });

    it('getRaw returns a read-only view of the underlying array', () => {
        const buf = new TimeSeriesBuffer(10);
        buf.push(1, { 'x': 42 });

        const raw = buf.getRaw();
        expect(raw.length).toBe(1);
        expect(raw[0].timestamp).toBe(1);
        expect(raw[0].values.get('x')).toBe(42);
    });
});
