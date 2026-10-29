/** Pure, bounded manifest and block verification for AXON knowledge shelves. */
export const SHELF_LIMITS = Object.freeze({
  maxBlocks: 10_000,
  maxSources: 1_000,
  maxIndexEntries: 10_000,
  maxStringLength: 4_096,
  maxTotalDeclaredBytes: 512 * 1024 * 1024,
  maxItemsPerBlock: 1_000_000,
});

export type ShelfState = 'CANDIDATE' | 'CHECKED' | 'ADMITTED';
export type ShelfSource = { name: string; licence: string; retrieved: string };
export type ShelfBlock = { id: string; file: string; bytes: number; sha256: string; items: number };
export type ShelfIndexEntry = { blockId: string; firstKey: string; lastKey: string };
export type ShelfManifest = {
  shelfId: string; title: string; version: string; state: ShelfState;
  sources: ShelfSource[]; counts: { items: number; blocks: number };
  blocks: ShelfBlock[]; index: ShelfIndexEntry[];
  testSet: { file: string; sha256: string };
  killSwitch: { off: boolean; reason?: string };
};
export type Gap = { code: string; path: string; message: string };
export type BlockVerification = { blockId: string; file: string; ok: boolean; missing: boolean; tampered: boolean; sizeDiffers: boolean; message: string };
export type VerifyReport = { ok: boolean; shelfId: string; blocks: BlockVerification[]; gaps: Gap[]; message: string };
export type Evidence = {
  independentConfirmation?: { sourceName: string; recordId: string; confirmed: boolean };
  knownAnswerTest?: { testSetFile: string; passed: boolean; resultId: string };
  ownerApproval?: { sourceName: string; recordId: string; approved: boolean };
};
export type PromotionResult = { ok: true; manifest: ShelfManifest } | { ok: false; error: 'invalid-manifest' | 'illegal-transition' | 'missing-evidence' | 'invalid-target'; gaps?: Gap[]; message: string };
export type DemotionResult = { ok: true; manifest: ShelfManifest } | { ok: false; error: 'invalid-reason' | 'invalid-manifest'; gaps?: Gap[]; message: string };
export type StartupShelf = { name: string; manifest: ShelfManifest | null; verify?: VerifyReport | null };
export type StartupDeps = { verifyShelf?: (manifest: ShelfManifest) => VerifyReport; isPresent?: (shelf: StartupShelf) => boolean };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= SHELF_LIMITS.maxStringLength && v.trim().length > 0;
const isHash = (v: unknown): v is string => typeof v === 'string' && /^[a-fA-F0-9]{64}$/.test(v);
const isNonNegativeInt = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const gap = (code: string, path: string, message: string): Gap => ({ code, path, message });

