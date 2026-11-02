import { FIGHTS } from './generated/rules-data';
import { normalize } from './normalize';
import type { Fight } from './types';

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  let best: Fight | null = null;
  for (const f of fights) {
    const all = f.match.every((group) => group.some((p) => hits(text, p)));
    if (all && (!best || f.match.length > best.match.length)) best = f;
  }
  return best;
}
