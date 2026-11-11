import type { CodeDiagnostic } from '../types.js';
import { prepareCrashReport, prepareDiagnosticExport, prepareLogRecord, type CrashReportInput, type SafeCrashReport } from './securityArtifactRedaction.js';

export interface SecurityTelemetrySink {
  writeLog(record: Readonly<Record<string, unknown>>): Promise<void> | void;
  writeDiagnostics(records: readonly CodeDiagnostic[]): Promise<void> | void;
  writeCrashReport(report: SafeCrashReport): Promise<void> | void;
}

/** Mandatory serialization boundary: raw secrets never reach the configured telemetry sink. */
export class SafeTelemetryBoundary {
  constructor(private readonly sink: SecurityTelemetrySink) {}
  async log(record: Record<string, unknown>): Promise<void> { await this.sink.writeLog(prepareLogRecord(record)); }
  async diagnostics(records: readonly CodeDiagnostic[]): Promise<void> { await this.sink.writeDiagnostics(prepareDiagnosticExport(records)); }
  async crash(input: CrashReportInput): Promise<void> { await this.sink.writeCrashReport(prepareCrashReport(input)); }
}
