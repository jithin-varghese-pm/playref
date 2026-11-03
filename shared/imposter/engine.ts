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

/** Nobody is the imposter more than this many rounds in a row (rule I5). */
export const MAX_IN_A_ROW = 2;

/**
 * How many rounds in a row each player has just been the imposter, and who was
 * imposter last round. Lives on the phone between rounds.
 */
export interface Fairness {
  streak: number[];
  last: number[];
}

export function freshFairness(players: number): Fairness {
  return { streak: Array.from({ length: players }, () => 0), last: [] };
}

/**
 * Rule I5: plain random picking, everyone with the same chance, so nobody can be ruled out
 * just because they were the imposter last round. The only limit: someone who has been the
 * imposter MAX_IN_A_ROW rounds in a row sits out one round. No extra odds for whoever has
 * waited longest, because that becomes a pattern players can read.
 */
export function pickImposters(players: number, fairness: Fairness, rng: Rng): number[] {
  const count = imposterCount(players);
  const all = Array.from({ length: players }, (_, i) => i);
  let pool = all.filter((i) => (fairness.streak[i] ?? 0) < MAX_IN_A_ROW);
  // At most `count` players can be on a full streak, and there are always more players than that,
  // but never let a bad saved state leave too few to choose from.
  if (pool.length < count) pool = all;
  const picked: number[] = [];
  for (let k = 0; k < count; k++) {
    const at = Math.floor(rng() * pool.length);
    picked.push(pool[at]);
    pool = pool.filter((_, j) => j !== at);
  }
  return picked.sort((a, b) => a - b);
}

export function updateFairness(players: number, fairness: Fairness, imposters: number[]): Fairness {
  const streak = Array.from({ length: players }, (_, i) => (imposters.includes(i) ? (fairness.streak[i] ?? 0) + 1 : 0));
  return { streak, last: imposters };
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

/** "Surprise me": a random pack each round, never shown, so even the category stays secret (rule I3). */
export const SURPRISE = 'surprise';

export function dealRound(players: number, packId: string, fairness: Fairness, used: string[], rng: Rng = cryptoRng): Round {
  if (players < MIN_PLAYERS || players > MAX_PLAYERS) throw new Error(`Imposter needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  const pack =
    packId === SURPRISE ? WORD_PACKS[Math.floor(rng() * WORD_PACKS.length)] : (WORD_PACKS.find((p) => p.id === packId) ?? WORD_PACKS[0]);
  const imposters = pickImposters(players, fairness, rng);
  return { players, packId: pack.id, category: pack.category, word: pickWord(pack, used, rng), imposters, starter: pickStarter(players, imposters, rng) };
}

/**
 * What a player sees on their card (rule I3). The imposter gets no word and no category.
 * Every card has the same three lines so the layout never gives it away.
 */
export function cardFor(round: Round, player: number): { title: string; main: string; note: string } {
  return round.imposters.includes(player)
    ? { title: 'YOU ARE THE', main: 'IMPOSTER', note: 'Blend in and find the word' }
    : { title: 'YOUR WORD', main: round.word, note: "Don't say it out loud" };
}

/** Rule I14 points (optional). */
export function scoreRound(round: Round, outcome: { escaped: number[]; caughtRight: number[]; imposterWin: boolean }): number[] {
  const pts = Array.from({ length: round.players }, () => 0);
  for (const i of outcome.escaped) pts[i] += 2;
  for (const i of outcome.caughtRight) pts[i] += 1;
  if (!outcome.imposterWin) for (let i = 0; i < round.players; i++) if (!round.imposters.includes(i)) pts[i] += 1;
  return pts;
}
