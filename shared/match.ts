import { FIGHTS } from './generated/rules-data';
import { normalize } from './normalize';
import type { Fight } from './types';

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Words that show a question is about a card game. Deliberately leaves out words that are
 * common outside games ("skip", "reverse", "black", "win", "point"), which the fights still use.
 */
const GAME_WORDS = [
  'uno', 'card', 'play', 'turn', 'game', 'deck', 'pile', 'colour', 'color', '+2', '+4', 'wild', 'draw', 'drew',
  'hand', 'round', 'deal', 'player', 'rule', 'stack', 'swap', 'challenge', 'shuffle', '7', '0', 'seven', 'zero',
];

/** True when the text is clearly about a card game. */
export function hasGameWords(question: string): boolean {
  const text = normalize(question);
  return GAME_WORDS.some((w) => hits(text, w));
}

/** A phrase hits when it appears at the start of a word (so "stack" also hits "stacking"). */
function hits(text: string, phrase: string): boolean {
  return new RegExp(`(?:^| )${escape(normalize(phrase))}`).test(text);
}

/**
 * Step 1 of the ask path. Returns the known fight only when EVERY match group
 * hits (a confident match). When several fights match, the one with the most
 * groups wins (more specific); ties go to the fight listed first.
 * Returns null for a weak or no match, so the question goes on to step 2.
 */
export function matchFight(question: string, fights: Fight[] = FIGHTS): Fight | null {
  const text = normalize(question);
  if (!text) return null;
  // A known fight only matches a question that is clearly about a card game.
  // Without this, "Who will win the next election?" matched "How do you win UNO?".
  if (!GAME_WORDS.some((w) => hits(text, w))) return null;
  let best: Fight | null = null;
  for (const f of fights) {
    const all = f.match.every((group) => group.some((p) => hits(text, p)));
    if (all && (!best || f.match.length > best.match.length)) best = f;
  }
  return best;
}
