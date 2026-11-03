/**
 * Imposter game logic, kept free of any UI so it can be tested on its own.
 * Implements the Playref standard rules in rules/imposter.md.
 */
import { WORD_PACKS, type WordPack } from './words';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;

/** A random number in [0, 1). Injected so tests are repeatable. */
export type Rng = () => number;

export const cryptoRng: Rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
};

/** Rule I2: 1 imposter for 3 to 6 players, 2 for 7 to 10. */
export function imposterCount(players: number): number {
  return players >= 7 ? 2 : 1;
}

/**
 * How many rounds each player has gone without being the imposter, and who was
 * imposter last round. Lives on the phone between rounds.
 */
export interface Fairness {
  waits: number[];
  last: number[];
}

export function freshFairness(players: number): Fairness {
  return { waits: Array.from({ length: players }, () => 0), last: [] };
}

/** Picks one index with probability proportional to its weight. */
function weightedPick(weights: number[], rng: Rng): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Rule I5: fair random picking. Nobody who was imposter last round can be picked
 * this round, and the longer someone has waited, the more likely they are picked.
 */
export function pickImposters(players: number, fairness: Fairness, rng: Rng): number[] {
  const count = imposterCount(players);
  const picked: number[] = [];
  const blocked = new Set(fairness.last);
  // With 3 players and 1 imposter there are always 2 others to choose from, so blocking never empties the pool.
  const weights = Array.from({ length: players }, (_, i) => (blocked.has(i) ? 0 : 1 + (fairness.waits[i] ?? 0)));
  for (let k = 0; k < count; k++) {
    const i = weightedPick(weights, rng);
    picked.push(i);
    weights[i] = 0;
  }
  return picked.sort((a, b) => a - b);
}

export function updateFairness(players: number, fairness: Fairness, imposters: number[]): Fairness {
  const waits = Array.from({ length: players }, (_, i) => (imposters.includes(i) ? 0 : (fairness.waits[i] ?? 0) + 1));
  return { waits, last: imposters };
}

/** Picks a word from the pack, avoiding words already used tonight when possible. */
export function pickWord(pack: WordPack, used: string[], rng: Rng): string {
  const fresh = pack.words.filter((w) => !used.includes(w));
  const pool = fresh.length ? fresh : pack.words;
  return pool[Math.floor(rng() * pool.length)];
}

/** Rule I6: the first clue giver is random but never an imposter. */
export function pickStarter(players: number, imposters: number[], rng: Rng): number {
  const pool = Array.from({ length: players }, (_, i) => i).filter((i) => !imposters.includes(i));
  return pool[Math.floor(rng() * pool.length)];
}

export interface Round {
  players: number;
  packId: string;
  category: string;
  word: string;
  imposters: number[];
  starter: number;
}

export function dealRound(players: number, packId: string, fairness: Fairness, used: string[], rng: Rng = cryptoRng): Round {
  if (players < MIN_PLAYERS || players > MAX_PLAYERS) throw new Error(`Imposter needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  const pack = WORD_PACKS.find((p) => p.id === packId) ?? WORD_PACKS[0];
  const imposters = pickImposters(players, fairness, rng);
  return { players, packId: pack.id, category: pack.category, word: pickWord(pack, used, rng), imposters, starter: pickStarter(players, imposters, rng) };
}

/** What a player sees on their card (rule I3). Same shape for everyone so the layout never gives it away. */
export function cardFor(round: Round, player: number): { title: string; main: string; category: string } {
  return round.imposters.includes(player)
    ? { title: 'YOU ARE THE', main: 'IMPOSTER', category: round.category }
    : { title: 'YOUR WORD', main: round.word, category: round.category };
}

/** Rule I14 points (optional). */
export function scoreRound(round: Round, outcome: { escaped: number[]; caughtRight: number[]; imposterWin: boolean }): number[] {
  const pts = Array.from({ length: round.players }, () => 0);
  for (const i of outcome.escaped) pts[i] += 2;
  for (const i of outcome.caughtRight) pts[i] += 1;
  if (!outcome.imposterWin) for (let i = 0; i < round.players; i++) if (!round.imposters.includes(i)) pts[i] += 1;
  return pts;
}
