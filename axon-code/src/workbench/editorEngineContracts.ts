/** Engine boundary for the fixed Round 14 choices: CodeMirror 6 and xterm.js. No textarea/terminal emulation fallback is declared here. */
export interface CodeMirror6View {
  readonly state: { doc: { toString(): string; length: number }; selection: { main: { head: number } } };
  dispatch(transaction: unknown): void;
  focus(): void;
  destroy(): void;
}
export interface CodeMirror6Factory {
  mount(input: { parent: HTMLElement; initialText: string; language: string; onChange(text: string): void }): CodeMirror6View;
}
export interface XtermTerminal {
  open(parent: HTMLElement): void;
  write(data: string): void;
  writeln(data: string): void;
  onData(listener: (data: string) => void): { dispose(): void };
  onResize(listener: (size: { cols: number; rows: number }) => void): { dispose(): void };
  dispose(): void;
}
export interface XtermFactory {
  create(options: { convertEol: boolean; cursorBlink: boolean; scrollback: number; allowProposedApi: false }): XtermTerminal;
  fit(terminal: XtermTerminal): void;
}
export function assertCodeMirror6Factory(value: unknown): asserts value is CodeMirror6Factory {
  if (!value || typeof (value as CodeMirror6Factory).mount !== 'function') throw new Error('CodeMirror 6 engine module is unavailable; refusing to fall back to a plain textarea.');
}
export function assertXtermFactory(value: unknown): asserts value is XtermFactory {
  if (!value || typeof (value as XtermFactory).create !== 'function' || typeof (value as XtermFactory).fit !== 'function') throw new Error('xterm.js engine module or fit addon is unavailable; refusing to emulate a terminal.');
}
