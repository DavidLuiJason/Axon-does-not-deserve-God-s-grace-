// GAMES5 (DT3): tier scaling. These generators make the higher tiers genuinely harder. Every puzzle here is checked by brute force inside the
// generator, and tests/gamesOracle.test.ts re-solves each one independently from the question TEXT. A builder returns null for the low tiers,
// where the earlier, simpler round (kept unchanged in the other modules) is still the right difficulty.
import { random } from "../random";
import type { GameEntry, Round } from "../types";

type Builder = (g: GameEntry, t: number, l: number) => Round | null;
let LC = 3;
const rnd = (a: number, b: number): number => Math.floor(random() * (b - a + 1)) + a;
const pick = <T,>(a: readonly T[]): T => a[rnd(0, a.length - 1)] as T;
const shuffle = <T,>(a: readonly T[]): T[] => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = rnd(0, i); [x[i], x[j]] = [x[j] as T, x[i] as T]; } return x; };
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const mk = (g: GameEntry, t: number, l: number, kind: string, prompt: string, answer: unknown, rule: string, steps: string[], extra: Record<string, any> = {}): Round => ({ kind, title: g.name, tier: t, level: l, levelsInTier: LC, prompt, questionText: prompt, question: prompt, answer, rule, steps, ...extra });
const ch = (g: GameEntry, t: number, l: number, prompt: string, answer: unknown, choices: Array<string | number>, rule: string, steps: string[], extra: Record<string, any> = {}): Round => mk(g, t, l, "choice", prompt, answer, rule, steps, { choices, ...extra });
const article = (w: string): string => (/^[aeiou]/i.test(w) ? "An " : "A ") + w;

export { tierWindow } from "./tier-window";
import { tierWindow } from "./tier-window";
import { CHAIN_DICT, ham } from "./batch-four";

// ---- bridge crossing: 2, 3 or 4 people
export function bridgeMinimum(times: readonly number[]): number {
  const s = [...times].sort((x, y) => x - y);
  const at = (i: number): number => s[i] as number;
  if (s.length === 2) return at(1);
  if (s.length === 3) return at(0) + at(1) + at(2);
  return Math.min(at(0) + 3 * at(1) + at(3), 2 * at(0) + at(1) + at(2) + at(3));
}
function bridge(g: GameEntry, t: number, l: number): Round | null {
  if (t <= 4) return null;
  const n = t <= 9 ? 3 : 4;
  const a = rnd(1, 3), b = a + rnd(1, 3), c = b + rnd(1, 4), d = c + rnd(1, 6);
  const times = shuffle([a, b, c, d].slice(0, n));
  return mk(g, t, l, "input", `${n} people cross a bridge in ${times.join(", ")} minutes. At most two cross at once, they must share one torch, and a pair moves at the slower person's speed. What is the minimum total time for everyone to cross?`, bridgeMinimum(times), "Send the two fastest as the escorts: compare the plan where the fastest person ferries everyone against the plan where the two slowest cross together.", ["Sort the times.", "The torch must come back after each crossing, so use the fastest people for the returns.", "Compare the shuttle plan with the plan that lets the two slowest cross together; take the smaller total."], { times, mechanic: "scheduling with a shared resource" });
}

// ---- reverse spelling: word length grows with the tier
const REVERSE_WORDS: Record<number, string[]> = { 4: ["moon", "lamp", "sand", "rain"], 5: ["river", "stone", "cloud", "bread"], 6: ["planet", "garden", "window", "silver"], 7: ["kitchen", "compass", "journey", "monster"], 8: ["mountain", "umbrella", "notebook", "shoulder"], 9: ["adventure", "chocolate", "dangerous", "butterfly"], 10: ["wonderland", "strawberry", "playground", "electronic"], 11: ["information", "temperature", "imagination", "reservation"] };
const reverseSpelling: Builder = (g, t, l) => {
  const w = pick(REVERSE_WORDS[Math.min(11, 3 + Math.ceil(t / 2))] as string[]);
  return mk(g, t, l, "input", `Spell “${w}” backwards.`, w.split("").reverse().join(""), "Reverse spelling means reversing character order, not changing pronunciation.", ["Write the final letter first.", "Continue from right to left.", "Check that every original letter appears exactly once."], { mechanic: "orthographic reversal" });
};

