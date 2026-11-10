// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const INTENT: Readonly<Record<string, true>> = Object.freeze({
  calculate: true, compute: true, evaluate: true, what: true
});
const NON_MATH: Readonly<Record<string, true>> = Object.freeze({
  call: true, phone: true, date: true, birthday: true, postcode: true,
  numberplate: true, salary: true, probability: true, odds: true
});
const MATH_MARKS: Readonly<Record<string, true>> = Object.freeze({
  '+': true, '*': true, '/': true, '^': true, '%': true,
  '!': true, '(': true, ')': true
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
  const words = wordsOf(message);
  if (!hasAny(words, INTENT)) return 'the request does not clearly ask for a calculation';
  if (hasAny(words, NON_MATH)) return 'the request may concern a phone number, date, salary or probability question';
  if (expression.length > 512) return 'the expression is too long for a safe direct calculation';
  const dateParts = expression.split('-');
  if (dateParts.length === 3 && dateParts.every(part => part.length > 0)) return 'the expression may be a date rather than arithmetic';
  const hasMathMark = Object.keys(MATH_MARKS).some(mark => expression.includes(mark));
  if (!hasMathMark && !hasAny(words, SPOKEN_OPERATORS)) return 'the input does not show a clear arithmetic operation';
  if (args.angle !== undefined && args.angle !== 'deg' && args.angle !== 'rad') return 'the angle choice is not supported';
  return null;
};
