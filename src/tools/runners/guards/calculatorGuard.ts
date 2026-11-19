import { foldCalculatorAngle, CALCULATOR_ANGLE_WORDS } from '../calculatorWords';
// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const INTENT: Readonly<Record<string, true>> = Object.freeze({
  calculate: true, compute: true, evaluate: true, what: true
});
const OTHER_UNITS: Readonly<Record<string, true>> = Object.freeze({ gradians: true, gradian: true, grad: true, grads: true, turns: true, revolutions: true, arcminutes: true, arcseconds: true });
const NON_MATH: Readonly<Record<string, true>> = Object.freeze({
  call: true, phone: true, taxes: true, python: true, code: true, how: true, why: true, hash: true, translate: true, french: true, spanish: true, not: true, never: true, dont: true, should: true, date: true, birthday: true, postcode: true,
  numberplate: true, salary: true, probability: true, odds: true
});
const MATH_MARKS: Readonly<Record<string, true>> = Object.freeze({
  '+': true, '*': true, '/': true, '^': true, '%': true,
  '!': true, '(': true, ')': true, '-': true
});
const SPOKEN_OPERATORS: Readonly<Record<string, true>> = Object.freeze({
  plus: true, minus: true, times: true, over: true, divided: true
});

function wordsOf(value: string): string[] {
  const words: string[] = [];
  let word = '';
  for (const char of value.toLowerCase()) {
    const code = char.charCodeAt(0);
    if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) word += char;
    else if (word) { words.push(word); word = ''; }
  }
  if (word) words.push(word);
  return words;
}

function hasAny(words: readonly string[], set: Readonly<Record<string, true>>): boolean {
  return words.some(word => Object.prototype.hasOwnProperty.call(set, word));
}

export const calculatorGuard: LaneGuard = (args, message) => {
  const expression = args.expression;
  if (typeof expression !== 'string' || !expression.trim()) return 'a mathematical expression is required';
  let marks = 0; for (const ch of message) if (ch === '"' || ch === '\u201C' || ch === '\u201D') marks += 1;
  if (marks > 2 || message.length > 800) return 'more than one quoted text or too long a message, so the existing path should decide';
  const words = wordsOf(message);
  if (!hasAny(words, INTENT)) return 'the request does not clearly ask for a calculation';
  if (hasAny(words, NON_MATH)) return 'the request may concern a phone number, date, salary or probability question';
  if (expression.length > 512) return 'the expression is too long for a safe direct calculation';
  const dateParts = expression.split('-');
  if (dateParts.length === 3 && dateParts.every(part => part.length > 0)) return 'the expression may be a date rather than arithmetic';
  const hasMathMark = Object.keys(MATH_MARKS).some(mark => expression.includes(mark));
  if (!hasMathMark && !hasAny(words, SPOKEN_OPERATORS)) return 'the input does not show a clear arithmetic operation';
  if (hasAny(words, OTHER_UNITS)) return 'an angle unit the lane does not know was named, so the existing path should decide';
  if (words.filter((word) => Object.prototype.hasOwnProperty.call(CALCULATOR_ANGLE_WORDS, word)).length > 1) return 'more than one angle unit was named, so the existing path should decide';
  const angle = foldCalculatorAngle(args.angle);
  if (angle !== undefined && angle !== 'deg' && angle !== 'rad') return 'the angle choice is not supported';
  return null;
};