// ---- hidden word: harder compounds at higher tiers
const HIDDEN: Array<[string, string]> = [["sunflower", "sun"], ["notebook", "note"], ["starfish", "star"], ["cupboard", "cup"], ["football", "ball"], ["raincoat", "rain"], ["moonlight", "moon"], ["blackboard", "board"], ["lighthouse", "house"], ["butterfly", "butter"], ["watermelon", "water"], ["grasshopper", "grass"]];
const HIDDEN_WRONG = ["run", "map", "key", "pen", "sky", "hat", "rug", "bus", "jam"];
const hiddenWord: Builder = (g, t, l) => {
  const [whole, target] = pick(tierWindow(HIDDEN, t));
  const wrong = shuffle(HIDDEN_WRONG.filter((x) => !whole.includes(x))).slice(0, 3);
  return ch(g, t, l, `Find the complete smaller word hidden consecutively inside “${whole}”.`, target, shuffle([target, ...wrong]), "The hidden word must appear as consecutive letters in the larger word.", ["Scan the larger word from left to right.", "Look for a continuous substring.", "Do not rearrange letters."], { mechanic: "substring detection" });
};

// ---- change detection: bigger scenes, and sometimes nothing changed
const SCENE: Array<[string, string]> = [["red door", "green door"], ["round clock", "square clock"], ["three books", "four books"], ["open window", "closed window"], ["blue vase", "white vase"], ["two chairs", "one chair"], ["tall lamp", "short lamp"], ["wooden table", "glass table"]];
const changeDetection: Builder = (g, t, l) => {
  const k = Math.min(8, 3 + Math.ceil(t / 3));
  const items = shuffle(SCENE).slice(0, k);
  const before = items.map((x) => x[0]);
  const after = [...before];
  const changes = t < 8 || random() < 0.75;
  const idx = rnd(0, k - 1);
  if (changes) after[idx] = (items[idx] as [string, string])[1];
  const correct = changes ? `${before[idx]} changed` : "Nothing changed";
  const others = shuffle(before.map((x, i) => ({ x, i })).filter((o) => !changes || o.i !== idx)).slice(0, changes ? 2 : 3).map((o) => `${o.x} changed`);
  const choices = shuffle(changes ? [correct, ...others, "Nothing changed"] : [correct, ...others]);
  return ch(g, t, l, `Scene A: ${before.join("; ")}. Scene B: ${after.join("; ")}. What changed?`, correct, choices, "Compare corresponding scene details one at a time; report the changed detail, or that nothing changed.", ["Compare item 1 in both scenes, then item 2, and so on.", "Locate the first mismatch, if there is one.", "If every pair matches, nothing changed."], { mechanic: "paired-scene difference detection" });
};

