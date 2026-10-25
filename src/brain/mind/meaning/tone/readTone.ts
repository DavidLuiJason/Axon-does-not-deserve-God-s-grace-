import type { ReadTone, ToneDoubt, ToneSignal, ToneSignalKind, ToneWordFacts } from './toneTypes';

const KIND_ORDER: Record<ToneSignalKind, number> = {
  capitals: 0,
  exclaim: 1,
  'question-run': 2,
  stretched: 3,
  'repeat-word': 4,
  'urgent-word': 5,
  'anger-word': 6,
  'harsh-word': 7,
};

const neutral = () => ({
  urgency: 0 as const,
  frustration: 0 as const,
  emphasis: 0 as const,
  aimedAtAxon: null,
  answerStyle: 'normal' as const,
  signals: [] as ToneSignal[],
  doubts: [] as ToneDoubt[],
  changesActions: false as const,
});

function isLetter(ch: string): boolean {
  return ch.toLowerCase() !== ch.toUpperCase();
}

function inMaterial(position: number, materials: readonly { readonly start: number; readonly end: number }[], cursor: { value: number }): boolean {
  while (cursor.value < materials.length && materials[cursor.value]!.end <= position) cursor.value += 1;
  const material = materials[cursor.value];
  return material !== undefined && material.start <= position && position < material.end;
}

