/** Honest one-line notes a screen can show for games that are narrower than their name suggests (DT3). */
const NOTES: Record<string, string> = {};
const set = (ids: string[], note: string): void => { for (const id of ids) NOTES[id] = note; };

set(['chess', 'chess-tactics', 'checkmate-in-one', 'checkmate-in-two', 'chess-position-memory', 'blindfold-chess', 'chess-endgame-challenge', 'draughts', 'go', 'reversi', 'hex'], 'Rules and concept questions. There is no playable board.');
set(['flash-grid', 'pattern-reproduction', 'shape-sequence', 'spot-the-difference', 'image-recall'], 'Memorise lit cells on a grid, then tap them back.');
set(['connect-four', 'tic-tac-toe-master'], 'A position puzzle, not a full game.');
set(['imagine'], 'Open-ended. Nothing here is scored.');
set(['maze-master'], 'A route puzzle on three maze sizes.');

/** A short honest note for this game, or null when its name already says what it is. */
export function gameNote(id: string): string | null {
  return NOTES[id] ?? null;
}
export const GAME_NOTE_IDS: readonly string[] = Object.keys(NOTES);