// ---- target switch: the rule grows from one feature to combined features
type Clause = { neg: boolean; word: string };
const COLORS = ["red", "blue", "green"];
const SHAPES = ["circle", "square", "triangle"];
const clauseText = (c: Clause): string => `${c.neg ? "not " : ""}${SHAPES.includes(c.word) ? "a " : ""}${c.word}`;
const targetSwitch: Builder = (g, t, l) => {
  if (t <= 5) return null;
  const rules: Array<{ op: "single" | "and" | "or"; clauses: Clause[] }> = t <= 10
    ? [{ op: "single", clauses: [{ neg: true, word: "circle" }] }, { op: "single", clauses: [{ neg: true, word: "blue" }] }, { op: "or", clauses: [{ neg: false, word: "blue" }, { neg: false, word: "square" }] }]
    : [{ op: "and", clauses: [{ neg: false, word: "blue" }, { neg: true, word: "circle" }] }, { op: "or", clauses: [{ neg: true, word: "blue" }, { neg: false, word: "triangle" }] }, { op: "and", clauses: [{ neg: false, word: "red" }, { neg: false, word: "square" }] }, { op: "or", clauses: [{ neg: false, word: "green" }, { neg: true, word: "square" }] }];
  const rule = pick(rules);
  const stim = [pick(COLORS), pick(SHAPES)];
  const truth = (c: Clause): boolean => (c.neg ? !stim.includes(c.word) : stim.includes(c.word));
  const respond = rule.op === "and" ? rule.clauses.every(truth) : rule.clauses.some(truth);
  const body = rule.clauses.map((c) => `is ${clauseText(c)}`).join(rule.op === "and" ? " AND " : " OR ");
  const text = `${rule.op === "single" ? "respond only when" : rule.op === "and" ? "respond only when" : "respond when"} the symbol ${body}`;
  return ch(g, t, l, `Rule: ${text}. Stimulus: ${stim.join(" ")}. Should you respond?`, respond ? "respond" : "withhold", ["respond", "withhold"], "Apply the whole rule to the stimulus: AND needs both parts, OR needs at least one.", ["Read the active rule.", "Check each part against the colour and shape.", "Combine the parts with AND or OR."], { mechanic: "rule-based target detection" });
};

// ---- colour-word conflict and go/no-go: from one item to a stream to count
const streamLength = (t: number): number => Math.min(12, 1 + Math.floor(t * 0.8));
const INK = ["RED", "BLUE", "GREEN", "YELLOW"];
const colorWord: Builder = (g, t, l) => {
  if (t <= 3) return null;
  const pairs = Array.from({ length: streamLength(t) }, () => [pick(INK), pick(INK)] as [string, string]);
  return mk(g, t, l, "input", `Ignore the word meaning. Each pair is INK / WORD: ${pairs.map((p) => `${p[0]}/${p[1]}`).join(", ")}. How many pairs have an ink label that differs from the printed word?`, pairs.filter((p) => p[0] !== p[1]).length, "Compare each ink label with its printed word and count only the pairs that differ.", ["Take the pairs one at a time.", "Mark a pair when the two labels differ.", "Report the count."], { mechanic: "conflict monitoring over a stream" });
};
const goNoGo: Builder = (g, t, l) => {
  if (t <= 3) return null;
  const target = pick(["7", "triangle", "green"]);
  const pool = ["7", "2", "5", "triangle", "circle", "green", "blue"];
  const stream = Array.from({ length: streamLength(t) }, () => pick(pool));
  return mk(g, t, l, "input", `Target: ${target}. Stream: ${stream.join(", ")}. How many items are a GO (an exact match with the target)?`, stream.filter((x) => x === target).length, "Respond only to an exact target match; withhold for every non-target.", ["Encode the target.", "Compare each item with the whole target.", "Count the exact matches."], { mechanic: "response inhibition over a stream" });
};

// ---- visual rotation: net rotation over many turns, then clockwise and counterclockwise
const SHAPE_NAMES = ["L-shape", "T-shape", "arrow pointing north", "asymmetric five-cell shape"];
const NET = ["back to the start", "90° clockwise", "180°", "270° clockwise"];
const visualRotation: Builder = (g, t, l) => {
  if (t <= 5) return null;
  const shape = pick(SHAPE_NAMES);
  let prompt: string, net: number;
  if (t <= 10) { const turns = rnd(4, 11); net = turns % 4; prompt = `${article(shape)} is rotated ${turns} quarter-turns clockwise. What is its final orientation compared with the start?`; }
  else { const a = rnd(2, 9), b = rnd(1, 9); net = (((a - b) % 4) + 4) % 4; prompt = `${article(shape)} is rotated ${a} quarter-turns clockwise, then ${b} quarter-turns counterclockwise. What is its final orientation compared with the start?`; }
  return ch(g, t, l, prompt, NET[net], [...NET].reverse(), "Four quarter-turns bring a shape back to the start, so only the remainder after dividing by four matters; counterclockwise turns cancel clockwise ones.", ["Find the net number of clockwise quarter-turns.", "Take it modulo four.", "0 means back to the start, 1 is 90°, 2 is 180°, 3 is 270° clockwise."], { mechanic: "net orientation by modular arithmetic" });
};

