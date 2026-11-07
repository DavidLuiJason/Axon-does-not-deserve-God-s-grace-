/** PROPOSED, the owner's yes is WAITING. */
export const CONVERTER_KIND_WORDS: Readonly<Record<string, string>> = Object.freeze({
  length: 'length',
  mass: 'mass',
  temperature: 'temperature',
  volume: 'volume',
  area: 'area',
  speed: 'speed',
  time: 'time',
  'number base': 'number-base',
  'data formats': 'data-formats',
  text: 'text-formats',
  image: 'image'
});
export const CONVERTER_KIND_CHOICES: readonly string[] = Object.freeze(Object.keys(CONVERTER_KIND_WORDS));
export function foldConverterKind(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(CONVERTER_KIND_WORDS, key)
    ? CONVERTER_KIND_WORDS[key]
    : value;
}
// Unit and format names are intentionally not enumerated here; the converter engine validates them.
