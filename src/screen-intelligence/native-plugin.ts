import { registerPlugin } from '@capacitor/core';

export interface NativeScreenCapturePlugin {
  getCapabilities(): Promise<Record<string, unknown>>;
  startSession(options?: { options?: Record<string, unknown> }): Promise<{ granted: boolean; state: string }>;
  stopSession(options?: { reason?: string }): Promise<void>;
  getStatus(): Promise<Record<string, unknown>>;
  listSegments(): Promise<{ segments: Array<Record<string, unknown>> }>;
  getStorageStats(): Promise<Record<string, unknown>>;
  listSessions(): Promise<{ sessions: Array<Record<string, unknown>> }>;
  deleteSession(options: { sessionId: string }): Promise<{ deleted: boolean; sessionId: string }>;
  addListener(eventName: string, listener: (event: Record<string, unknown>) => void): Promise<{ remove: () => Promise<void> }>;
}

export const NativeScreenCapture = registerPlugin<NativeScreenCapturePlugin>('ScreenCapture');
