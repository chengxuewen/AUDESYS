/**
 * Ring buffer for time-series data. Stores per-channel numeric values
 * with timestamps, automatically dropping oldest entries when full.
 */
export interface DataPoint {
    timestamp: number;
    values: Map<string, number>;
}

export class TimeSeriesBuffer {
    private buffer: DataPoint[] = [];
    private channelSet = new Set<string>();

    constructor(private maxPoints: number) {}

    /** Append a new data point. Drops oldest entry if buffer is full. */
    push(timestamp: number, values: Record<string, number>): void {
        if (this.buffer.length >= this.maxPoints) {
            this.buffer.shift();
        }
        const point: DataPoint = {
            timestamp,
            values: new Map(Object.entries(values)),
        };
        for (const key of Object.keys(values)) {
            this.channelSet.add(key);
        }
        this.buffer.push(point);
    }

    /** Get values for a single channel over the time window. */
    getData(channelName: string): number[] {
        return this.buffer.map(p => p.values.get(channelName) ?? 0);
    }

    /** Get all timestamps in the buffer. */
    getTimestamps(): number[] {
        return this.buffer.map(p => p.timestamp);
    }

    /** Return the array of active channel names. */
    getChannels(): string[] {
        return [...this.channelSet];
    }

    /** Number of points currently stored. */
    get length(): number {
        return this.buffer.length;
    }

    /** Clear all data but keep channel registry. */
    clear(): void {
        this.buffer = [];
    }

    /** Access the raw buffer for CSV export. */
    getRaw(): ReadonlyArray<DataPoint> {
        return this.buffer;
    }
}