// ---- mirror image: bigger grid, then diagonal mirrors
const mirrorImage: Builder = (g, t, l) => {
  if (t <= 5) return null;
  if (t <= 10) {
    const axis = pick(["vertical", "horizontal"]), p = pick([1, 2, 3, 5, 6, 7]), q = pick([1, 2, 3, 5, 6, 7]), dim = axis === "vertical" ? "column" : "row";
    const c = axis === "vertical" ? p : q;
    return ch(g, t, l, `A point is at column ${p}, row ${q} on a 7×7 grid (numbered 1–7). Reflect it across the ${axis} centre line (${dim} 4). What is the reflected point's ${dim} number?`, String(8 - c), ["1", "2", "3", "4", "5", "6", "7"], "A reflection across the centre line sends position n to 8 − n on a 7-cell axis.", ["Find the coordinate perpendicular to the mirror line.", "Reflect it: new = 8 − old.", "The other coordinate stays the same."], { mechanic: "reflection and coordinate mapping" });
  }
  const main = rnd(0, 1) === 0;
  let p = rnd(1, 7), q = rnd(1, 7);
  while (main ? p === q : p + q === 8) { p = rnd(1, 7); q = rnd(1, 7); }
  const [nc, nr] = main ? [q, p] : [8 - q, 8 - p];
  return mk(g, t, l, "input", `A point is at column ${p}, row ${q} on a 7×7 grid (numbered 1–7, row 1 at the top). Reflect it across the ${main ? "main diagonal (top-left to bottom-right)" : "anti-diagonal (top-right to bottom-left)"}. Enter the new position as column,row.`, `${nc},${nr}`, "A main-diagonal mirror swaps column and row; an anti-diagonal mirror sends (column, row) to (8 − row, 8 − column).", ["Name the diagonal.", main ? "Swap the two coordinates." : "New column = 8 − row, new row = 8 − column.", "Write column,row."], { mechanic: "diagonal reflection" });
};

// ---- odd-one-out style multi-rule patterns
const multiRule: Builder = (g, t, l) => {
  if (t <= 5) return null;
  const sa = rnd(1, 9), a = rnd(2, 5), sb = t <= 10 ? rnd(1, 9) : rnd(1, 3);
  let c = rnd(2, 6);
  while (t <= 10 && c === a) c = rnd(2, 6);
  const evenAt = (k: number): number => (t <= 10 ? sb + k * c : sb * 2 ** k);
  const seq = Array.from({ length: 7 }, (_, i) => (i % 2 === 0 ? sa + (i / 2) * a : evenAt((i - 1) / 2)));
  return mk(g, t, l, "input", `Two patterns are interleaved (odd positions and even positions follow different rules): ${seq.join(", ")}. What is the next term?`, evenAt(3), "Split the terms by position; the next term is an even position, so extend the even-position rule by one step.", ["Take the odd positions and the even positions separately.", "Find each rule.", "The next position is even: extend that rule."], { mechanic: "interleaved sequences with different rules" });
};

