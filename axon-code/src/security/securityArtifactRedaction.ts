import { redactSensitiveData, redactSensitiveText, type RedactionContext } from './secretRedactor.js';
import type { CodeDiagnostic } from '../types.js';

/** Central boundary for diagnostic, logger and crash-report payloads before persistence/export. */
export function redactDiagnostic<T extends CodeDiagnostic>(diagnostic: T): T {
  return redactSensitiveData(diagnostic, 'diagnostics');
}

export function redactDiagnostics<T extends readonly CodeDiagnostic[]>(diagnostics: T): T {
  return diagnostics.map((item) => redactDiagnostic(item)) as unknown as T;
}

export interface CrashReportInput {
  id: string;
  occurredAt: number;
  appVersion: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

export interface SafeCrashReport extends Omit<CrashReportInput, 'message' | 'stack' | 'context'> {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  redaction: 'APPLIED';
}

export function prepareCrashReport(input: CrashReportInput): SafeCrashReport {
  if (!input || typeof input.id !== 'string' || !input.id.trim() || !Number.isFinite(input.occurredAt) ||
      typeof input.appVersion !== 'string' || typeof input.message !== 'string') {
    throw new Error('Crash report metadata is invalid.');
  }
  const safe = redactSensitiveData({
    ...input,
    message: redactSensitiveText(input.message, 'crash-reports'),
    ...(input.stack !== undefined ? { stack: redactSensitiveText(input.stack, 'crash-reports') } : {}),
  }, 'crash-reports');
  return { ...safe, redaction: 'APPLIED' };
}

export function prepareLogRecord<T>(record: T): T {
  return redactSensitiveData(record, 'logs');
}

export function prepareDiagnosticExport<T>(payload: T): T {
  return redactSensitiveData(payload, 'diagnostics');
}

export function redactSecurityText(value: string, context: RedactionContext): string {
  return redactSensitiveText(value, context);
}
