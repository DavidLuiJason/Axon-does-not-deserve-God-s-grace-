import { redactDiagnostics } from './security/securityArtifactRedaction.js';
import type { CodeDiagnostic, LanguageDiagnosticAdapter, SourceLanguage } from './types.js';
import { tokenize } from './lexer.js';

function diagnostic(file: string, code: string, severity: CodeDiagnostic['severity'], stage: CodeDiagnostic['stage'], message: string, line: number, column: number, confidence: CodeDiagnostic['confidence'] = 'high'): CodeDiagnostic {
  return { id: `${file}:${code}:${line}:${column}`, code, severity, stage, message, location: { file, line, column }, evidence: 'CHECKED', confidence };
}

function offsetLocation(source: string, offset: number): { line: number; column: number } {
  const safe = Math.max(0, Math.min(offset, source.length));
  let line = 1; let column = 1;
  for (let i = 0; i < safe; i += 1) {
    if (source[i] === '\n') { line += 1; column = 1; } else column += 1;
  }
  return { line, column };
}

function checkDelimiters(file: string, source: string, language: SourceLanguage): CodeDiagnostic[] {
  const { tokens, issues } = tokenize(source);
  const out: CodeDiagnostic[] = [];
  for (const issue of issues) out.push(diagnostic(file, issue.code, 'error', 'lexical', issue.message, issue.line, issue.column));
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack: Array<{ value: string; line: number; column: number }> = [];
  for (const token of tokens) {
    if (token.kind === 'string') continue;
    if (token.value === '(' || token.value === '[' || token.value === '{') stack.push({ value: token.value, line: token.line, column: token.column });
    else if (Object.prototype.hasOwnProperty.call(pairs, token.value)) {
      const expected = pairs[token.value];
      const top = stack[stack.length - 1];
      if (!top || top.value !== expected) {
        out.push(diagnostic(file, 'UNEXPECTED_CLOSING_DELIMITER', 'error', 'syntax', `Unexpected '${token.value}' closing delimiter.`, token.line, token.column));
      } else stack.pop();
    }
  }
  for (const open of stack) out.push(diagnostic(file, 'UNCLOSED_DELIMITER', 'error', 'syntax', `Opening '${open.value}' delimiter is not closed.`, open.line, open.column));

  if (language === 'javascript' || language === 'typescript') {
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const current = tokens[i]; const next = tokens[i + 1];
      if (current?.value === '=' && next && (next.value === ';' || next.value === '}')) {
        out.push(diagnostic(file, 'MISSING_ASSIGNMENT_VALUE', 'error', 'syntax', 'Assignment has no value before the statement ends.', next.line, next.column));
      }
      if (current?.value === '=>' && next?.value === ';') {
        out.push(diagnostic(file, 'MISSING_ARROW_BODY', 'error', 'syntax', 'Arrow function has no body.', next.line, next.column));
      }
    }
  }
  return out;
}

function checkJson(file: string, source: string): CodeDiagnostic[] {
  try { JSON.parse(source); return []; }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.';
    const match = message.match(/position\s+(\d+)/i);
    const offset = match ? Number(match[1]) : 0;
    const loc = offsetLocation(source, offset);
    return [diagnostic(file, 'JSON_PARSE_ERROR', 'error', 'syntax', message, loc.line, loc.column)];
  }
}

const VOID_HTML = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function checkHtml(file: string, source: string): CodeDiagnostic[] {
  const out: CodeDiagnostic[] = [];
  const stack: Array<{ tag: string; line: number; column: number }> = [];
  const tagPattern = /<!--[\s\S]*?-->|<\/?([A-Za-z][\w:-]*)(?:\s[^<>]*?)?\s*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source)) !== null) {
    const raw = match[0]; const tag = match[1]?.toLowerCase();
    if (!tag || raw.startsWith('<!--')) continue;
    const loc = offsetLocation(source, match.index);
    const closing = /^<\//.test(raw); const selfClosing = /\/>$/.test(raw);
    if (closing) {
      const top = stack[stack.length - 1];
      if (!top || top.tag !== tag) out.push(diagnostic(file, 'HTML_UNEXPECTED_CLOSE_TAG', 'error', 'syntax', `Closing tag </${tag}> does not match the currently open element.`, loc.line, loc.column));
      else stack.pop();
    } else if (!selfClosing && !VOID_HTML.has(tag)) stack.push({ tag, line: loc.line, column: loc.column });
  }
  for (const item of stack) out.push(diagnostic(file, 'HTML_UNCLOSED_TAG', 'warning', `syntax`, `Opening <${item.tag}> has no matching closing tag.`, item.line, item.column, 'medium'));
  return out;
}

export async function analyzeSourceFile(
  file: string,
  source: string,
  language: SourceLanguage,
  adapters: readonly LanguageDiagnosticAdapter[] = []
): Promise<CodeDiagnostic[]> {
  let findings: CodeDiagnostic[];
  if (language === 'json') findings = checkJson(file, source);
  else if (language === 'javascript' || language === 'typescript') findings = checkDelimiters(file, source, language);
  else if (language === 'css') findings = checkDelimiters(file, source, language);
  else if (language === 'html') findings = checkHtml(file, source);
  else findings = [];

  for (const adapter of adapters) {
    if (!adapter.supports(language)) continue;
    const extra = await adapter.analyze(file, source);
    findings.push(...extra.map((item) => ({ ...item, evidence: item.evidence === 'CHECKED' ? 'ADAPTER_REPORTED' : item.evidence })));
  }
  return redactDiagnostics(findings);
}
