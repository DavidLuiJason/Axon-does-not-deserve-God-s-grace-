// BUD6 FIXTURE (Director, 2026-11-06). The real capacity log as numbers. Read-only for builders.
// null = the log does not say. A value is entered only where the row's result plausibly depends on it.
// Sources: docs/AI_CAPACITY.md, docs/DIRECTOR_LIMITS.md, docs/JOB_BOARD.md, MERGE_TAG.txt, docs/reports/BATCH*.
type R = Record<string, unknown>;
function row(id: string, date: string, builder: string, mode: string, cards: number, accepted: number | null,
  promptChars: number | null, miniBaseFiles: number | null, filesReturned: number | null,
  directorCommands: number | null, directorTurns: number | null, outcome: string, source: string): R {
  return { id, date, builder, mode, cards, accepted, promptChars, miniBaseFiles, filesReturned, directorCommands, directorTurns, outcome, source };
}
export const BUILDER_LOG_ROWS: readonly R[] = Object.freeze([
  row('gpt-b03b1-onepiece', '2026-10-24', 'ChatGPT', 'A', 1, 0, 38000, null, null, null, null, 'FAILED', 'REPORTED'),
  row('gpt-wholezip', '2026-10-24', 'ChatGPT', 'A', 1, 0, null, null, null, null, null, 'FAILED', 'REPORTED'),
  row('gpt-b03b1b', '2026-10-24', 'ChatGPT', 'A', 1, null, null, null, null, null, null, 'PARTIAL', 'REPORTED'),
  row('gpt-b03b1abc', '2026-10-24', 'ChatGPT', 'A', 3, 3, 16000, 10, null, null, null, 'OK', 'REPORTED'),
  row('gpt-b03b3c', '2026-10-25', 'ChatGPT', 'A', 1, 1, null, 6, 1, null, null, 'OK', 'REPORTED'),
  row('gpt-b03b3d', '2026-10-25', 'ChatGPT', 'A', 1, 1, 14044, 7, 1, null, null, 'OK', 'REPORTED'),
  row('gpt-batch1', '2026-11-03', 'ChatGPT', 'B', 6, 6, null, null, 22, null, null, 'OK', 'MEASURED'),
  row('gpt-batch2', '2026-11-04', 'ChatGPT', 'B', 6, 6, null, null, 18, null, null, 'OK', 'REPORTED'),
  row('gpt-batch3', '2026-11-04', 'ChatGPT', 'B', 6, 6, null, null, 18, null, null, 'OK', 'REPORTED'),
  row('gpt-batch4', '2026-11-04', 'ChatGPT', 'B', 6, 6, null, null, 18, null, null, 'OK', 'MEASURED'),
  row('gpt-batch5', '2026-11-04', 'ChatGPT', 'B', 6, 6, null, null, 18, null, null, 'OK', 'REPORTED'),
  row('gpt-batch6-first', '2026-11-05', 'ChatGPT', 'B', 6, 0, 28000, null, null, null, null, 'FAILED', 'REPORTED'),
  row('gpt-batch6-second', '2026-11-05', 'ChatGPT', 'B', 6, 3, null, null, null, null, null, 'PARTIAL', 'REPORTED'),
  row('gpt-batch6b-j2', '2026-11-05', 'ChatGPT', 'B', 1, 1, null, null, 3, null, null, 'OK', 'MEASURED'),
  row('gpt-j4', '2026-11-05', 'ChatGPT', 'A', 1, 1, null, null, 3, null, null, 'OK', 'MEASURED'),
  row('gpt-chr2', '2026-11-06', 'ChatGPT', 'A', 1, 1, 12920, null, 3, null, null, 'OK', 'MEASURED'),
  row('gpt-bud2', '2026-11-06', 'ChatGPT', 'A', 1, 1, null, null, 7, null, null, 'OK', 'MEASURED'),
  row('gpt-bud3', '2026-11-06', 'ChatGPT', 'A', 1, 1, null, null, 3, null, null, 'OK', 'MEASURED'),
  row('grok-b03b1', '2026-10-24', 'Grok', 'A', 1, 0, 38000, null, null, null, null, 'PARTIAL', 'REPORTED'),
  row('dir-b04b4-one', '2026-10-27', 'Claude', 'D', 1, null, null, null, null, null, null, 'FAILED', 'REPORTED'),
  row('dir-b04b4p1', '2026-10-27', 'Claude', 'D', 1, null, null, null, null, 12, null, 'OK', 'REPORTED'),
  row('dir-b04b4p2', '2026-10-27', 'Claude', 'D', 1, null, null, null, null, 24, null, 'PARTIAL', 'REPORTED'),
  row('dir-b04b4p3a', '2026-10-27', 'Claude', 'D', 1, null, null, null, null, 6, null, 'OK', 'REPORTED'),
  row('dir-v19-6', '2026-10-27', 'Claude', 'D', 1, null, null, null, null, 17, null, 'OK', 'REPORTED'),
  row('dir-b04b4p4', '2026-10-28', 'Claude', 'D', 1, null, null, null, null, 14, null, 'OK', 'REPORTED'),
  row('dir-v19-8', '2026-10-28', 'Claude', 'D', 1, null, null, null, null, 20, null, 'OK', 'REPORTED'),
  row('dir-b04c-c0a', '2026-10-28', 'Claude', 'D', 1, null, null, null, null, 14, null, 'OK', 'REPORTED'),
  row('dir-26th', '2026-11-01', 'Claude', 'D', 1, null, null, null, null, 30, null, 'OK', 'REPORTED'),
  row('dir-43', '2026-11-01', 'Claude', 'D', 1, null, null, null, null, 43, null, 'OK', 'REPORTED'),
  row('dir-downscale', '2026-11-03', 'Claude', 'D', 1, null, null, null, null, 24, null, 'OK', 'REPORTED'),
]);
