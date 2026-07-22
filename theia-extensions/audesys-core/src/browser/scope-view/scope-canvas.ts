import { TimeSeriesBuffer } from './time-series-buffer';

/** Pre-defined channel colors (maps channel index to color). */
const CHANNEL_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#eab308'];
const FALLBACK_COLOR = '#888888';

/** Grid + background colors. */
const GRID_COLOR = 'rgba(255,255,255,0.08)';
const AXIS_COLOR = 'rgba(255,255,255,0.3)';
const TEXT_COLOR = 'rgba(255,255,255,0.55)';
const BG_COLOR = '#1a1a2e';

const AXIS_LABEL_FONT = '9px monospace';
const TICK_WIDTH = 4;

interface ViewTransform {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
}

/**
 * ScopeCanvas — renders time-series data using HTML5 Canvas 2D.
 * Supports pan (mouse drag) and zoom (wheel). Uses requestAnimationFrame
 * for smooth rendering.
 */
export class ScopeCanvas {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private animFrameId: number | null = null;
    private transform: ViewTransform = {
        offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1,
    };

    // Pan state
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private dragStartOffsetX = 0;
    private dragStartOffsetY = 0;

    // Channels to render (set externally)
    activeChannels: string[] = [];
    buffer: TimeSeriesBuffer = new TimeSeriesBuffer(1000);

    private _timeWindowSec = 10;

    get timeWindowSec(): number {
        return this._timeWindowSec;
    }

    set timeWindowSec(value: number) {
        this._timeWindowSec = Math.max(1, value);
    }

    constructor(container: HTMLElement) {
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        container.appendChild(this.canvas);

        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        this.ctx = ctx;

        this.setupEvents();
        this.resize();
    }

    /** Start the render loop. */
    start(): void {
        this.resize();
        this.loop();
    }

