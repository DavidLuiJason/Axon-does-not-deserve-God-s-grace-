// P10 PER-TOOL VERIFIERS (pure). A second, independent path for a tool's answer: re-extract the quoted text from the owner's
// message, recompute the answer a different way, and compare with what the tool's reply says it produced.
// If the answer cannot be rechecked this way, `check` is null and the result stays UNVERIFIED. It never guesses.
export type ToolCheck = null | { readonly kind: 'RECOMPUTE'; readonly value: string };
export type ToolVerification = { readonly output: string; readonly check: ToolCheck; readonly note: string };

export type QuotedText = { readonly kind: 'one'; readonly text: string } | { readonly kind: 'none' } | { readonly kind: 'many' } | { readonly kind: 'open' };

/** The single quoted span of a message ("..." or curly quotes). More than one, or a quote left open, is ambiguous. */
export function quotedText(message: string): QuotedText {
  const spans: string[] = [];
  let mode: '' | 's' | 'c' = '';
  let cur = '';
  for (const ch of message) {
    if (mode === '') {
      if (ch === '"') { mode = 's'; cur = ''; } else if (ch === '\u201c') { mode = 'c'; cur = ''; }
    } else if ((mode === 's' && ch === '"') || (mode === 'c' && ch === '\u201d')) { spans.push(cur); mode = ''; } else cur += ch;
  }
  if (mode !== '') return { kind: 'open' };
  if (spans.length === 0) return { kind: 'none' };
  if (spans.length > 1) return { kind: 'many' };
  return { kind: 'one', text: spans[0] };
}

/** Counts by walking the text once (a different path from the tool's own split-and-filter code). */
export function recount(text: string): { words: number; characters: number; noSpaces: number; letters: number; lines: number } {
  let characters = 0, noSpaces = 0, letters = 0, words = 0, breaks = 0;
  let inWord = false;
  let previous = '';
  for (const ch of text) {
    characters++;
    const space = /\s/u.test(ch);
    if (!space) { noSpaces++; if (!inWord) { words++; inWord = true; } } else inWord = false;
    if (/\p{L}/u.test(ch)) letters++;
    if (ch === '\n' || (ch === '\r')) { if (!(ch === '\n' && previous === '\r')) breaks++; }
    previous = ch;
  }
  const endsWithBreak = text.endsWith('\n') || text.endsWith('\r');
  const lines = text === '' ? 0 : breaks + (endsWithBreak ? 0 : 1);
  return { words, characters, noSpaces, letters, lines };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) as number;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
/** Base64 of a text, without padding. */
export function base64NoPad(s: string): string {
  const b = utf8Bytes(s);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < b.length) out += B64[(n >> 6) & 63];
    if (i + 2 < b.length) out += B64[n & 63];
  }
  return out;
}
const noPad = (s: string): string => s.trim().replace(/=+$/, '');

const none = (note: string, output = ''): ToolVerification => ({ output, check: null, note });

function verifyTextCounter(payload: string, reply: string): ToolVerification {
  const w = /^Words: (\d+)$/m.exec(reply), c = /^Characters: (\d+) \((\d+) without spaces\)$/m.exec(reply), l = /^Letters: (\d+)$/m.exec(reply), n = /^Lines: (\d+)$/m.exec(reply);
  if (!w || !c || !l || !n) return none('the reply does not show all four counts');
  const claimed = `W=${w[1]};C=${c[1]};NS=${c[2]};L=${l[1]};LN=${n[1]}`;
  const r = recount(payload);
  return { output: claimed, check: { kind: 'RECOMPUTE', value: `W=${r.words};C=${r.characters};NS=${r.noSpaces};L=${r.letters};LN=${r.lines}` }, note: 'recounted from the quoted text' };
}

function verifySortLines(payload: string, reply: string): ToolVerification {
  const m = /\(text: [\s\S]*?, mode: (ascending|descending)\)\.[^\n]*\n\n([\s\S]*)\nLine count: (\d+)\.\n\nRan as task/.exec(reply);
  if (!m) return none('the reply is not in the ascending or descending sort format');
  const lines = payload.split(/\r\n|\n|\r/);
  const sorted = [...lines].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (m[1] === 'descending') sorted.reverse();
  return { output: `${m[2]}\u0000${m[3]}`, check: { kind: 'RECOMPUTE', value: `${sorted.join('\n')}\u0000${lines.length}` }, note: 'sorted again from the quoted text' };
}

function verifyEncoderDecoder(payload: string, reply: string): ToolVerification {
  const claimed = reply.split('\n\nRan as task')[0];
  if (claimed === reply) return none('the reply is not in the expected format');
  // Decoding direction: encoding the answer again must give back the quoted text. Encoding direction: encoding the quoted text must give the answer.
  if (noPad(base64NoPad(claimed)) === noPad(payload) || noPad(base64NoPad(payload)) === noPad(claimed)) return { output: claimed, check: { kind: 'RECOMPUTE', value: claimed }, note: 'round trip through base64 matches' };
  return none('the base64 round trip did not match, so it is left unverified (another encoding may have been used)', claimed);
}

export function verifyToolReply(input: { readonly toolId: string; readonly message: string; readonly replyContent: string }): ToolVerification {
  const q = quotedText(input.message);
  if (q.kind === 'none') return none('no quoted text in the message to recheck against');
  if (q.kind === 'many') return none('more than one quoted text, so it is unclear which one the tool used');
  if (q.kind === 'open') return none('a quote is left open');
  switch (input.toolId) {
    case 'text-counter': return verifyTextCounter(q.text, input.replyContent);
    case 'sort-lines': return verifySortLines(q.text, input.replyContent);
    case 'encoder-decoder': return verifyEncoderDecoder(q.text, input.replyContent);
    default: return none('there is no independent check for this tool yet');
  }
}
