import type { ProjectExportPayload } from './projectExport.js';

export interface ClipboardAdapter { writeText(text: string): Promise<void>; }
export type ShareOutcome = 'SHARED' | 'CANCELLED' | 'DENIED' | 'UNSUPPORTED';
export interface ShareAdapter { share(input: { title: string; text?: string; file?: ProjectExportPayload }): Promise<ShareOutcome>; }
export interface DownloadAdapter { download(payload: ProjectExportPayload): Promise<void>; }

export class BrowserClipboardAdapter implements ClipboardAdapter {
  constructor(
    private readonly clipboard: Pick<Clipboard, 'writeText'> | undefined = globalThis.navigator?.clipboard,
    private readonly secureContext: boolean = globalThis.isSecureContext === true
  ) {}
  async writeText(text: string): Promise<void> {
    if (typeof text !== 'string') throw new Error('Clipboard content must be text.');
    if (!this.secureContext || !this.clipboard?.writeText) throw new Error('Clipboard access is unavailable; use the export/download action instead.');
    await this.clipboard.writeText(text);
  }
}

export class BrowserShareAdapter implements ShareAdapter {
  constructor(private readonly host: Pick<Navigator, 'share' | 'canShare'> | undefined = typeof navigator === 'undefined' ? undefined : navigator,
    private readonly FileCtor: typeof File | undefined = typeof File === 'undefined' ? undefined : File) {}

  async share(input: { title: string; text?: string; file?: ProjectExportPayload }): Promise<ShareOutcome> {
    if (!this.host?.share) return 'UNSUPPORTED';
    let data: ShareData;
    if (input.file) {
      if (!this.FileCtor) return 'UNSUPPORTED';
      const buffer = Uint8Array.from(input.file.bytes).buffer;
      const file = new this.FileCtor([buffer], input.file.filename, { type: input.file.mimeType });
      const files: File[] = [file];
      if (this.host.canShare && !this.host.canShare({ files })) return 'UNSUPPORTED';
      data = { title: input.title, ...(input.text ? { text: input.text } : {}), files };
    } else {
      data = { title: input.title, ...(input.text ? { text: input.text } : {}) };
    }
    try { await this.host.share(data); return 'SHARED'; }
    catch (error) {
      const name = error instanceof DOMException ? error.name : (error as { name?: string } | null)?.name;
      if (name === 'AbortError') return 'CANCELLED';
      if (name === 'NotAllowedError' || name === 'SecurityError') return 'DENIED';
      throw error;
    }
  }
}

export class BrowserDownloadAdapter implements DownloadAdapter {
  constructor(
    private readonly documentHost: Document | undefined = typeof document === 'undefined' ? undefined : document,
    private readonly urlHost: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL,
    private readonly BlobCtor: typeof Blob = Blob,
    private readonly defer: (callback: () => void) => unknown = (callback) => setTimeout(callback, 0)
  ) {}

  async download(payload: ProjectExportPayload): Promise<void> {
    if (!this.documentHost?.body || !this.urlHost?.createObjectURL || !this.BlobCtor) throw new Error('Browser download is unavailable in this host.');
    if (!payload.filename || /[\\/\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(payload.filename)) throw new Error('Download filename is unsafe.');
    const blob = new this.BlobCtor([Uint8Array.from(payload.bytes).buffer], { type: payload.mimeType });
    const url = this.urlHost.createObjectURL(blob);
    const anchor = this.documentHost.createElement('a');
    anchor.href = url;
    anchor.download = payload.filename;
    anchor.rel = 'noopener';
    anchor.hidden = true;
    try {
      this.documentHost.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      this.defer(() => this.urlHost.revokeObjectURL(url));
    }
  }
}

export async function copyProjectPayload(adapter: ClipboardAdapter, payload: ProjectExportPayload, maxClipboardBytes = 2 * 1024 * 1024): Promise<void> {
  if (!Number.isSafeInteger(maxClipboardBytes) || maxClipboardBytes < 1) throw new Error('Clipboard limit is invalid.');
  if (payload.bytes.byteLength > maxClipboardBytes) throw new Error(`Copy exceeds the ${maxClipboardBytes}-byte clipboard limit; export the project as a file instead.`);
  await adapter.writeText(new TextDecoder().decode(payload.bytes));
}

export async function shareProjectPayload(adapter: ShareAdapter, payload: ProjectExportPayload, title: string): Promise<ShareOutcome> {
  if (!title.trim()) throw new Error('Share title is required.');
  return adapter.share({ title, file: payload });
}