/** Reports every discoverable structural issue, including hostile runtime values; never throws. */
export function validateManifest(m: unknown): Gap[] {
  const gaps: Gap[] = [];
  try {
    if (!isRecord(m)) return [gap('manifest-type', '$', 'Manifest must be an object.')];
    for (const key of ['shelfId', 'title', 'version'] as const) if (!isText(m[key])) gaps.push(gap('required-text', key, `${key} must be a non-empty bounded string.`));
    if (!['CANDIDATE', 'CHECKED', 'ADMITTED'].includes(String(m.state))) gaps.push(gap('invalid-state', 'state', 'State must be CANDIDATE, CHECKED, or ADMITTED.'));
    if (!Array.isArray(m.sources)) gaps.push(gap('sources-type', 'sources', 'Sources must be an array.'));
    else {
      if (m.sources.length > SHELF_LIMITS.maxSources) gaps.push(gap('sources-limit', 'sources', 'Source count exceeds the configured limit.'));
      if (m.sources.length === 0) gaps.push(gap('no-source', 'sources', 'At least one recorded source is required.'));
      m.sources.slice(0, SHELF_LIMITS.maxSources).forEach((s: unknown, i: number) => {
        if (!isRecord(s)) { gaps.push(gap('source-type', `sources[${i}]`, 'Source must be an object.')); return; }
        for (const k of ['name', 'licence', 'retrieved'] as const) if (!isText(s[k])) gaps.push(gap(k === 'licence' ? 'no-licence' : 'source-field', `sources[${i}].${k}`, `${k} must be a non-empty bounded string.`));
      });
    }
    const counts = isRecord(m.counts) ? m.counts : null;
    if (!counts) gaps.push(gap('counts-type', 'counts', 'Counts must be an object.'));
    else {
      if (!isNonNegativeInt(counts.items)) gaps.push(gap('items-count', 'counts.items', 'Item count must be a non-negative safe integer.'));
      if (!isNonNegativeInt(counts.blocks)) gaps.push(gap('blocks-count', 'counts.blocks', 'Block count must be a non-negative safe integer.'));
    }
    if (!Array.isArray(m.blocks)) gaps.push(gap('blocks-type', 'blocks', 'Blocks must be an array.'));
    else {
      if (m.blocks.length > SHELF_LIMITS.maxBlocks) gaps.push(gap('blocks-limit', 'blocks', 'Block count exceeds SHELF_LIMITS.'));
      if (counts && isNonNegativeInt(counts.blocks) && counts.blocks !== m.blocks.length) gaps.push(gap('blocks-count-mismatch', 'counts.blocks', 'Declared block count does not match the blocks array.'));
      let sum = 0; let totalBytes = 0; const ids = new Set<string>();
      m.blocks.slice(0, SHELF_LIMITS.maxBlocks).forEach((b: unknown, i: number) => {
        const p = `blocks[${i}]`;
        if (!isRecord(b)) { gaps.push(gap('block-type', p, 'Block must be an object.')); return; }
        if (!isText(b.id)) gaps.push(gap('block-id', `${p}.id`, 'Block id must be a non-empty bounded string.'));
        else if (ids.has(b.id)) gaps.push(gap('duplicate-block-id', `${p}.id`, `Duplicate block id: ${b.id}.`)); else ids.add(b.id);
        if (!isText(b.file)) gaps.push(gap('block-file', `${p}.file`, 'Block file must be a non-empty bounded string.'));
        if (!isNonNegativeInt(b.bytes)) gaps.push(gap('block-bytes', `${p}.bytes`, 'Block bytes must be a non-negative safe integer.'));
        else { totalBytes += b.bytes; if (!Number.isSafeInteger(totalBytes) || totalBytes > SHELF_LIMITS.maxTotalDeclaredBytes) gaps.push(gap('declared-size-limit', p, 'Total declared block bytes exceed SHELF_LIMITS.')); }
        if (!isHash(b.sha256)) gaps.push(gap('bad-sha256', `${p}.sha256`, 'SHA-256 must be exactly 64 hexadecimal characters.'));
        if (!isNonNegativeInt(b.items) || (b.items as number) > SHELF_LIMITS.maxItemsPerBlock) gaps.push(gap('block-items', `${p}.items`, 'Block item count must be a bounded non-negative safe integer.'));
        else sum += b.items as number;
      });
      if (counts && isNonNegativeInt(counts.items) && counts.items !== sum) gaps.push(gap('items-count-mismatch', 'counts.items', 'Declared item count does not equal the sum of block item counts.'));
      if (!Array.isArray(m.index)) gaps.push(gap('index-type', 'index', 'Index must be an array.'));
      else {
        if (m.index.length > SHELF_LIMITS.maxIndexEntries) gaps.push(gap('index-limit', 'index', 'Index entry count exceeds SHELF_LIMITS.'));
        const blockIds = new Set<string>(m.blocks.slice(0, SHELF_LIMITS.maxBlocks).filter(isRecord).map((b: Record<string, unknown>) => b.id).filter((id: unknown): id is string => typeof id === 'string'));
        const indexed = new Set<string>(); let previousLast: string | null = null;
        m.index.slice(0, SHELF_LIMITS.maxIndexEntries).forEach((e: unknown, i: number) => {
          const p = `index[${i}]`;
          if (!isRecord(e)) { gaps.push(gap('index-entry-type', p, 'Index entry must be an object.')); return; }
          if (!isText(e.blockId)) gaps.push(gap('index-block-id', `${p}.blockId`, 'Index blockId must be a non-empty string.'));
          else {
            if (!blockIds.has(e.blockId)) gaps.push(gap('index-missing-block', `${p}.blockId`, `Index points to missing block: ${e.blockId}.`));
            if (indexed.has(e.blockId)) gaps.push(gap('duplicate-index-entry', `${p}.blockId`, `Block ${e.blockId} is indexed more than once.`));
            indexed.add(e.blockId);
          }
          if (!isText(e.firstKey) || !isText(e.lastKey)) { gaps.push(gap('index-key', p, 'Index key range must have non-empty bounded keys.')); return; }
          if (e.firstKey > e.lastKey) gaps.push(gap('reversed-key-range', p, 'Index firstKey must not sort after lastKey.'));
          if (previousLast !== null && e.firstKey <= previousLast) gaps.push(gap('overlapping-or-unsorted-index', p, 'Index ranges must be strictly sorted and non-overlapping.'));
          previousLast = e.lastKey;
        });
        for (const id of blockIds) if (!indexed.has(id)) gaps.push(gap('index-gap', 'index', `Block ${id} has no index entry.`));
      }
    }
    if (!isRecord(m.testSet)) gaps.push(gap('test-set-type', 'testSet', 'Test set must be an object.'));
    else {
      if (!isText(m.testSet.file)) gaps.push(gap('empty-test-set', 'testSet.file', 'Test set file must be non-empty.'));
      if (!isHash(m.testSet.sha256)) gaps.push(gap('test-set-sha256', 'testSet.sha256', 'Test set SHA-256 must be 64 hexadecimal characters.'));
    }
    if (!isRecord(m.killSwitch) || typeof m.killSwitch.off !== 'boolean') gaps.push(gap('kill-switch-type', 'killSwitch', 'Kill switch must contain a boolean off value.'));
    else if (m.killSwitch.off && m.killSwitch.reason !== undefined && (typeof m.killSwitch.reason !== 'string' || m.killSwitch.reason.length > SHELF_LIMITS.maxStringLength)) gaps.push(gap('kill-switch-reason', 'killSwitch.reason', 'Kill-switch reason must be a bounded string when supplied.'));
  } catch {
    gaps.push(gap('validation-internal', '$', 'Manifest contains hostile data that could not be fully inspected.'));
  }
  return gaps;
}

