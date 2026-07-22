/**
 * Ring buffer for time-series data. Stores per-channel numeric values
 * with timestamps, automatically dropping oldest entries when full.
 */
export interface DataPoint {
    timestamp: number;
    values: Map<string, number>;
}
export declare class TimeSeriesBuffer {
    private maxPoints;
    private buffer;
    private channelSet;
    constructor(maxPoints: number);
    /** Append a new data point. Drops oldest entry if buffer is full. */
    push(timestamp: number, values: Record<string, number>): void;
    /** Get values for a single channel over the time window. */
    getData(channelName: string): number[];
    /** Get all timestamps in the buffer. */
    getTimestamps(): number[];
    /** Return the array of active channel names. */
    getChannels(): string[];
    /** Number of points currently stored. */
    get length(): number;
    /** Clear all data but keep channel registry. */
    clear(): void;
    /** Access the raw buffer for CSV export. */
    getRaw(): ReadonlyArray<DataPoint>;
}
//# sourceMappingURL=time-series-buffer.d.ts.map