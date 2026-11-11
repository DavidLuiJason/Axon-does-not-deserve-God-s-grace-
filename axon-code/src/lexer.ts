export interface Token {
  kind: 'identifier' | 'string' | 'number' | 'punctuation' | 'keyword';
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface LexIssue {
  code: string;
  message: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'function', 'class', 'interface', 'type', 'const', 'let', 'var',
  'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'throw', 'try',
  'catch', 'finally', 'async', 'await', 'extends', 'implements', 'public', 'private', 'protected', 'static',
  'get', 'set', 'typeof', 'instanceof', 'in', 'of', 'void', 'delete', 'this', 'super', 'true', 'false', 'null'
]);

export function tokenize(source: string): { tokens: Token[]; issues: LexIssue[] } {
  const tokens: Token[] = [];
  const issues: LexIssue[] = [];
  let i = 0;
  let line = 1;
  let column = 1;
  const advance = (n = 1): void => {
    for (let k = 0; k < n && i < source.length; k += 1) {
      if (source[i] === '\n') { line += 1; column = 1; }
      else column += 1;
      i += 1;
    }
  };
  const add = (kind: Token['kind'], start: number, startLine: number, startColumn: number): void => {
    tokens.push({ kind, value: source.slice(start, i), start, end: i, line: startLine, column: startColumn });
  };

  while (i < source.length) {
    const ch = source[i] ?? '';
    if (/\s/.test(ch)) { advance(); continue; }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') advance();
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const start = i; const sl = line; const sc = column;
      advance(2);
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) advance();
      if (i >= source.length) issues.push({ code: 'UNCLOSED_COMMENT', message: 'Block comment is not closed.', start, end: i, line: sl, column: sc });
      else advance(2);
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch; const start = i; const sl = line; const sc = column;
      advance(); let closed = false;
      while (i < source.length) {
        const current = source[i] ?? '';
        if (current === '\\') { advance(2); continue; }
        if (current === quote) { advance(); closed = true; break; }
        if (current === '\n' && quote !== '`') break;
        advance();
      }
      if (!closed) issues.push({ code: 'UNCLOSED_STRING', message: 'String or template literal is not closed.', start, end: i, line: sl, column: sc });
      add('string', start, sl, sc);
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i; const sl = line; const sc = column;
      advance(); while (i < source.length && /[A-Za-z0-9_$]/.test(source[i] ?? '')) advance();
      const value = source.slice(start, i);
      add(KEYWORDS.has(value) ? 'keyword' : 'identifier', start, sl, sc);
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const start = i; const sl = line; const sc = column;
      advance(); while (i < source.length && /[A-Za-z0-9_.]/.test(source[i] ?? '')) advance();
      add('number', start, sl, sc); continue;
    }
    const start = i; const sl = line; const sc = column;
    advance();
    const two = source.slice(start, start + 2);
    const three = source.slice(start, start + 3);
    if (['===', '!==', '>>>', '**=', '&&=', '||=', '??='].includes(three)) advance(2);
    else if (['=>', '==', '!=', '<=', '>=', '++', '--', '&&', '||', '??', '?.', '+=', '-=', '*=', '/=', '**', '...', '<<', '>>'].includes(two)) advance();
    add('punctuation', start, sl, sc);
  }
  return { tokens, issues };
}