export function verifyShelf(m: unknown, readBlock: (file: string) => Uint8Array | null, sha256: (bytes: Uint8Array) => string): VerifyReport {
  const gaps = validateManifest(m);
  if (!isRecord(m)) return { ok: false, shelfId: 'unknown', blocks: [], gaps, message: 'Shelf manifest is invalid; loading is blocked.' };
  const results: BlockVerification[] = [];
  if (!Array.isArray(m.blocks) || m.blocks.length > SHELF_LIMITS.maxBlocks) return { ok: false, shelfId: typeof m.shelfId === 'string' ? m.shelfId : 'unknown', blocks: [], gaps, message: 'Shelf block list is invalid or exceeds limits; loading is blocked.' };
  for (let i = 0; i < m.blocks.length; i++) {
    const b = m.blocks[i];
    if (!isRecord(b) || typeof b.id !== 'string' || typeof b.file !== 'string') { results.push({ blockId: `invalid-${i}`, file: '', ok: false, missing: false, tampered: true, sizeDiffers: false, message: `Block entry ${i} is malformed.` }); continue; }
    let bytes: Uint8Array | null;
    try { bytes = readBlock(b.file); } catch { bytes = null; }
    if (bytes === null) { results.push({ blockId: b.id, file: b.file, ok: false, missing: true, tampered: false, sizeDiffers: false, message: `Missing block ${b.id} (${b.file}).` }); continue; }
    if (!(bytes instanceof Uint8Array)) { results.push({ blockId: b.id, file: b.file, ok: false, missing: false, tampered: true, sizeDiffers: false, message: `Block ${b.id} (${b.file}) did not return bytes.` }); continue; }
    const sizeDiffers = !Number.isSafeInteger(b.bytes) || bytes.byteLength !== b.bytes;
    let actualHash = '';
    try { actualHash = sha256(bytes); } catch { actualHash = ''; }
    const tampered = !isHash(b.sha256) || !isHash(actualHash) || actualHash.toLowerCase() !== String(b.sha256).toLowerCase();
    const ok = !sizeDiffers && !tampered;
    results.push({ blockId: b.id, file: b.file, ok, missing: false, tampered, sizeDiffers, message: ok ? `Block ${b.id} verified.` : `Block ${b.id} (${b.file}) failed verification${sizeDiffers ? ': size differs' : ''}${sizeDiffers && tampered ? ' and' : ''}${tampered ? ': SHA-256 differs or is invalid' : ''}.` });
  }
  const ok = gaps.length === 0 && results.every(r => r.ok);
  return { ok, shelfId: typeof m.shelfId === 'string' ? m.shelfId : 'unknown', blocks: results, gaps, message: ok ? `Shelf ${String(m.shelfId)} verified.` : `Shelf ${typeof m.shelfId === 'string' ? m.shelfId : 'unknown'} blocked: ${[...gaps.map(g => g.message), ...results.filter(r => !r.ok).map(r => r.message)].join(' ')}` };
}

