export interface JsonRpcRequest { jsonrpc: '2.0'; id: number | string; method: string; params?: unknown; }
export interface JsonRpcNotification { jsonrpc: '2.0'; method: string; params?: unknown; }
export interface JsonRpcSuccess { jsonrpc: '2.0'; id: number | string; result: unknown; }
export interface JsonRpcFailure { jsonrpc: '2.0'; id: number | string | null; error: { code: number; message: string; data?: unknown }; }
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcSuccess | JsonRpcFailure;

/** Incremental Content-Length codec shared by LSP and DAP stdio transports. */
export class ContentLengthFrameCodec {
  private buffered = new Uint8Array(0);
  private readonly maxBufferedBytes: number;
  constructor(private readonly maxFrameBytes = 8 * 1024 * 1024, private readonly maxHeaderBytes = 8 * 1024) {
    if (!Number.isSafeInteger(maxFrameBytes) || maxFrameBytes < 1 || !Number.isSafeInteger(maxHeaderBytes) || maxHeaderBytes < 1 || maxHeaderBytes > maxFrameBytes || !Number.isSafeInteger(maxFrameBytes + maxHeaderBytes)) throw new Error('Invalid frame limits.');
    this.maxBufferedBytes = maxFrameBytes + maxHeaderBytes;
  }
  push(chunk: Uint8Array): string[] {
    if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) return [];
    const messages: string[] = [];
    let offset = 0;
    while (offset < chunk.byteLength) {
      const room = this.maxBufferedBytes - this.buffered.byteLength;
      if (room <= 0) throw new Error('Framed protocol buffer exceeds configured limit.');
      const take = Math.min(room, chunk.byteLength - offset);
      this.append(chunk.subarray(offset, offset + take));
      offset += take;
      try { this.extract(messages); } catch (error) { this.reset(); throw error; }
    }
    // A zero-length chunk is not needed to complete a frame; any complete frame
    // has already been extracted after the final append above.
    return messages;
  }
  encode(message: unknown): Uint8Array {
    const body = new TextEncoder().encode(JSON.stringify(message));
    if (body.byteLength < 1 || body.byteLength > this.maxFrameBytes) throw new Error('Outgoing protocol message exceeds configured limit.');
    const header = new TextEncoder().encode(`Content-Length: ${body.byteLength}\r\n\r\n`);
    const frame = new Uint8Array(header.byteLength + body.byteLength); frame.set(header); frame.set(body, header.byteLength); return frame;
  }
  reset(): void { this.buffered = new Uint8Array(0); }
  private append(bytes: Uint8Array): void {
    const merged = new Uint8Array(this.buffered.byteLength + bytes.byteLength);
    merged.set(this.buffered); merged.set(bytes, this.buffered.byteLength); this.buffered = merged;
  }
  private extract(messages: string[]): void {
    const separator = new Uint8Array([13, 10, 13, 10]);
    while (true) {
      const headerEnd = findBytes(this.buffered, separator);
      if (headerEnd < 0) {
        if (this.buffered.byteLength > this.maxHeaderBytes) throw new Error('Protocol header exceeds configured limit.');
        return;
      }
      if (headerEnd > this.maxHeaderBytes) throw new Error('Protocol header exceeds configured limit.');
      const header = new TextDecoder('ascii', { fatal: true }).decode(this.buffered.slice(0, headerEnd));
      const lengths = header.split('\r\n').filter((line) => /^content-length\s*:/i.test(line));
      if (lengths.length !== 1) throw new Error('Protocol frame must contain exactly one Content-Length header.');
      const match = /^content-length\s*:\s*(\d+)\s*$/i.exec(lengths[0] ?? '');
      if (!match) throw new Error('Invalid Content-Length header.');
      const length = Number(match[1]);
      if (!Number.isSafeInteger(length) || length < 1 || length > this.maxFrameBytes) throw new Error('Content-Length is outside configured limits.');
      const bodyStart = headerEnd + separator.byteLength;
      const frameEnd = bodyStart + length;
      if (!Number.isSafeInteger(frameEnd)) throw new Error('Protocol frame length overflow.');
      if (this.buffered.byteLength < frameEnd) return;
      messages.push(new TextDecoder('utf-8', { fatal: true }).decode(this.buffered.slice(bodyStart, frameEnd)));
      this.buffered = this.buffered.slice(frameEnd);
    }
  }
}

function findBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
