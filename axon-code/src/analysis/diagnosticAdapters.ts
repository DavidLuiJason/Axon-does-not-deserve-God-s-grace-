import { redactDiagnostics } from '../security/securityArtifactRedaction.js';
import type { CodeDiagnostic, LanguageDiagnosticAdapter, SourceLanguage } from '../types.js';

export class DiagnosticAdapterRegistry {
  private readonly adapters = new Map<string, LanguageDiagnosticAdapter>();

  register(adapter: LanguageDiagnosticAdapter): void {
    if (!adapter.id.trim()) throw new Error('Diagnostic adapter ID is required.');
    if (this.adapters.has(adapter.id)) throw new Error(`Diagnostic adapter '${adapter.id}' is already registered.`);
    this.adapters.set(adapter.id, adapter);
  }

  async analyze(language: SourceLanguage, filePath: string, source: string): Promise<CodeDiagnostic[]> {
    const results: CodeDiagnostic[] = [];
    for (const adapter of this.adapters.values()) {
      if (!adapter.supports(language)) continue;
      const diagnostics = await adapter.analyze(filePath, source);
      for (const diagnostic of diagnostics) {
        if (diagnostic.location && diagnostic.location.file !== filePath) {
          throw new Error(`Diagnostic adapter '${adapter.id}' returned a location for a different file.`);
        }
        results.push({ ...diagnostic, ...(diagnostic.related ? { related: [...diagnostic.related] } : {}) });
      }
    }
    const unique = new Map<string, CodeDiagnostic>();
    for (const item of results) {
      const key = `${item.code}|${item.location?.file ?? ''}|${item.location?.line ?? 0}|${item.location?.column ?? 0}|${item.message}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    return redactDiagnostics([...unique.values()]);
  }

  list(): string[] { return [...this.adapters.keys()].sort(); }
}

export interface ParserBenchmarkCase {
  file: string;
  language: SourceLanguage;
  source: string;
  expected: readonly { code: string; line?: number }[];
}

export interface ParserBenchmarkCandidate {
  id: string;
  packageSizeBytes: number | null;
  adapter: LanguageDiagnosticAdapter;
}

export interface ParserBenchmarkResult {
  id: string;
  packageSizeBytes: number | null;
  elapsedMs: number;
  scannedBytes: number;
  expectedCount: number;
  detectedCount: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  evidence: 'MEASURED_IN_CURRENT_HOST';
}

/** AC1M measurement harness. It measures supplied candidates; it does not choose a parser automatically. */
export async function benchmarkParserCandidates(
  candidates: readonly ParserBenchmarkCandidate[],
  corpus: readonly ParserBenchmarkCase[],
  now: () => number = () => globalThis.performance?.now?.() ?? Date.now()
): Promise<ParserBenchmarkResult[]> {
  if (!candidates.length || !corpus.length) throw new Error('At least one parser candidate and one benchmark case are required.');
  const results: ParserBenchmarkResult[] = [];
  for (const candidate of candidates) {
    if (!candidate.id.trim() || (candidate.packageSizeBytes !== null && (!Number.isFinite(candidate.packageSizeBytes) || candidate.packageSizeBytes < 0))) {
      throw new Error('Parser candidate metadata is invalid.');
    }
    const started = now();
    let scannedBytes = 0;
    const expectedKeys = new Set<string>();
    const detectedKeys = new Set<string>();
    for (const testCase of corpus) {
      if (!candidate.adapter.supports(testCase.language)) continue;
      scannedBytes += new TextEncoder().encode(testCase.source).byteLength;
      for (const expected of testCase.expected) expectedKeys.add(`${testCase.file}|${expected.code}|${expected.line ?? 0}`);
      const diagnostics = await candidate.adapter.analyze(testCase.file, testCase.source);
      for (const diagnostic of diagnostics) {
        detectedKeys.add(`${testCase.file}|${diagnostic.code}|${diagnostic.location?.line ?? 0}`);
      }
    }
    let truePositive = 0;
    for (const key of detectedKeys) if (expectedKeys.has(key)) truePositive += 1;
    const falsePositive = [...detectedKeys].filter((key) => !expectedKeys.has(key)).length;
    const falseNegative = [...expectedKeys].filter((key) => !detectedKeys.has(key)).length;
    const precision = truePositive + falsePositive === 0 ? (expectedKeys.size === 0 ? 1 : 0) : truePositive / (truePositive + falsePositive);
    const recall = truePositive + falseNegative === 0 ? 1 : truePositive / (truePositive + falseNegative);
    results.push({ id: candidate.id, packageSizeBytes: candidate.packageSizeBytes, elapsedMs: Math.max(0, now() - started), scannedBytes,
      expectedCount: expectedKeys.size, detectedCount: detectedKeys.size, truePositive, falsePositive, falseNegative,
      precision, recall, evidence: 'MEASURED_IN_CURRENT_HOST' });
  }
  return results.sort((a, b) => a.elapsedMs - b.elapsedMs || a.id.localeCompare(b.id));
}