export function findBlock(index: unknown, key: unknown): string | null {
  if (!Array.isArray(index) || typeof key !== 'string' || key.length === 0 || index.length > SHELF_LIMITS.maxIndexEntries) return null;
  let low = 0, high = index.length - 1;
  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2); const e = index[mid];
    if (!isRecord(e) || typeof e.firstKey !== 'string' || typeof e.lastKey !== 'string' || typeof e.blockId !== 'string') return null;
    if (key < e.firstKey) high = mid - 1;
    else if (key > e.lastKey) low = mid + 1;
    else return e.blockId;
  }
  return null;
}

function cloneManifest(m: ShelfManifest, state: ShelfState): ShelfManifest {
  return { ...m, state, sources: m.sources.map(s => ({ ...s })), counts: { ...m.counts }, blocks: m.blocks.map(b => ({ ...b })), index: m.index.map(e => ({ ...e })), testSet: { ...m.testSet }, killSwitch: { ...m.killSwitch } };
}
export function promote(m: unknown, to: ShelfState, evidence: Evidence): PromotionResult {
  const gaps = validateManifest(m);
  if (gaps.length) return { ok: false, error: 'invalid-manifest', gaps, message: 'Promotion refused: manifest validation failed.' };
  if (!isRecord(m) || !['CANDIDATE', 'CHECKED', 'ADMITTED'].includes(String(to))) return { ok: false, error: 'invalid-target', message: 'Promotion target is invalid.' };
  const from = m.state as ShelfState;
  if (!((from === 'CANDIDATE' && to === 'CHECKED') || (from === 'CHECKED' && to === 'ADMITTED'))) return { ok: false, error: 'illegal-transition', message: `Promotion from ${from} to ${to} is not allowed.` };
  if (from === 'CANDIDATE') {
    const sourceNames = (m.sources as ShelfSource[]).map(s => s.name);
    const c = evidence?.independentConfirmation, t = evidence?.knownAnswerTest;
    if (!c || !isText(c.recordId) || !c.confirmed || !isText(c.sourceName) || !sourceNames.includes(c.sourceName) || !t || !isText(t.resultId) || !t.passed || t.testSetFile !== (m.testSet as { file: string }).file) return { ok: false, error: 'missing-evidence', message: 'CANDIDATE to CHECKED requires independent confirmation of a recorded source and a passing known-answer test for this test set.' };
  } else {
    const a = evidence?.ownerApproval; const sourceNames = (m.sources as ShelfSource[]).map(s => s.name);
    if (!a || !isText(a.recordId) || !a.approved || !isText(a.sourceName) || !sourceNames.includes(a.sourceName)) return { ok: false, error: 'missing-evidence', message: 'CHECKED to ADMITTED requires owner approval naming a recorded source.' };
  }
  return { ok: true, manifest: cloneManifest(m as unknown as ShelfManifest, to) };
}
export function demote(m: unknown, reason: string): DemotionResult {
  const gaps = validateManifest(m);
  if (gaps.length) return { ok: false, error: 'invalid-manifest', gaps, message: 'Demotion refused: manifest validation failed.' };
  if (!isText(reason)) return { ok: false, error: 'invalid-reason', message: 'A non-empty reason is required for demotion.' };
  const next = cloneManifest(m as unknown as ShelfManifest, 'CANDIDATE');
  next.killSwitch = { off: true, reason };
  return { ok: true, manifest: next };
}
export function canLoad(m: unknown): boolean {
  if (validateManifest(m).length || !isRecord(m) || m.state !== 'ADMITTED' || !isRecord(m.killSwitch)) return false;
  return m.killSwitch.off === false;
}
export function startupSelfCheck(shelves: readonly StartupShelf[], deps: StartupDeps = {}): string[] {
  const lines: string[] = [];
  if (!Array.isArray(shelves)) return ['Startup self-check damaged: shelf list is invalid.'];
  const limit = Math.min(shelves.length, SHELF_LIMITS.maxBlocks);
  for (let i = 0; i < limit; i++) {
    const s = shelves[i];
    if (!isRecord(s) || typeof s.name !== 'string' || !s.name.trim()) { lines.push(`Shelf entry ${i} damaged: missing shelf name.`); continue; }
    if (deps.isPresent) { let present = false; try { present = deps.isPresent(s as unknown as StartupShelf); } catch { present = false; } if (!present) { lines.push(`Shelf ${s.name} blocked: shelf is missing.`); continue; } }
    if (!s.manifest) { lines.push(`Shelf ${s.name} blocked: shelf is missing.`); continue; }
    const gaps = validateManifest(s.manifest);
    if (gaps.length) { lines.push(`Shelf ${s.name} damaged: invalid manifest (${gaps[0].path}: ${gaps[0].message}).`); continue; }
    if (!canLoad(s.manifest)) {
      const m = s.manifest as ShelfManifest;
      if (m.killSwitch.off) lines.push(`Shelf ${s.name} blocked: kill switch is off${m.killSwitch.reason ? ` (${m.killSwitch.reason})` : ''}.`);
      else lines.push(`Shelf ${s.name} blocked: state is ${m.state}; ADMITTED is required.`);
      continue;
    }
    const manifestValue = s.manifest as ShelfManifest;
    let report: VerifyReport | null | undefined = s.verify as VerifyReport | null | undefined;
    if (deps.verifyShelf) { try { report = deps.verifyShelf(manifestValue); } catch { report = null; } }
    if (!report) { lines.push(`Shelf ${s.name} damaged: integrity check did not return a report.`); continue; }
    if (!report.ok) {
      const bad = report.blocks.find(b => !b.ok);
      lines.push(bad ? `Shelf ${s.name} damaged: ${bad.message}` : `Shelf ${s.name} damaged: ${report.message}`);
      continue;
    }
    lines.push(`Shelf ${s.name} loaded: admitted and integrity-checked.`);
  }
  if (shelves.length > SHELF_LIMITS.maxBlocks) lines.push(`Startup self-check damaged: shelf count exceeds limit ${SHELF_LIMITS.maxBlocks}; remaining shelves were not checked.`);
  return lines;
}
