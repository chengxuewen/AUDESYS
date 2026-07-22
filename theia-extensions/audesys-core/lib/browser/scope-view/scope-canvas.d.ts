import { TimeSeriesBuffer } from './time-series-buffer';
/**
 * ScopeCanvas — renders time-series data using HTML5 Canvas 2D.
 * Supports pan (mouse drag) and zoom (wheel). Uses requestAnimationFrame
 * for smooth rendering.
 */
export declare class ScopeCanvas {
    private canvas;
    private ctx;
    private animFrameId;
    private transform;
    private isDragging;
    private dragStartX;
    private dragStartY;
    private dragStartOffsetX;
    private dragStartOffsetY;
    activeChannels: string[];
    buffer: TimeSeriesBuffer;
    private _timeWindowSec;
    get timeWindowSec(): number;
    set timeWindowSec(value: number);
    constructor(container: HTMLElement);
    /** Start the render loop. */
    start(): void;
    /** Stop the render loop. */
    stop(): void;
    /** Resize canvas to fill container. */
    resize(): void;
    /** Remove listeners and canvas. */
    destroy(): void;
    private loop;
    private draw;
    private drawGrid;
    private setupEvents;
    /** Reset pan/zoom to default. */
    resetView(): void;
    /** Export current buffer data as CSV string. */
    exportCSV(): string;
}
//# sourceMappingURL=scope-canvas.d.ts.map