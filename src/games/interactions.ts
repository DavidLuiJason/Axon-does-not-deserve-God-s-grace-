/**
 * AXON Games: the interaction rules that the lab's old screen contained (DT3, GAMES3).
 * Pure functions: a screen draws what screenModel() says and sends the player's input to the check functions.
 * No DOM, no timers (the screen owns them), no storage, no Math.random.
 */
import type { Round } from './types';

export const MASTERMIND_DIGITS = 4;
export const MASTERMIND_MAX_GUESSES = 8;
/** How long the set-memory kind shows its sequence before hiding it, in milliseconds. */
export const SET_MEMORY_SHOW_MS = 2200;

type Item = string | number;

/** What a screen should draw for one round. Every round maps to exactly one of these. */
export type ScreenModel =
  | { type: 'typed-memory'; memorize: Item[]; memorizeMs: number; question: string }
  | { type: 'select-memory'; memorize: Item[]; memorizeMs: number; question: string; options: Item[] }
  | { type: 'set-select'; memorize: Item[]; memorizeMs: number; secondList: Item[] | null; question: string; options: Item[] }
  | { type: 'choice'; prompt: string; question: string | null; options: string[] }
  | { type: 'typed'; prompt: string; question: string | null }
  | { type: 'grid'; prompt: string; size: number; litCells: number[]; showMs: number }
  | { type: 'heaps'; prompt: string; heaps: number[] }
  | { type: 'code'; prompt: string; digits: number; maxGuesses: number }
  | { type: 'open'; prompt: string; visual: { type: string; count: number } };

const text = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

/** Converts one generated round into the single thing the screen has to draw. Throws on a round it does not know. */
export function screenModel(round: Round): ScreenModel {
  const prompt = text(round.prompt ?? round.questionText);
  const question = round.question !== undefined && text(round.question) !== prompt ? text(round.question) : null;
  switch (round.kind) {
    case 'memory': {
      const memorize = (round.seq ?? []) as Item[];
      const memorizeMs = Number(round.delay);
      if (!(memorizeMs > 0)) throw new RangeError('memory round has no display time');
      if (round.mode === 'set') {
        return { type: 'select-memory', memorize, memorizeMs, question: text(round.questionText ?? prompt), options: (round.choices ?? []) as Item[] };
      }
      return { type: 'typed-memory', memorize, memorizeMs, question: text(round.questionText || 'Enter the requested answer.') };
    }
    case 'set-memory':
      return {
        type: 'set-select',
        memorize: (round.seq ?? []) as Item[],
        memorizeMs: SET_MEMORY_SHOW_MS,
        secondList: Array.isArray(round.shown) ? (round.shown as Item[]) : null,
        question: prompt,
        options: (round.choices ?? []) as Item[],
      };
    case 'choice':
      return { type: 'choice', prompt, question, options: (round.choices ?? []).map((c) => String(c)) };
    case 'input':
    case 'text':
      return { type: 'typed', prompt, question };
    case 'visual': {
      const size = Number(round.size);
      return { type: 'grid', prompt, size, litCells: (round.cells ?? []) as number[], showMs: Number(round.delay) };
    }
    case 'strategy':
      return { type: 'heaps', prompt, heaps: (round.heaps ?? []) as number[] };
    case 'mastermind':
      return { type: 'code', prompt, digits: MASTERMIND_DIGITS, maxGuesses: MASTERMIND_MAX_GUESSES };
    case 'imagine': {
      const visual = round.visual as { type: string; count: number } | undefined;
      return { type: 'open', prompt, visual: { type: text(visual?.type), count: Number(visual?.count ?? 0) } };
    }
    default:
      throw new RangeError(`Unknown round kind: ${round.kind}`);
  }
}

/** Grid rounds: the player must tap exactly the lit cells, no more and no fewer. */
export function checkTappedCells(round: Round, tapped: readonly number[]): boolean {
  if (round.kind !== 'visual') throw new TypeError('checkTappedCells needs a visual round');
  const lit = (round.cells ?? []) as number[];
  const got = new Set(tapped);
  return got.size === lit.length && lit.every((cell) => got.has(cell));
}

export interface GuessScore {
  exact: number;
  misplaced: number;
}

/** Mastermind scoring: right digit in the right place, and right digit in the wrong place (each code digit counts once). */
export function scoreGuess(code: readonly number[], guess: readonly number[]): GuessScore {
  const exact = guess.filter((v, i) => v === code[i]).length;
  const leftCode = code.filter((v, i) => v !== guess[i]);
  const leftGuess = guess.filter((v, i) => v !== code[i]);
  let misplaced = 0;
  for (const v of leftGuess) {
    const at = leftCode.indexOf(v);
    if (at >= 0) {
      misplaced++;
      leftCode.splice(at, 1);
    }
  }
  return { exact, misplaced };
}

export type CodeGuessResult =
  | { ok: false; reason: 'not-four-digits' }
  | { ok: true; guess: number[]; exact: number; misplaced: number; solved: boolean; finished: boolean; remaining: number };

/** One guess in a code round. `guessesSoFar` is how many valid guesses were already made. */
export function submitCodeGuess(round: Round, guessesSoFar: number, input: string): CodeGuessResult {
  if (round.kind !== 'mastermind') throw new TypeError('submitCodeGuess needs a mastermind round');
  const value = input.trim();
  if (!new RegExp(`^\\d{${MASTERMIND_DIGITS}}$`).test(value)) return { ok: false, reason: 'not-four-digits' };
  const guess = value.split('').map(Number);
  const { exact, misplaced } = scoreGuess(round.code as number[], guess);
  const used = guessesSoFar + 1;
  const solved = exact === MASTERMIND_DIGITS;
  return { ok: true, guess, exact, misplaced, solved, finished: solved || used >= MASTERMIND_MAX_GUESSES, remaining: Math.max(0, MASTERMIND_MAX_GUESSES - used) };
}
