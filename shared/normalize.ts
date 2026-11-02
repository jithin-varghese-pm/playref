/**
 * Cleans up a typed question so that different spellings of the same idea
 * look the same: lower case, no punctuation, and card names unified
 * ("draw two", "plus 2", "+ 2" all become "+2"; Wild Draw Four becomes "+4").
 */
const PLUS4: RegExp[] = [
  /\bwild\s*\+\s*4s?\b/g,
  /\bwild\s+draw\s*(?:four|4)s?\b/g,
  /\bwd4s?\b/g,
  /\bwild\s+(?:four|4)s?\b/g,
  /\bdraw\s*(?:four|4)s?\b/g,
  /\bplus\s+(?:four|4)s?\b/g,
  /\+\s*4s?\b/g,
];
const PLUS2: RegExp[] = [/\bdraw\s*(?:two|2)s?\b/g, /\bplus\s+(?:two|2)s?\b/g, /\+\s*2s?\b/g];

export function normalize(input: string): string {
  let s = ` ${input.toLowerCase()} `;
  s = s.replace(/[\u2019'`]/g, ' ').replace(/-/g, ' ');
  for (const re of PLUS4) s = s.replace(re, ' +4 ');
  for (const re of PLUS2) s = s.replace(re, ' +2 ');
  s = s.replace(/[^a-z0-9+ ]+/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}