// ---- assignment puzzles for four people (brute force over all 24 matchings)
const PERMS4: number[][] = (() => { const out: number[][] = []; const go = (cur: number[]): void => { if (cur.length === 4) { out.push(cur); return; } for (let i = 0; i < 4; i++) if (!cur.includes(i)) go([...cur, i]); }; go([]); return out; })();
type AClue = { type: "owns" | "not"; person: number; thing: number };
function assignment(g: GameEntry, t: number, l: number, things: string[], noun: string, the: boolean): Round | null {
  const people = ["Ada", "Ben", "Cy", "Dee"];
  const nm = (i: number): string => (the ? `the ${things[i]}` : (things[i] as string));
  for (let attempt = 0; attempt < 200; attempt++) {
    const perm = shuffle([0, 1, 2, 3]);
    const ask = rnd(0, 3);
    const clues: AClue[] = [];
    const holds = (p: number[], c: AClue): boolean => (c.type === "owns" ? p[c.person] === c.thing : p[c.person] !== c.thing);
    const askedOwner = (p: number[]): number => p.indexOf(ask);
    for (let k = 0; k < 8; k++) {
      const person = rnd(0, 3);
      const owns = rnd(0, 2) === 0;
      const thing = owns ? (perm[person] as number) : pick([0, 1, 2, 3].filter((x) => x !== perm[person]));
      if (owns && thing === ask) continue;
      if (clues.some((c) => c.person === person && c.thing === thing && c.type === (owns ? "owns" : "not"))) continue;
      clues.push({ type: owns ? "owns" : "not", person, thing });
      const sols = PERMS4.filter((p) => clues.every((c) => holds(p, c)));
      if (sols.length > 0 && new Set(sols.map(askedOwner)).size === 1 && clues.length >= 3) {
        const text = clues.map((c) => `${people[c.person]} ${c.type === "owns" ? "owns" : "does not own"} ${nm(c.thing)}.`).join(" ");
        return ch(g, t, l, `${people.join(", ")} each own exactly one different ${noun}: ${things.join(", ")}. ${text} Who owns ${nm(ask)}?`, people[askedOwner(sols[0] as number[])] as string, people, "Each person has exactly one distinct item; eliminate every assignment that breaks a clue.", ["List who can own what.", "Cross out each impossible pairing from the clues.", "Whatever remains for the asked item names the owner."], { assign: { people, things, clues, ask }, mechanic: "one-to-one constraint elimination, four people" });
      }
    }
  }
  return null;
}
const logicGrid: Builder = (g, t, l) => (t < 8 ? null : assignment(g, t, l, ["red", "blue", "green", "yellow"], "colour", false));
const whoOwnsWhat: Builder = (g, t, l) => (t < 8 ? null : assignment(g, t, l, ["cat", "dog", "bird", "fish"], "pet", true));

// ---- lock: clue sets proven to give exactly one code
type LClue = { kind: "reveal" | "even" | "odd" | "greater" | "plus" | "sum" | "distinct"; i: number; j?: number; k?: number };
const lockClueText = (c: LClue): string => c.kind === "reveal" ? `digit ${c.i + 1} is ${c.k}` : c.kind === "even" ? `digit ${c.i + 1} is even` : c.kind === "odd" ? `digit ${c.i + 1} is odd` : c.kind === "greater" ? `digit ${c.i + 1} is greater than digit ${(c.j as number) + 1}` : c.kind === "plus" ? `digit ${c.i + 1} equals digit ${(c.j as number) + 1} plus ${c.k}` : c.kind === "sum" ? `the digits add up to ${c.k}` : "no digit repeats";
const lockHolds = (code: number[], c: LClue): boolean => c.kind === "reveal" ? code[c.i] === c.k : c.kind === "even" ? (code[c.i] as number) % 2 === 0 : c.kind === "odd" ? (code[c.i] as number) % 2 === 1 : c.kind === "greater" ? (code[c.i] as number) > (code[c.j as number] as number) : c.kind === "plus" ? code[c.i] === (code[c.j as number] as number) + (c.k as number) : c.kind === "sum" ? code.reduce((a, b) => a + b, 0) === c.k : new Set(code).size === code.length;
const lock: Builder = (g, t, l) => {
  if (t < 7) return null;
  const L = t <= 10 ? 3 : 4;
  const all: number[][] = [];
  for (let n = 0; n < 10 ** L; n++) all.push(String(n).padStart(L, "0").split("").map(Number));
  for (let attempt = 0; attempt < 60; attempt++) {
    const code = Array.from({ length: L }, () => rnd(0, 9));
    const clues: LClue[] = [];
    let left = all;
    for (let k = 0; k < 8 && left.length > 1; k++) {
      const i = rnd(0, L - 1);
      let j = rnd(0, L - 1);
      while (j === i) j = rnd(0, L - 1);
      const kind = pick<LClue["kind"]>(["even", "odd", "greater", "plus", "sum", "distinct", "reveal"]);
      const c: LClue = kind === "reveal" ? { kind, i, k: code[i] as number } : kind === "plus" ? { kind, i, j, k: Math.abs((code[i] as number) - (code[j] as number)) } : kind === "sum" ? { kind, i, k: code.reduce((a, b) => a + b, 0) } : { kind, i, j };
      let c2: LClue = c;
      if (c.kind === "plus") c2 = (code[i] as number) >= (code[j] as number) ? c : { kind: "plus", i: j, j: i, k: c.k };
      if (c2.kind === "greater" && (code[c2.i] as number) <= (code[c2.j as number] as number)) c2 = { kind: "greater", i: c2.j as number, j: c2.i };
      if (!lockHolds(code, c2) || (c2.kind === "greater" && code[c2.i] === code[c2.j as number]) || (c2.kind === "even" && (code[c2.i] as number) % 2) || (c2.kind === "odd" && (code[c2.i] as number) % 2 === 0)) continue;
      const next = left.filter((x) => lockHolds(x, c2));
      if (next.length === left.length) continue;
      clues.push(c2);
      left = next;
    }
    if (left.length === 1) {
      return mk(g, t, l, "input", `A ${L}-digit lock obeys all of these clues: ${clues.map(lockClueText).join("; ")}. Enter the code.`, code.join(""), "Every clue must hold at once; narrow the possibilities clue by clue.", ["Start with the clues that name or restrict a single digit.", "Use the relations between digits to narrow the rest.", "Check the finished code against every clue."], { lockClues: clues, mechanic: "constraint intersection over digits" });
    }
  }
  return null;
};