    /** Stop the render loop. */
    stop(): void {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    /** Resize canvas to fill container. */
    resize(): void {
        const dpr = window.devicePixelRatio || 1;
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Remove listeners and canvas. */
    destroy(): void {
        this.stop();
        this.canvas.remove();
    }

    private loop = (): void => {
        this.draw();
        this.animFrameId = requestAnimationFrame(this.loop);
    };

    private draw(): void {
        const { ctx, canvas, buffer, activeChannels, transform, _timeWindowSec } = this;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;

        // Background
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, w, h);

        // Padding for axes
        const padL = 50, padR = 12, padT = 12, padB = 24;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        if (plotW <= 0 || plotH <= 0) return;

        // Draw grid
        this.drawGrid(padL, padT, plotW, plotH);

        // Clipping region for plot area
        ctx.save();
        ctx.beginPath();
        ctx.rect(padL, padT, plotW, plotH);
        ctx.clip();

        // Compute the visible time range
        const timestamps = buffer.getTimestamps();
        if (timestamps.length < 2 || activeChannels.length === 0) {
            ctx.restore();
            return;
        }

        const now = timestamps[timestamps.length - 1];
        const rangeStart = now - _timeWindowSec * 1000;

        // Map time→x: rangeStart maps to padL, now maps to padL+plotW
        const timeToX = (t: number): number => {
            const ratio = (t - rangeStart) / (_timeWindowSec * 1000);
            return padL + (ratio * transform.scaleX + transform.offsetX) * plotW;
        };

        // Draw each channel
        for (let ci = 0; ci < activeChannels.length; ci++) {
            const chName = activeChannels[ci];
            const color = CHANNEL_COLORS[ci] || FALLBACK_COLOR;
            const values = buffer.getData(chName);
            if (values.length < 2) continue;

            // Find min/max for this channel to determine Y scale
            let yMin = Infinity, yMax = -Infinity;
            for (let i = 0; i < timestamps.length; i++) {
                if (timestamps[i] < rangeStart) continue;
                const v = values[i];
                if (v < yMin) yMin = v;
                if (v > yMax) yMax = v;
            }
            if (!isFinite(yMin)) { yMin = 0; yMax = 1; }
            // Add 10% padding
            const yPadding = (yMax - yMin) * 0.1 || 1;
            yMin -= yPadding;
            yMax += yPadding;

            const valToY = (v: number): number => {
                const ratio = (v - yMin) / (yMax - yMin);
                return padT + (1 - ratio * transform.scaleY + transform.offsetY) * plotH;
            };

            // Clip points to visible range
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            let started = false;

            for (let i = 0; i < timestamps.length; i++) {
                if (timestamps[i] < rangeStart) continue;
                const x = timeToX(timestamps[i]);
                const y = valToY(values[i]);
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            // Channel label (top-left legend)
            const labelX = padL + 4 + ci * 90;
            const labelY = padT + 14;
            ctx.fillStyle = color;
            ctx.font = AXIS_LABEL_FONT;
            ctx.fillText(chName, labelX, labelY);
        }

        ctx.restore();

        // Axis labels
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = AXIS_LABEL_FONT;
        ctx.fillText(`${_timeWindowSec}s`, padL + plotW - 20, padT + plotH + 14);
    }

    private drawGrid(padL: number, padT: number, plotW: number, plotH: number): void {
        const { ctx } = this;
        const gridLines = 5;

        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 0.5;

        // Horizontal grid lines
        for (let i = 0; i <= gridLines; i++) {
            const y = padT + (plotH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + plotW, y);
            ctx.stroke();
        }

        // Vertical grid lines
        for (let i = 0; i <= gridLines; i++) {
            const x = padL + (plotW / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(x, padT);
            ctx.lineTo(x, padT + plotH);
            ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = AXIS_COLOR;
        ctx.lineWidth = 1;
        // X axis
        ctx.beginPath();
        ctx.moveTo(padL, padT + plotH);
        ctx.lineTo(padL + plotW, padT + plotH);
        ctx.stroke();
        // Y axis
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, padT + plotH);
        ctx.stroke();

        // X ticks
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = AXIS_LABEL_FONT;
        const tw = this._timeWindowSec;
        for (let i = 0; i <= gridLines; i++) {
            const x = padL + (plotW / gridLines) * i;
            const t = tw - (tw / gridLines) * i;
            ctx.fillText(`${t.toFixed(1)}s`, x - 6, padT + plotH + 14);
            ctx.beginPath();
            ctx.moveTo(x, padT + plotH);
            ctx.lineTo(x, padT + plotH + TICK_WIDTH);
            ctx.stroke();
        }
    }

    private setupEvents(): void {
        this.canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const zoom = e.deltaY < 0 ? 1.1 : 0.9;
            this.transform.scaleX *= zoom;
            this.transform.scaleY *= zoom;
            this.transform.scaleX = Math.max(0.5, Math.min(10, this.transform.scaleX));
            this.transform.scaleY = Math.max(0.5, Math.min(10, this.transform.scaleY));
        });

        this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.dragStartOffsetX = this.transform.offsetX;
            this.dragStartOffsetY = this.transform.offsetY;
        });

        const onMouseMove = (e: MouseEvent) => {
            if (!this.isDragging) return;
            const dx = (e.clientX - this.dragStartX) / this.canvas.clientWidth;
            const dy = (e.clientY - this.dragStartY) / this.canvas.clientHeight;
            this.transform.offsetX = this.dragStartOffsetX + dx;
            this.transform.offsetY = this.dragStartOffsetY + dy;
        };

        const onMouseUp = () => {
            this.isDragging = false;
        };

        this.canvas.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // ResizeObserver for responsive canvas
        // ponytail: resize on window change, fine for dev
        window.addEventListener('resize', () => this.resize());
    }

    /** Reset pan/zoom to default. */
    resetView(): void {
        this.transform = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };
    }

    /** Export current buffer data as CSV string. */
    exportCSV(): string {
        const channels = this.activeChannels;
        const timestamps = this.buffer.getTimestamps();
        if (timestamps.length === 0) return 'timestamp\n';

        const header = ['timestamp', ...channels].join(',');
        const rows: string[] = [header];

        for (let i = 0; i < timestamps.length; i++) {
            const t = timestamps[i];
            const vals = channels.map(ch => {
                const data = this.buffer.getData(ch);
                return data[i]?.toString() ?? '0';
            });
            rows.push([t.toString(), ...vals].join(','));
        }

        return rows.join('\n');
    }
}
