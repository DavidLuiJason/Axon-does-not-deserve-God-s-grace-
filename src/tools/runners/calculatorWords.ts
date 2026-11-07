/** PROPOSED, the owner's yes is WAITING. */
export type CalculatorAngle = 'deg' | 'rad';
export const CALCULATOR_ANGLE_WORDS: Readonly<Record<string, CalculatorAngle>> = Object.freeze({
  degrees: 'deg',
  degree: 'deg',
  deg: 'deg',
  radians: 'rad',
  radian: 'rad',
  rad: 'rad'
});
export const CALCULATOR_ANGLE_CHOICES: readonly string[] = Object.freeze(Object.keys(CALCULATOR_ANGLE_WORDS));
export function foldCalculatorAngle(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value === 'deg' || value === 'rad') return value;
  return Object.prototype.hasOwnProperty.call(CALCULATOR_ANGLE_WORDS, value.toLowerCase())
    ? CALCULATOR_ANGLE_WORDS[value.toLowerCase()]
    : value;
}