// ---- escape room: a longer clue chain
const FACTS: Array<[string, number]> = [["the number of sides on a triangle", 3], ["the number of sides on a square", 4], ["the number of days in a weekend", 2], ["the number of sides on a hexagon", 6], ["the number of wheels on a bicycle", 2]];
const escapeRoom: Builder = (g, t, l) => {
  if (t < 8) return null;
  for (let tries = 0; tries < 300; tries++) {
    const [d, f] = pick(FACTS), k = rnd(1, 4), s = f + k, th = f + s, fo = th - f;
    if (th <= 9 && fo >= 0 && fo <= 9) return mk(g, t, l, "input", `Escape-room sequence: a note says “first digit = ${d}; second = ${k} more than first; third = first + second; fourth = third minus first.” Enter the four-digit code.`, `${f}${s}${th}${fo}`, "Solve each clue in order; each digit uses the digits before it.", [`The first digit is ${f}.`, `The second digit is ${f} + ${k} = ${s}.`, `The third digit is ${f} + ${s} = ${th}.`, `The fourth digit is ${th} − ${f} = ${fo}.`], { question: "Four-digit code", mechanic: "ordered clue chain" });
  }
  return null;
};

// ---- tic-tac-toe: block, then choose between winning and blocking
const TTT_SYM = [[0, 1, 2, 3, 4, 5, 6, 7, 8], [2, 1, 0, 5, 4, 3, 8, 7, 6], [6, 7, 8, 3, 4, 5, 0, 1, 2], [8, 7, 6, 5, 4, 3, 2, 1, 0], [0, 3, 6, 1, 4, 7, 2, 5, 8], [6, 3, 0, 7, 4, 1, 8, 5, 2], [2, 5, 8, 1, 4, 7, 0, 3, 6], [8, 5, 2, 7, 4, 1, 6, 3, 0]];
const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const completes = (b: readonly string[], mark: string): number[] => { const out: number[] = []; b.forEach((v, k) => { if (v === "" && TTT_LINES.some((ln) => ln.includes(k) && ln.filter((i) => i !== k).every((i) => b[i] === mark))) out.push(k + 1); }); return out; };
const ticTacToe: Builder = (g, t, l) => {
  if (t <= 5) return null;
  const block = t <= 10;
  const base = block ? ["", "O", "", "", "O", "", "", "", "X"] : ["X", "X", "", "O", "O", "", "", "", ""];
  const sym = pick(TTT_SYM);
  const board = sym.map((i) => base[i] as string);
  const want = block ? completes(board, "O") : completes(board, "X");
  if (want.length !== 1) return null;
  const prompt = block ? `Tic-tac-toe squares are numbered 1–9, row by row. Board: ${board.map((v) => v || "·").join(" ")}. X to move and X cannot win this turn. Which square must X take to stop O from winning?` : `Tic-tac-toe squares are numbered 1–9, row by row. Board: ${board.map((v) => v || "·").join(" ")}. X to move, and O also threatens to complete a line. Which move is best?`;
  return ch(g, t, l, prompt, String(want[0]), ["1", "2", "3", "4", "5", "6", "7", "8", "9"], block ? "When the opponent threatens to finish a line and you cannot win first, take the square that finishes their line." : "If you can win immediately, do it: winning ends the game before the opponent's threat matters.", block ? ["Find any square that wins for X; there is none.", "Find the square that would finish a line for O.", "Take it."] : ["Look for a square that completes a line of three X marks.", "Compare it with O's threat.", "Winning now beats blocking."], { board, winningSquares: want, mechanic: block ? "blocking" : "win-or-block decision" });
};


