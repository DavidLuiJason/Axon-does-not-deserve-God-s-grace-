// One shared random source for every game (DT3, GAMES1). Default = Math.random.
// AXON hosts inject a seeded or governed source with setRandomSource(); tests use createSeededRandom() so every round is reproducible.
let source: () => number = Math.random;
export function random(): number { return source(); }
export function setRandomSource(fn: () => number): void {
  if (typeof fn !== 'function') throw new TypeError('random source must be a function returning a number in [0, 1)');
  source = fn;
}
export function resetRandomSource(): void { source = Math.random; }
export function createSeededRandom(seed: number = 1): () => number {
  let a = (Number(seed) >>> 0) || 1; // mulberry32: small, fast, deterministic
  return function seeded(): number {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
