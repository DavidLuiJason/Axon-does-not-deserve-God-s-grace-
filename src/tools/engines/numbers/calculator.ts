// Bounded, exact-rational calculator. The parser never evaluates an unbounded expression.
export type CalculatorErrorCode = 'syntax' | 'division-by-zero' | 'domain' | 'too-long';
export type CalculatorResult =
  | { ok: true; value: number; formatted: string; interpreted: string }
  | { ok: false; error: CalculatorErrorCode; position: number; hint: string; interpreted: string };
export type CalculatorOptions = { angle?: 'deg' | 'rad'; ans?: number };
export const CALCULATOR_LIMITS = { expressionLength: 512, tokens: 256, parenthesisDepth: 64, workUnits: 20000, combinationN: 1000 } as const;
type Tok = { type: 'number' | 'name' | 'op' | 'eof'; value: string; pos: number; end: number };
type V = { n: bigint; d: bigint };
type Node =
  | { kind: 'number'; value: V; text: string; pos: number }
  | { kind: 'constant'; name: string; value: V; pos: number }
  | { kind: 'ans'; pos: number }
  | { kind: 'unary'; op: '+' | '-'; child: Node; pos: number }
  | { kind: 'binary'; op: string; left: Node; right: Node; pos: number }
  | { kind: 'percent'; child: Node; pos: number }
  | { kind: 'factorial'; child: Node; pos: number }
  | { kind: 'call'; name: string; args: Node[]; pos: number };