// ---- prime factorisation: the primes get bigger
const primeFactor: Builder = (g, t, l) => {
  const pool = t <= 5 ? [2, 3, 5] : t <= 10 ? [2, 3, 5, 7, 11] : [5, 7, 11, 13];
  const p = pick(pool), q = pick(pool), n = p * p * q;
  const factors = p === q ? `${p}^3` : p < q ? `${p}^2×${q}` : `${q}×${p}^2`;
  return mk(g, t, l, "input", `Give the prime factorization of ${n} using ascending primes and exponents, for example 13^2×17.`, factors, "Repeatedly divide by the smallest prime that divides the number, then collect equal factors.", ["Test divisibility by small primes.", "Continue until every factor is prime.", "Group repeated primes using exponents."], { mechanic: "prime decomposition" });
};

// ---- connect four: taller columns
const connectFour: Builder = (g, t, l) => {
  if (t <= 5) return null;
  const R = t <= 10 ? 7 : 8, height = rnd(0, R - 1);
  return ch(g, t, l, `Connect Four (tall board, ${R} rows): a column currently contains ${height} checker${height === 1 ? "" : "s"}. Rows are numbered 1 (bottom) to ${R} (top). Which row will the next checker occupy if pieces fall to the lowest empty space?`, `row ${height + 1}`, Array.from({ length: R }, (_, i) => `row ${i + 1}`), "Gravity places a checker in the lowest unoccupied cell of the selected column.", ["Count the occupied cells from the bottom.", "The next checker lands on the row just above the highest checker.", "With h checkers in the column, the next one lands on row h + 1."], { mechanic: "gravity and landing-row calculation" });
};

// ---- word chain: two missing words
const wordChainTwo: Builder = (g, t, l) => {
  if (t <= 5) return null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const len = pick([3, 4]);
    const dict = [...new Set(CHAIN_DICT)].filter((w) => w.length === len);
    const a = pick(dict);
    const xs = dict.filter((w) => ham(a, w) === 1); if (!xs.length) continue;
    const x = pick(xs);
    const ys = dict.filter((w) => ham(x, w) === 1 && w !== a); if (!ys.length) continue;
    const y = pick(ys);
    const ds = dict.filter((w) => ham(y, w) === 1 && w !== x && w !== a); if (!ds.length) continue;
    const d = pick(ds);
    const isValid = (u: string, v: string): boolean => u !== v && ham(a, u) === 1 && ham(u, v) === 1 && ham(v, d) === 1;
    const wrong: string[] = [];
    for (let k = 0; k < 400 && wrong.length < 3; k++) { const u = pick(dict), v = pick(dict); const opt = `${u} ${v}`; if (u !== v && !isValid(u, v) && !wrong.includes(opt) && opt !== `${x} ${y}`) wrong.push(opt); }
    if (wrong.length < 3) continue;
    return ch(g, t, l, `Change exactly one letter at each step: ${a} → ? → ? → ${d}. Which pair of words completes the chain?`, `${x} ${y}`, shuffle([`${x} ${y}`, ...wrong]), "Every step changes exactly one letter and the result is a real word of the same length.", ["Check the first missing word against the start word.", "Check the second against the first and against the last word.", "Reject any pair where one step changes more than one letter."], { mechanic: "two-step one-letter path" });
  }
  return null;
};


