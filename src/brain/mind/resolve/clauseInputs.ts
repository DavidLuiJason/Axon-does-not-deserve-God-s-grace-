import { resolveClause } from './resolve';
import type { ResolveOptions, ResolveInput, ProvidedSlot } from './resolveTypes';
import type { AdapterInput, PieceInput, PieceResolution, PieceLike, WordLike, TokenLike, SegmentLike, ValueLike } from './clauseInputsTypes';

const EMPTY: ResolveInput = { act: 'unknown', polarity: 'positive', verbs: [], objects: [], names: [], provided: [] };
const array = <T>(value: unknown): readonly T[] => Array.isArray(value) ? value as readonly T[] : [];
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const ACT_LABELS = 'command ask greet thanks chat unknown';
const plainName = (value: string): boolean => {
  if (value.length === 0) return false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (!((code >= 97 && code <= 122) || (code >= 48 && code <= 57))) return false;
  }
  return true;
};

function validWord(value: unknown): value is WordLike {
  if (!value || typeof value !== 'object') return false;
  const w = value as WordLike;
  return typeof w.norm === 'string' && integer(w.start) && integer(w.end) && w.start >= 0 && w.end >= w.start;
}
function tokenFor(word: WordLike, tokens: readonly TokenLike[]): TokenLike | undefined {
  return tokens.find((token) => token && integer(token.start) && integer(token.end) && token.start >= word.start && token.start < word.end);
}
function validSpan(value: unknown, wordCount: number): value is { from: number; to: number } {
  if (!value || typeof value !== 'object') return false;
  const span = value as { from: number; to: number };
  return integer(span.from) && integer(span.to) && span.from >= 0 && span.to >= span.from && span.to <= wordCount;
}
function wordIndices(piece: PieceLike, words: readonly WordLike[]): number[] {
  const indices = new Set<number>();
  const spans: Array<{ from: number; to: number }> = [];
  if (piece.parts && validSpan(piece.parts.object, words.length)) spans.push(piece.parts.object);
  for (const detail of array<{ from: number; to: number }>(piece.parts?.details)) {
    if (detail && validSpan(detail, words.length)) spans.push(detail);
  }
  for (const span of spans) for (let i = span.from; i < span.to; i += 1) indices.add(i);
  return [...indices].sort((a, b) => a - b);
}
function valueKinds(kind: string): ProvidedSlot[] {
  switch (kind) {
    case 'number': case 'roman': return [{ kind: 'number' }];
    case 'percent': return [{ kind: 'number', value: 'percent' }];
    case 'quantity': return [{ kind: 'quantity', value: 'quantity' }];
    case 'duration': return [{ kind: 'duration', value: 'duration' }];
    case 'date': return [{ kind: 'date', value: 'date' }];
    case 'time': return [{ kind: 'time', value: 'time' }];
    case 'datetime': return [{ kind: 'date', value: 'date' }, { kind: 'time', value: 'time' }];
    default: return [];
  }
}