function renderNode(n: Node): string {
  if (n.kind === 'number') return n.text;
  if (n.kind === 'constant') return n.name;
  if (n.kind === 'ans') return 'ans';
  if (n.kind === 'unary') return `${n.op}${renderNode(n.child)}`;
  if (n.kind === 'percent') return `(${renderNode(n.child)} ÷ 100)`;
  if (n.kind === 'factorial') return `${renderNode(n.child)}!`;
  if (n.kind === 'call') return `${n.name}(${n.args.map(renderNode).join(', ')})`;
  const a = renderNode(n.left), b = renderNode(n.right);
  if ((n.op === '+' || n.op === '-') && n.right.kind === 'percent') return `(${a} ${n.op} (${a} × ${renderNode(n.right.child)} ÷ 100))`;
  const symbol = n.op === 'of' || n.op === '*' ? '×' : n.op === '/' ? '÷' : n.op === '%' ? 'mod' : n.op === '-' ? '−' : n.op;
  return `(${a} ${symbol} ${b})`;
}
type Fault = { error: CalculatorErrorCode; position: number; hint: string };
const fail = (error: CalculatorErrorCode, position: number, hint: string): never => { throw { error, position, hint } satisfies Fault; };
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; let steps = 0; while (b) { if (++steps > 10000) throw { error: 'too-long', position: 0, hint: 'This expression needs too much calculation' } satisfies Fault; const t = a % b; a = b; b = t; } return a || 1n; };
function rat(n: bigint, d = 1n): V { if (d === 0n) throw { error: 'division-by-zero', position: 0, hint: 'You cannot divide by zero' } satisfies Fault; if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
function decimal(raw: string): V {
  const s = raw.toLowerCase(); const [mant, expText] = s.split('e'); const exp = expText === undefined ? 0 : Number(expText);
  if (!Number.isInteger(exp) || Math.abs(exp) > 308) throw { error: 'domain', position: 0, hint: 'That number is outside the supported range' } satisfies Fault;
  const [whole, fraction = ''] = mant.split('.'); const digits = `${whole || '0'}${fraction}`; let n = BigInt(digits || '0'); let d = 10n ** BigInt(fraction.length);
  if (exp > 0) n *= 10n ** BigInt(exp); else if (exp < 0) d *= 10n ** BigInt(-exp);
  return rat(n, d);
}
const add = (a: V, b: V) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: V, b: V) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: V, b: V) => rat(a.n * b.n, a.d * b.d);
const div = (a: V, b: V): V => { if (b.n === 0n) throw { error: 'division-by-zero', position: 0, hint: 'You cannot divide by zero' } satisfies Fault; return rat(a.n * b.d, a.d * b.n); };
function fromNumber(n: number): V { if (!Number.isFinite(n)) throw { error: 'domain', position: 0, hint: 'The result is outside the supported number range' } satisfies Fault; const s = Number(n.toPrecision(15)).toString(); return decimal(s); }
const toNumber = (v: V): number => Number(v.n) / Number(v.d);
function format(v: V): string { if (v.d === 1n) return v.n.toString(); const scaled = v.n * 1000000000000000n / v.d; return (Number(scaled) / 1e15).toString(); }
function stripOuterParens(s: string): string { if (!s.startsWith('(') || !s.endsWith(')')) return s; let depth = 0; for (let i = 0; i < s.length; i++) { if (s[i] === '(') depth++; else if (s[i] === ')') depth--; if (depth === 0 && i < s.length - 1) return s; } return depth === 0 ? s.slice(1, -1) : s; }
function tokenize(s: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  const push = (type: Tok['type'], value: string, pos: number, end: number) => { out.push({ type, value, pos, end }); if (out.length > CALCULATOR_LIMITS.tokens) fail('too-long', i, 'This expression has too many parts'); };
  while (i < s.length) {
    if (/\s/u.test(s[i])) { i++; continue; }
    const start = i, c = s[i];
    if (/[0-9.]/.test(c)) {
      if (c === '.' && !/[0-9]/.test(s[i + 1] || '')) fail('syntax', start, 'A decimal point needs digits');
      if (c === '.') { i++; while (i < s.length && /[0-9]/.test(s[i])) i++; }
      else { while (i < s.length && /[0-9]/.test(s[i])) i++; if (s[i] === '.') { i++; while (i < s.length && /[0-9]/.test(s[i])) i++; } }
      if (/[eE]/.test(s[i] || '') && /[0-9+-]/.test(s[i + 1] || '')) { const e = i++; if (/[+-]/.test(s[i] || '')) i++; const digitStart = i; while (/[0-9]/.test(s[i] || '')) i++; if (digitStart === i) i = e; }
      const raw = s.slice(start, i); if (!/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) fail('syntax', start, 'I could not read that number');
      push('number', raw, start, i); continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      i++; while (/[a-zA-Z0-9]/.test(s[i] || '')) i++; const word = s.slice(start, i).toLowerCase();
      if (word === 'divided') { const save = i; while (/\s/.test(s[i] || '')) i++; if (s.slice(i, i + 2).toLowerCase() === 'by' && !/[a-zA-Z]/.test(s[i + 2] || '')) i += 2; else i = save; push('op', '/', start, i); }
      else if (['times', 'plus', 'minus', 'over', 'mod', 'of', 'x'].includes(word)) push('op', ({ times: '*', plus: '+', minus: '-', over: '/', mod: '%', of: 'of', x: '*' } as Record<string, string>)[word], start, i);
      else push('name', word, start, i);
      continue;
    }
    if (c === 'π') { push('name', 'pi', start, ++i); continue; }
    if (c === '√') { push('op', 'sqrt-prefix', start, ++i); continue; }
    if (s.slice(i, i + 2) === '**') { push('op', '^', start, i + 2); i += 2; continue; }
    const mapped: Record<string, string> = { '×': '*', '÷': '/', '−': '-', '–': '-' };
    if ('+-*/^%()!,'.includes(c) || mapped[c]) { push('op', mapped[c] || c, start, ++i); continue; }
    fail('syntax', i, `I did not understand '${c}' here`);
  }
  out.push({ type: 'eof', value: '', pos: s.length, end: s.length }); return out;
}
const FUNCTIONS = new Set(['sqrt', 'abs', 'round', 'floor', 'ceil', 'sin', 'cos', 'tan', 'ln', 'log', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'log2', 'cbrt', 'ncr', 'npr']);
function startsOperand(t: Tok): boolean { return t.type === 'number' || t.type === 'name' || (t.type === 'op' && (t.value === '(' || t.value === 'sqrt-prefix')); }
export function evaluate(expression: string, options: CalculatorOptions = {}): CalculatorResult {
  let interpreted = typeof expression === 'string' ? expression : '';
  if (typeof expression !== 'string') return { ok: false, error: 'syntax', position: 0, hint: 'Enter a mathematical expression as text', interpreted };
  if (expression.length > CALCULATOR_LIMITS.expressionLength) return { ok: false, error: 'too-long', position: CALCULATOR_LIMITS.expressionLength, hint: 'This expression is too long', interpreted };
  let work = 0; const tick = (pos: number) => { if (++work > CALCULATOR_LIMITS.workUnits) fail('too-long', pos, 'This expression needs too much calculation'); };
  let rootNode: Node | undefined;
  try {
    const ts = tokenize(expression); let i = 0, depth = 0; const peek = () => ts[i]; const take = () => ts[i++];
    function parsePrimary(): Node {
      tick(peek().pos); const t = take();
      if (t.type === 'number') return { kind: 'number', value: decimal(t.value), text: t.value, pos: t.pos };
      if (t.type === 'op' && t.value === 'sqrt-prefix') return { kind: 'call', name: 'sqrt', args: [parseExpr(4)], pos: t.pos };
      if (t.type === 'op' && t.value === '(') { if (++depth > CALCULATOR_LIMITS.parenthesisDepth) fail('too-long', t.pos, 'Parentheses are nested too deeply'); const n = parseExpr(0); if (peek().value !== ')') fail('syntax', peek().pos, 'A closing parenthesis is missing'); take(); depth--; return n; }
      if (t.type === 'name') {
        if (t.value === 'pi' || t.value === 'e') return { kind: 'constant', name: t.value, value: fromNumber(t.value === 'pi' ? Math.PI : Math.E), pos: t.pos };
        if (t.value === 'ans') { if (typeof options.ans !== 'number' || !Number.isFinite(options.ans)) fail('syntax', t.pos, 'There is no previous answer yet'); return { kind: 'ans', pos: t.pos }; }
        if (!FUNCTIONS.has(t.value)) fail('syntax', t.pos, `I did not understand the name '${t.value}'`);
        if (peek().value === '(') { take(); if (++depth > CALCULATOR_LIMITS.parenthesisDepth) fail('too-long', t.pos, 'Parentheses are nested too deeply'); const args: Node[] = []; if (peek().value !== ')') { args.push(parseExpr(0)); while (peek().value === ',') { take(); args.push(parseExpr(0)); } } if (peek().value !== ')') fail('syntax', peek().pos, 'A closing parenthesis is missing'); take(); depth--; const wanted = (t.value === 'ncr' || t.value === 'npr') ? 2 : 1; if (args.length !== wanted) fail('syntax', t.pos, `${t.value} needs ${wanted} argument${wanted === 1 ? '' : 's'}`); return { kind: 'call', name: t.value, args, pos: t.pos }; }
        if (t.value === 'ncr' || t.value === 'npr') fail('syntax', t.pos, `${t.value} needs two arguments in parentheses`);
        return { kind: 'call', name: t.value, args: [parseExpr(4)], pos: t.pos };
      }
      return fail('syntax', t.pos, t.value === '%' ? 'A % needs a number before it' : t.value === 'of' ? "I did not understand the word 'of' here" : t.type === 'eof' ? 'I expected a number here' : 'I expected a number or an opening parenthesis');
    }
    function parsePrefix(): Node {
      const t = peek(); if (t.value === '+' || t.value === '-') { take(); return { kind: 'unary', op: t.value, child: parseExpr(3), pos: t.pos }; }
      return parsePrimary();
    }
    function parseExpr(minPrec: number): Node {
      let left = parsePrefix();
      while (true) {
        tick(peek().pos); const t = peek();
        if (t.value === '!' || t.value === '%') {
          if (5 < minPrec) break;
          if (t.value === '!') { take(); left = { kind: 'factorial', child: left, pos: t.pos }; continue; }
          const next = ts[i + 1];
          if (!startsOperand(next)) { const previous = ts[i - 1]; if (previous.type !== 'number' && previous.value !== ')') fail('syntax', t.pos, 'A % needs a number before it'); take(); left = { kind: 'percent', child: left, pos: t.pos }; continue; }
          if (2 < minPrec) break; take(); const right = parseExpr(3); left = { kind: 'binary', op: '%', left, right, pos: t.pos }; continue;
        }
        const explicit = t.type === 'op' && ['+', '-', '*', '/', '^', 'of'].includes(t.value);
        const implicit = startsOperand(t) && (ts[i - 1].end === t.pos) && (ts[i - 1].type === 'number' || ts[i - 1].value === ')' || ts[i - 1].type === 'name');
        let op = explicit ? t.value : implicit ? '*' : '';
        if (!op) break;
        if (op === 'of') op = 'of';
        const prec = op === '+' || op === '-' ? 1 : op === '*' || op === '/' || op === '%' || op === 'of' ? 2 : op === '^' ? 4 : 0;
        if (prec < minPrec) break;
        if (explicit) take();
        const right = parseExpr(prec + (op === '^' ? 0 : 1)); left = { kind: 'binary', op, left, right, pos: t.pos };
      }
      return left;
    }
    const root = parseExpr(0); rootNode = root; if (peek().type !== 'eof') { const t = peek(); if (t.value === '%') fail('syntax', t.pos, 'A % needs a number before it'); if (t.type === 'number' && ts[i - 1].type === 'number') fail('syntax', t.pos, 'Put an operator between these numbers'); if (t.value === 'of') fail('syntax', t.pos, "I did not understand the word 'of' here"); fail('syntax', t.pos, 'I did not understand this part of the expression'); }
    type EV = { v: V; text: string; percentRaw?: V };
    function evaluateNode(n: Node): EV {
      tick(n.pos);
      if (n.kind === 'number') return { v: n.value, text: n.text };
      if (n.kind === 'constant') return { v: n.value, text: n.name };
      if (n.kind === 'ans') return { v: fromNumber(options.ans!), text: 'ans' };
      if (n.kind === 'unary') { const a = evaluateNode(n.child); const v = n.op === '-' ? rat(-a.v.n, a.v.d) : a.v; return { v, text: `${n.op}${a.text}` }; }
      if (n.kind === 'percent') { const a = evaluateNode(n.child); return { v: div(a.v, rat(100n)), percentRaw: a.v, text: `(${a.text} ÷ 100)` }; }
      if (n.kind === 'factorial') { const a = evaluateNode(n.child); const x = toNumber(a.v); if (a.v.d !== 1n || a.v.n < 0n || a.v.n > 170n) fail('domain', n.pos, 'Factorial needs a whole number from 0 to 170'); let z = 1n; for (let k = 2n; k <= a.v.n; k++) { tick(n.pos); z *= k; } return { v: rat(z), text: `${a.text}!` }; }
      if (n.kind === 'binary') {
        const a = evaluateNode(n.left), b = evaluateNode(n.right);
        if ((n.op === '+' || n.op === '-') && b.percentRaw) { const amount = div(mul(a.v, b.percentRaw), rat(100n)); const v = n.op === '+' ? add(a.v, amount) : sub(a.v, amount); return { v, text: `(${a.text} ${n.op} (${a.text} × ${format(b.percentRaw)} ÷ 100))` }; }
        if (n.op === '+') return { v: add(a.v, b.v), text: `(${a.text} + ${b.text})` };
        if (n.op === '-') return { v: sub(a.v, b.v), text: `(${a.text} − ${b.text})` };
        if (n.op === '*' || n.op === 'of') return { v: mul(a.v, b.v), text: `(${a.text} × ${b.text})` };
        if (n.op === '/') return { v: div(a.v, b.v), text: `(${a.text} ÷ ${b.text})` };
        if (n.op === '%') { if (b.v.n === 0n) fail('division-by-zero', n.pos, 'Remainder by zero is undefined'); return { v: fromNumber(toNumber(a.v) % toNumber(b.v)), text: `(${a.text} mod ${b.text})` }; }
        if (n.op === '^') { const x = toNumber(a.v), y = toNumber(b.v); if (x === 0 && y < 0) fail('division-by-zero', n.pos, 'Zero cannot be raised to a negative power'); if (x < 0 && !Number.isInteger(y)) fail('domain', n.pos, 'A negative number needs a whole-number exponent'); if (b.v.d === 1n && b.v.n >= 0n && b.v.n <= 1024n && a.v.d === 1n) { let power = b.v.n, base = a.v.n, result = 1n; while (power > 0n) { tick(n.pos); if (power & 1n) result *= base; power >>= 1n; if (power) base *= base; if (result.toString().length > 10000 || base.toString().length > 10000) fail('too-long', n.pos, 'That exact calculation is too large'); } return { v: rat(result), text: `(${a.text} ^ ${b.text})` }; } return { v: fromNumber(Math.pow(x, y)), text: `(${a.text} ^ ${b.text})` }; }
      }
      if (n.kind === 'call') {
        const args = n.args.map(evaluateNode); const xs = args.map(a => toNumber(a.v)); const x = xs[0]; let y = Number.NaN;
        if (n.name === 'ncr' || n.name === 'npr') { const [nn, rr] = args.map(a => a.v); if (nn.d !== 1n || rr.d !== 1n || nn.n < 0n || nn.n > BigInt(CALCULATOR_LIMITS.combinationN) || rr.n < 0n || rr.n > nn.n) fail('domain', n.pos, `${n.name} needs integers with 0 ≤ r ≤ n ≤ 1000`); let z = 1n; const count = n.name === 'ncr' ? (rr.n < nn.n - rr.n ? rr.n : nn.n - rr.n) : rr.n; const start = n.name === 'ncr' ? nn.n - count : nn.n - count; for (let k = 1n; k <= count; k++) { tick(n.pos); z = z * (start + k) / k; if (z.toString().length > 10000) fail('domain', n.pos, 'That combination is too large to represent safely'); } if (n.name === 'npr') { z = 1n; for (let k = 0n; k < rr.n; k++) { tick(n.pos); z *= nn.n - k; if (z.toString().length > 10000) fail('domain', n.pos, 'That permutation is too large to represent safely'); } } const value = toNumber(rat(z)); if (!Number.isFinite(value)) fail('domain', n.pos, 'That result is outside the supported number range'); return { v: rat(z), text: `${n.name}(${args.map(a => a.text).join(', ')})` }; }
        const angle = options.angle ?? 'rad'; const rad = angle === 'deg' ? x * Math.PI / 180 : x;
        switch (n.name) {
          case 'sqrt': if (x < 0) fail('domain', n.pos, 'Square root needs a number at least zero'); y = Math.sqrt(x); break;
          case 'abs': return { v: rat(args[0].v.n < 0n ? -args[0].v.n : args[0].v.n, args[0].v.d), text: `abs(${args[0].text})` };
          case 'round': return { v: rat(BigInt(Math.round(x))), text: `round(${args[0].text})` };
          case 'floor': return { v: rat(BigInt(Math.floor(x))), text: `floor(${args[0].text})` };
          case 'ceil': return { v: rat(BigInt(Math.ceil(x))), text: `ceil(${args[0].text})` };
          case 'sin': case 'cos': case 'tan': {
            if (angle === 'deg') { const deg = ((x % 360) + 360) % 360; const exact: Record<string, [number, number, number]> = { '0': [0,1,0], '30': [0.5, Math.sqrt(3)/2, 1/Math.sqrt(3)], '45': [Math.SQRT1_2, Math.SQRT1_2, 1], '60': [Math.sqrt(3)/2, 0.5, Math.sqrt(3)], '90': [1,0,NaN], '120': [Math.sqrt(3)/2,-0.5,-Math.sqrt(3)], '135': [Math.SQRT1_2,-Math.SQRT1_2,-1], '150': [0.5,-Math.sqrt(3)/2,-1/Math.sqrt(3)], '180': [0,-1,0], '210': [-0.5,-Math.sqrt(3)/2,1/Math.sqrt(3)], '225': [-Math.SQRT1_2,-Math.SQRT1_2,1], '240': [-Math.sqrt(3)/2,-0.5,Math.sqrt(3)], '270': [-1,0,NaN], '300': [-Math.sqrt(3)/2,0.5,-Math.sqrt(3)], '315': [-Math.SQRT1_2,Math.SQRT1_2,-1], '330': [-0.5,Math.sqrt(3)/2,-1/Math.sqrt(3)] }; const key = String(deg); if (exact[key]) { y = exact[key][n.name === 'sin' ? 0 : n.name === 'cos' ? 1 : 2]; if (!Number.isFinite(y)) fail('domain', n.pos, 'Tangent is undefined at this angle'); if (n.name === 'sin' || n.name === 'cos') { if (Math.abs(y) < 1e-15) y = 0; } if (n.name === 'tan' && [45,135,225,315].includes(deg)) y = deg === 45 || deg === 225 ? 1 : -1; break; } }
            if (n.name === 'tan' && Math.abs(Math.cos(rad)) < 1e-14) fail('domain', n.pos, 'Tangent is undefined at this angle'); y = n.name === 'sin' ? Math.sin(rad) : n.name === 'cos' ? Math.cos(rad) : Math.tan(rad); y = Math.round(y * 1e12) / 1e12; break;
          }
          case 'ln': if (x <= 0) fail('domain', n.pos, 'Natural logarithm needs a number greater than zero'); y = Math.log(x); break;
          case 'log': if (x <= 0) fail('domain', n.pos, 'Logarithm needs a number greater than zero'); y = Math.log10(x); break;
          case 'log2': if (x <= 0) fail('domain', n.pos, 'Logarithm needs a number greater than zero'); y = Math.log2(x); break;
          case 'asin': case 'acos': if (x < -1 || x > 1) fail('domain', n.pos, `${n.name} needs a value from -1 to 1`); y = n.name === 'asin' ? Math.asin(x) : Math.acos(x); if (angle === 'deg') y *= 180 / Math.PI; break;
          case 'atan': y = Math.atan(x); if (angle === 'deg') y *= 180 / Math.PI; break;
          case 'sinh': y = Math.sinh(x); break; case 'cosh': y = Math.cosh(x); break; case 'tanh': y = Math.tanh(x); break; case 'exp': y = Math.exp(x); break; case 'cbrt': y = Math.cbrt(x); break;
          default: fail('syntax', n.pos, 'I did not understand this function');
        }
        if (!Number.isFinite(y)) fail('domain', n.pos, 'The function result is outside the supported range');
        return { v: fromNumber(y), text: `${n.name}(${args.map(a => a.text).join(', ')})` };
      }
      return fail('syntax', 0, 'I could not evaluate this expression');
    }
    const result = evaluateNode(root); const n = toNumber(result.v); if (!Number.isFinite(n)) fail('domain', root.pos, 'The result is outside the supported number range'); interpreted = root.kind === 'binary' ? stripOuterParens(result.text) : result.text;
    return { ok: true, value: n, formatted: format(result.v), interpreted };
  } catch (e) {
    const x = e as Partial<Fault>; const position = Number.isInteger(x.position) ? x.position! : 0; const hint = typeof x.hint === 'string' ? x.hint : 'I could not evaluate this expression';
    return { ok: false, error: x.error || 'syntax', position, hint, interpreted: rootNode ? renderNode(rootNode) : expression.slice(0, Math.max(0, position)) + ' ⟦' + expression.slice(Math.max(0, position)) + '⟧' };
  }
}