export const readTone: ReadTone = (text, words, materials) => {
  try {
    if (typeof text !== 'string' || !Array.isArray(words) || !Array.isArray(materials)) return neutral();

    const signals: ToneSignal[] = [];
    let materialCue = false;
    let negatedCue = false;
    let aimed = false;

    // Material flags are authoritative for dictionary-derived word facts.
    const activeWords: ToneWordFacts[] = [];
    const recent: ToneWordFacts[] = [];
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i] as ToneWordFacts;
      if (!word || typeof word !== 'object') continue;
      if (word.material) {
        if (word.urgent > 0 || word.anger > 0 || word.harsh) materialCue = true;
        continue;
      }
      activeWords.push(word);
      if (word.aboutAxon) aimed = true;

      const negated = recent.length > 0 && recent[recent.length - 1]!.negation
        || recent.length > 1 && recent[recent.length - 2]!.negation
        || recent.length > 2 && recent[recent.length - 3]!.negation;
      if (word.urgent > 0) {
        if (negated) negatedCue = true;
        else signals.push({ kind: 'urgent-word', start: word.start, end: word.end, text: text.slice(word.start, word.end), weight: word.urgent as 1 | 2 });
      }
      if (word.anger > 0) {
        if (negated) negatedCue = true;
        else signals.push({ kind: 'anger-word', start: word.start, end: word.end, text: text.slice(word.start, word.end), weight: word.anger as 1 | 2 });
      }
      if (word.harsh) {
        if (negated) negatedCue = true;
        else signals.push({ kind: 'harsh-word', start: word.start, end: word.end, text: text.slice(word.start, word.end), weight: 1 });
      }
      recent.push(word);
      if (recent.length > 3) recent.shift();
    }

    // Consecutive text words and emphatic punctuation are read in one character pass.
    let lettersTotal = 0;
    let loudLetters = 0;
    let loudCount = 0;
    let firstLoud = -1;
    let lastLoud = -1;
    const materialCursor = { value: 0 };
    let i = 0;
    while (i < text.length) {
      const ch = text[i]!;
      if (inMaterial(i, materials, materialCursor)) {
        i += 1;
        continue;
      }
      if (ch === '!' || ch === '?') {
        const start = i;
        while (i < text.length && text[i] === ch && !inMaterial(i, materials, materialCursor)) i += 1;
        const length = i - start;
        if (length >= 2) signals.push({ kind: ch === '!' ? 'exclaim' : 'question-run', start, end: i, text: text.slice(start, i), weight: length >= 3 ? 2 : 1 });
        continue;
      }
      if (isLetter(ch) || ch === "'") {
        const start = i;
        let letterCount = 0;
        let allUpper = true;
        let localLoudLetters = 0;
        let stretchStart = -1;
        let stretchEnd = -1;
        let previousLetter = '';
        let repeated = 0;
        while (i < text.length && !inMaterial(i, materials, materialCursor) && (isLetter(text[i]!) || text[i] === "'")) {
          const current = text[i]!;
          if (isLetter(current)) {
            letterCount += 1;
            localLoudLetters += 1;
            if (current !== current.toUpperCase()) allUpper = false;
            const folded = current.toLowerCase();
            if (folded === previousLetter) repeated += 1;
            else { previousLetter = folded; repeated = 1; }
            if (repeated >= 3 && stretchStart < 0) {
              stretchStart = i - 2;
              stretchEnd = i + 1;
            } else if (stretchStart >= 0 && repeated >= 3) stretchEnd = i + 1;
          } else {
            previousLetter = '';
            repeated = 0;
          }
          i += 1;
        }
        if (letterCount >= 2) {
          lettersTotal += letterCount;
          if (allUpper) {
            loudCount += 1;
            loudLetters += localLoudLetters;
            if (firstLoud < 0) firstLoud = start;
            lastLoud = i;
          }
        }
        if (stretchStart >= 0) signals.push({ kind: 'stretched', start: stretchStart, end: stretchEnd, text: text.slice(stretchStart, stretchEnd), weight: 1 });
        continue;
      }
      i += 1;
    }
    if (loudCount >= 2 && lettersTotal > 0 && loudLetters / lettersTotal >= 0.6) {
      signals.push({ kind: 'capitals', start: firstLoud, end: lastLoud, text: text.slice(firstLoud, lastLoud), weight: 2 });
    }

    // Three or more adjacent non-material dictionary entries with the same norm count once.
    let runStart = 0;
    while (runStart < activeWords.length) {
      let runEnd = runStart + 1;
      while (runEnd < activeWords.length && activeWords[runEnd]!.norm === activeWords[runStart]!.norm) runEnd += 1;
      if (runEnd - runStart >= 3) {
        const first = activeWords[runStart]!;
        const last = activeWords[runEnd - 1]!;
        signals.push({ kind: 'repeat-word', start: first.start, end: last.end, text: text.slice(first.start, last.end), weight: 2 });
      }
      runStart = runEnd;
    }

    signals.sort((a, b) => a.start - b.start || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

    let emphasisSum = 0;
    let baseUrgency = 0;
    let urgencyCount = 0;
    let baseFrustration = 0;
    let frustrationCount = 0;
    for (const signal of signals) {
      if (signal.kind === 'capitals' || signal.kind === 'exclaim' || signal.kind === 'question-run' || signal.kind === 'stretched' || signal.kind === 'repeat-word') emphasisSum += signal.weight;
      if (signal.kind === 'urgent-word') {
        urgencyCount += 1;
        if (signal.weight > baseUrgency) baseUrgency = signal.weight;
      }
      if (signal.kind === 'anger-word' || signal.kind === 'harsh-word') {
        frustrationCount += 1;
        if (signal.weight > baseFrustration) baseFrustration = signal.weight;
      }
    }
    const emphasis = Math.min(3, emphasisSum) as 0 | 1 | 2 | 3;
    const loudBoost = emphasis >= 2;
    const urgency = (baseUrgency === 0 ? 0 : Math.min(3, baseUrgency + (urgencyCount >= 2 ? 1 : 0) + (loudBoost ? 1 : 0))) as 0 | 1 | 2 | 3;
    const frustration = (baseFrustration === 0 ? 0 : Math.min(3, baseFrustration + (frustrationCount >= 2 ? 1 : 0) + (loudBoost ? 1 : 0))) as 0 | 1 | 2 | 3;
    const aimedAtAxon = frustration > 0 && aimed ? true : null;
    let answerStyle: 'normal' | 'brief' | 'calm' = 'normal';
    if (frustration >= 1 && (aimedAtAxon === true || frustration >= 2)) answerStyle = 'calm';
    else if (urgency >= 1 || emphasis >= 2) answerStyle = 'brief';

    const doubts: ToneDoubt[] = [];
    if (negatedCue) doubts.push('negated');
    if (materialCue) doubts.push('material-only');
    if (emphasis >= 2 && urgency === 0 && frustration === 0) doubts.push('emphasis-only');

    return { urgency, frustration, emphasis, aimedAtAxon, answerStyle, signals, doubts, changesActions: false };
  } catch {
    return neutral();
  }
};