export function buildResolveInputs(input: AdapterInput): PieceInput[] {
  const rawPieces = array<PieceLike>(input && (input as AdapterInput).pieces);
  const tokens = array<TokenLike>((input as AdapterInput | null)?.tokens);
  const segments = array<SegmentLike>((input as AdapterInput | null)?.segments);
  const clauses = array<AdapterInput['clauses'][number]>((input as AdapterInput | null)?.clauses);
  const words = array<WordLike>((input as AdapterInput | null)?.words);
  const values = array<ValueLike>((input as AdapterInput | null)?.values);
  return rawPieces.map((rawPiece, pieceIndex) => {
    const piece = rawPiece && typeof rawPiece === 'object' ? rawPiece : {} as PieceLike;
    const from = integer(piece.from) && piece.from >= 0 && piece.from < words.length ? piece.from : -1;
    const to = integer(piece.to) && from >= 0 && piece.to >= from && piece.to <= words.length ? piece.to : -1;
    const validPiece = from >= 0 && to >= from;
    const safeWords = validPiece ? words.slice(from, to).filter(validWord) : [];
    const start = safeWords.length ? safeWords[0]!.start : -1;
    const end = safeWords.length ? safeWords[safeWords.length - 1]!.end : -1;
    const clauseIndex = integer(piece.clause) && piece.clause >= 0 ? piece.clause : -1;
    const clause = clauseIndex >= 0 ? clauses[clauseIndex] : undefined;
    const act = clause && ACT_LABELS.split(' ').includes(clause.act) ? clause.act as ResolveInput['act'] : 'unknown';
    const polarity = clause?.polarity === 'negative' ? 'negative' : 'positive';
    const verbs: string[] = [];
    if (validPiece && piece.parts && integer(piece.parts.verb) && piece.parts.verb >= from && piece.parts.verb < to) {
      const word = words[piece.parts.verb];
      if (validWord(word)) {
        const token = tokenFor(word, tokens);
        if (token && typeof token.lemma === 'string') verbs.push(`${token.lemma.toLowerCase()}:v`);
      }
    }
    const objects: string[] = [];
    const names: string[] = [];
    const seenObjects = new Set<string>();
    const seenNames = new Set<string>();
    if (validPiece) {
      const selected = wordIndices(piece, words);
      for (const wi of selected) {
        const word = words[wi];
        if (!validWord(word)) continue;
        const token = tokenFor(word, tokens);
        if (token && typeof token.lemma === 'string') {
          const lemma = token.lemma.toLowerCase();
          for (const pos of array<string>(token.partsOfSpeech).map((p) => typeof p === 'string' ? p.toLowerCase() : '')) {
            const key = pos.startsWith('n') ? `${lemma}:n` : (pos.startsWith('adj') || pos === 'a' || pos === 's') ? `${lemma}:a` : '';
            if (key && !seenObjects.has(key)) { seenObjects.add(key); objects.push(key); }
          }
        }
        for (const name of [word.norm.toLowerCase(), ...(token && typeof token.lemma === 'string' ? [token.lemma.toLowerCase()] : [])]) {
          if (plainName(name) && !seenNames.has(name)) { seenNames.add(name); names.push(name); }
        }
      }
    }
    const provided: Array<{ kind: ProvidedSlot['kind']; value?: ProvidedSlot['value']; start: number; order: number }> = [];
    if (start >= 0 && end >= start) {
      values.forEach((value, order) => {
        if (!value || typeof value.kind !== 'string' || !integer(value.start) || !integer(value.end) || value.start < start || value.end > end || value.end < value.start) return;
        for (const slot of valueKinds(value.kind)) provided.push({ kind: slot.kind, ...(slot.value === undefined ? {} : { value: slot.value }), start: value.start, order });
      });
      segments.forEach((segment, order) => {
        if (segment && segment.kind === 'material' && integer(segment.start) && integer(segment.end) && segment.start >= start && segment.end <= end && segment.end >= segment.start) {
          provided.push({ kind: 'text', start: segment.start, order: values.length + order });
        }
      });
    }
    provided.sort((a, b) => a.start - b.start || a.order - b.order);
    const inputValue: ResolveInput = validPiece ? { act, polarity, verbs, objects, names, provided: provided.map(({ kind, value }) => ({ kind, ...(value === undefined ? {} : { value }) })) } : { ...EMPTY, verbs: [], objects: [], names: [], provided: [] };
    return { piece: pieceIndex, clause: clauseIndex >= 0 ? clauseIndex : -1, mayRunAlone: piece.mayRunAlone === true, input: inputValue };
  });
}

export function resolveMessage(input: AdapterInput, options?: ResolveOptions): PieceResolution[] {
  return buildResolveInputs(input).map((piece) => ({ piece: piece.piece, clause: piece.clause, mayRunAlone: piece.mayRunAlone, resolution: resolveClause(piece.input, options) }));
}
