import { normalize } from '../shared/normalize';

/** Abuse in English and common Indian slang. Whole words, plus word starts for the f-word family. */
const ABUSE_STARTS = ['fuck', 'fuk', 'fck', 'motherfuck', 'bitch', 'asshole', 'bastard', 'cunt', 'dickhead', 'chutiya', 'madarchod', 'behenchod', 'bhenchod', 'bhosdi'];
const ABUSE_WORDS = ['shit', 'dick', 'slut', 'whore', 'wtf', 'stfu', 'gandu', 'randi', 'myre', 'myran', 'thendi', 'kunna', 'poori'];

/** Joins spaced-out letters ("f u c k" -> "fuck") and squeezes repeats ("fuuuuck" -> "fuck"). */
function variants(text: string): string[] {
  const joined = text.replace(/\b([a-z]) (?=[a-z]\b)/g, '$1');
  const squeezed = text.replace(/([a-z])\1{2,}/g, '$1');
  return [text, joined, squeezed];
}

/** True when the text contains abuse. Used on what players type AND on what the AI writes back. */
export function containsAbuse(input: string): boolean {
  return variants(normalize(input)).some((t) =>
    t.split(' ').some((w) => ABUSE_WORDS.includes(w) || ABUSE_STARTS.some((s) => w.startsWith(s))),
  );
}

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;

/** Removes links from AI text. Playref answers never need links; the rules sheet link is added by the app. */
export function stripLinks(text: string): string {
  return text.replace(URL_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/** Signs that the AI leaked its instructions or produced markup instead of an answer. */
export function looksLikeLeak(text: string): boolean {
  return /you are playref|rule cards\s*\n|<\s*script|<\/?[a-z][^>]*>/i.test(text);
}