// ---- outlier detection: the shared property changes from multiples to squares to powers of two
const abstractOdd: Builder = (g, t, l) => {
  let values: number[], odd: number, rule: string;
  if (t <= 5) { const b = rnd(2, 9); values = [2, 3, 4, 5].map((k) => k * b); odd = 2 * b + 1; rule = `multiples of ${b}`; }
  else if (t <= 10) { values = shuffle([4, 9, 16, 25, 36, 49, 64, 81]).slice(0, 4); odd = pick([10, 15, 20, 30, 40, 50, 60, 70]); rule = "perfect squares"; }
  else { values = shuffle([2, 4, 8, 16, 32, 64, 128, 256]).slice(0, 4); odd = pick([12, 24, 48, 96, 100, 200]); rule = "powers of 2"; }
  const all = shuffle([...values, odd]);
  return ch(g, t, l, `Four values are ${rule}; one is not. Select the outlier: ${all.join(", ")}.`, String(odd), all.map(String), "Test each value against the shared property; exactly one fails it.", ["Name the property the group shares.", "Test each value against it.", "Select the only value that fails."], { mechanic: "invariant-based outlier detection" });
};

// ---- cube faces: opposite faces of a die add up to 7
const cubeNet: Builder = (g, t, l) => {
  if (t <= 5) return null;
  const [a, b, c] = shuffle([[1, 6], [2, 5], [3, 4]]).map((pr) => pick(pr)) as [number, number, number];
  const ask = pick(["bottom", "back", "left"]);
  const hidden = ask === "bottom" ? 7 - a : ask === "back" ? 7 - b : 7 - c;
  return ch(g, t, l, `A standard die has opposite faces that add up to 7. You can see top ${a}, front ${b}, right ${c}. What number is on the ${ask} face?`, String(hidden), ["1", "2", "3", "4", "5", "6"], "On a standard die each face and the face opposite it add up to 7.", ["Name the face opposite the one you are asked about.", "Find its number among the visible faces.", "Subtract it from 7."], { mechanic: "opposite-face reasoning" });
};

const BUILDERS: Record<string, Builder> = {
  "bridge-crossing": bridge, "reverse-spelling": reverseSpelling, "hidden-word": hiddenWord, "visual-change-detection": changeDetection,
  "target-switch": targetSwitch, "color-word-conflict": colorWord, "go-or-no-go": goNoGo, "visual-rotation": visualRotation,
  "mirror-image": mirrorImage, "multi-rule-patterns": multiRule, "logic-grid": logicGrid, "who-owns-what": whoOwnsWhat,
  "the-impossible-lock": lock, "escape-room": escapeRoom, "tic-tac-toe-master": ticTacToe,
  "abstract-odd-one-out": abstractOdd, "cube-net": cubeNet, "prime-factor-challenge": primeFactor, "connect-four": connectFour, "word-chain": wordChainTwo,
};
export const TIERED_IDS: readonly string[] = Object.keys(BUILDERS);
export function createTieredRound(game: GameEntry, tier: number, level: number, levels: number = 3): Round | null {
  const builder = BUILDERS[game.id];
  if (!builder) return null;
  LC = Math.max(1, Number(levels) || 3);
  return builder(game, clamp(Number(tier) || 1, 1, 15), clamp(Number(level) || 1, 1, 3));
}
