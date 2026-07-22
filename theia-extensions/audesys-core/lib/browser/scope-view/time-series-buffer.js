"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeSeriesBuffer = void 0;
class TimeSeriesBuffer {
    constructor(maxPoints) {
        this.maxPoints = maxPoints;
        this.buffer = [];
        this.channelSet = new Set();
    }
    /** Append a new data point. Drops oldest entry if buffer is full. */
    push(timestamp, values) {
        if (this.buffer.length >= this.maxPoints) {
            this.buffer.shift();
        }
        const point = {
            timestamp,
            values: new Map(Object.entries(values)),
        };
        for (const key of Object.keys(values)) {
            this.channelSet.add(key);
        }
        this.buffer.push(point);
    }
    /** Get values for a single channel over the time window. */
    getData(channelName) {
        return this.buffer.map(p => p.values.get(channelName) ?? 0);
    }
    /** Get all timestamps in the buffer. */
    getTimestamps() {
        return this.buffer.map(p => p.timestamp);
    }
    /** Return the array of active channel names. */
    getChannels() {
        return [...this.channelSet];
    }
    /** Number of points currently stored. */
    get length() {
        return this.buffer.length;
    }
    /** Clear all data but keep channel registry. */
    clear() {
        this.buffer = [];
    }
    /** Access the raw buffer for CSV export. */
    getRaw() {
        return this.buffer;
    }
}
exports.TimeSeriesBuffer = TimeSeriesBuffer;
//# sourceMappingURL=time-series-buffer.js.map