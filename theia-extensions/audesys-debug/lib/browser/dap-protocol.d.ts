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
export declare function encodeRequest(seq: number, command: string, args?: object): string;
/**
 * Parse as many complete DAP frames as possible from a byte-stream buffer.
 * Returns the parsed frames and the un-consumed trailing bytes (a partial frame tail).
 * Call repeatedly with the accumulated buffer (previous `rest` + newly-read chunk).
 */
export declare function decodeFrames(buffer: string): {
    frames: DapFrame[];
    rest: string;
};
//# sourceMappingURL=dap-protocol.d.ts.map