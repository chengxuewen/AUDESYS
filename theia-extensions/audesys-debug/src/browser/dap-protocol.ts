/**
 * DAP (Debug Adapter Protocol) Content-Length framing — pure logic, zero @theia deps.
 *
 * Wire format (VSCode DAP): `Content-Length: <N>\r\n\r\n<JSON body of exactly N bytes>`.
 * The dap-adapter reads the header line, skips a blank separator line, then reads N
 * body bytes. Responses are emitted back over stdout in the same Content-Length framing.
 */

export interface DapRequest {
    seq: number;
    command: string;
    /** @deprecated use `arguments` field name from the DAP spec */
    args?: unknown;
    arguments?: unknown;
}

export interface DapResponse {
    seq: number;
    type: 'response';
    request_seq: number;
    success: boolean;
    command: string;
    body?: unknown;
    message?: string;
}

export interface DapEvent {
    seq: number;
    type: 'event';
    event: string;
    body?: unknown;
}

export type DapFrame = DapResponse | DapEvent;

/**
 * Encode a DAP request as a complete Content-Length frame.
 * Example: `Content-Length: 42\r\n\r\n{"seq":1,"command":"initialize"}`.
 */
export function encodeRequest(seq: number, command: string, args?: object): string {
    const body = JSON.stringify({ seq, command, ...(args !== undefined ? { arguments: args } : {}) });
    return `Content-Length: ${byteLength(body)}\r\n\r\n${body}`;
}

/**
 * Parse as many complete DAP frames as possible from a byte-stream buffer.
 * Returns the parsed frames and the un-consumed trailing bytes (a partial frame tail).
 * Call repeatedly with the accumulated buffer (previous `rest` + newly-read chunk).
 */
export function decodeFrames(buffer: string): { frames: DapFrame[]; rest: string } {
    const frames: DapFrame[] = [];
    let rest = buffer;

    while (rest.length > 0) {
        const headerEnd = rest.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
            break; // incomplete header, wait for more bytes
        }
        const header = rest.slice(0, headerEnd);
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        if (!match) {
            // Malformed header — drop the bogus leading bytes and continue scanning.
            rest = rest.slice(headerEnd + 4);
            continue;
        }
        const length = Number(match[1]);
        const bodyStart = headerEnd + 4;
        if (rest.length < bodyStart + length) {
            break; // incomplete body, wait for more bytes
        }
        const body = rest.slice(bodyStart, bodyStart + length);
        try {
            frames.push(JSON.parse(body) as DapFrame);
        } catch {
            // Corrupt body — skip this frame and keep scanning forward.
        }
        rest = rest.slice(bodyStart + length);
    }

    return { frames, rest };
}

/** Byte length of a string (UTF-8), matching the wire Content-Length semantics. */
function byteLength(s: string): number {
    return Buffer.byteLength(s, 'utf8');
}