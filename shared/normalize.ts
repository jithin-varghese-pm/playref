/**
 * Cleans up a typed question so that different spellings of the same idea
 * look the same: lower case, no punctuation, and card names unified
 * ("draw two", "plus 2", "+ 2" all become "+2"; Wild Draw Four becomes "+4").
 *
 * Letters and digits of every script are kept (Hindi, Malayalam, Kannada...),
 * so questions in other scripts never collapse into the same empty text.
 * Invisible characters are removed first, so they cannot hide words.
 */
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯﻿]/g;

// "draw two cards" / "draw 4 cards" (taking cards from the pile) is NOT the +2 / +4 card,
// so the bare "draw N" forms are only unified when not followed by "cards".
const NOT_CARDS = '(?!\\s*cards\\b)';
const PLUS4: RegExp[] = [
  /\bwild\s*\+\s*4s?\b/g,
  /\bwild\s+draw\s*(?:four|4)s?\b/g,
  /\bwd4s?\b/g,
  /\bwild\s+(?:four|4)s?\b/g,
  new RegExp(`\\bdraw\\s*(?:four|4)s?\\b${NOT_CARDS}`, 'g'),
  /\bplus\s+(?:four|4)s?\b/g,
  /\+\s*4s?\b/g,
];
const PLUS2: RegExp[] = [new RegExp(`\\bdraw\\s*(?:two|2)s?\\b${NOT_CARDS}`, 'g'), /\bplus\s+(?:two|2)s?\b/g, /\+\s*2s?\b/g];

export function normalize(input: string): string {
  let s = ` ${input.normalize('NFKC').replace(INVISIBLE, '').toLowerCase()} `;
  s = s.replace(/[’'`]/g, ' ').replace(/-/g, ' ');
  for (const re of PLUS4) s = s.replace(re, ' +4 ');
  for (const re of PLUS2) s = s.replace(re, ' +2 ');
  s = s.replace(/[^\p{L}\p{M}\p{N}+ ]+/gu, ' ');
  return s.replace(/\s+/g, ' ').trim();
}
