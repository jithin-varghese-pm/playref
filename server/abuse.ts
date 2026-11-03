import { normalize } from '../shared/normalize';

/**
 * Abuse in English and common Indian slang. Whole words, plus word starts for the f-word family.
 * Kept narrow on purpose: "poori" (a food) and "Fukuoka" (a city) must not be flagged.
 */
const ABUSE_STARTS = ['fuck', 'fuk', 'fck', 'fvck', 'fcuk', 'phuck', 'motherfuck', 'bitch', 'asshole', 'bastard', 'cunt', 'dickhead', 'chutiy', 'madharchod', 'madarchod', 'behenchod', 'bhenchod', 'bhosdi'];
const ABUSE_START_EXCEPTIONS = ['fukuoka', 'fukushima'];
const ABUSE_WORDS = ['shit', 'sh1t', 'bullshit', 'dick', 'slut', 'whore', 'wtf', 'stfu', 'gandu', 'bsdk', 'randi', 'myre', 'myran', 'thendi', 'kunna'];

/** Extra words that are fine for a player to type in anger, but never acceptable in Playref's own answers. */
const INSULTS_FOR_ANSWERS = ['stupid', 'idiot', 'idiots', 'loser', 'losers', 'moron', 'morons', 'dumb', 'dumbass', 'shut up', 'hate you', 'suck', 'sucks'];

function isAbusiveWord(w: string): boolean {
  if (ABUSE_WORDS.includes(w)) return true;
  if (ABUSE_START_EXCEPTIONS.some((x) => w.startsWith(x))) return false;
  return ABUSE_STARTS.some((s) => w.startsWith(s));
}

/** Common letter swaps: f*ck, sh1t, $hit, @ss. Two guesses for "*". */
function unleet(text: string): string[] {
  const base = text.replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e').replace(/[$5]/g, 's').replace(/@/g, 'a');
  return [base.replace(/\*/g, 'u'), base.replace(/\*/g, 'i')];
}

/**
 * Joins spaced-out letters ("f u c k" -> "fuck") and squeezes repeats ("fuuuuck" -> "fuck").
 * Each run of 3+ single letters is checked on its own, and also without its first letter,
 * so "you are a f u c k i n g idiot" is caught even though the word "a" sits in front.
 */
function variants(text: string): string[] {
  const out = [text, text.replace(/([a-z])\1{2,}/g, '$1')];
  for (const run of text.match(/(?<![^ ])[a-z](?: [a-z](?![^ ]))+/g) ?? []) {
    const joined = run.replace(/ /g, '');
    if (joined.length >= 3) out.push(joined, joined.slice(1));
  }
  return out;
}

/** True when the text contains abuse. Used on what players type AND on what the AI writes back. */
export function containsAbuse(input: string): boolean {
  // Letter swaps are checked on the raw text, before normalize removes the symbols.
  const texts = [input, ...unleet(input.toLowerCase())].map(normalize);
  return texts.flatMap(variants).some((t) => t.split(' ').some(isAbusiveWord));
}

/** Stricter check for Playref's own answers: abuse plus everyday insults. */
export function answerIsRude(input: string): boolean {
  if (containsAbuse(input)) return true;
  const t = ` ${normalize(input)} `;
  return INSULTS_FOR_ANSWERS.some((w) => t.includes(` ${w} `));
}

/**
 * Removes the abusive parts and keeps the rest, so "Can I play a Skip on a Reverse? f*** this"
 * becomes "Can I play a Skip on a Reverse? this". Abuse glued to other text ("+2?fuck") is cut
 * out without losing the rest. Returns '' if nothing useful is left.
 */
export function removeAbuse(input: string): string {
  return input
    .split(/\s+/)
    .map((token) => {
      if (!containsAbuse(token)) return token;
      // Keep the non-abusive pieces of a token like "+2?fuck".
      return token
        .split(/([^\p{L}\p{N}]+)/u)
        .filter((piece) => !containsAbuse(piece))
        .join('')
        .trim();
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const URL_RE = /\b(?:https?:\/\/|hxxps?:\/\/|www\.)\S+|\/\/[\w-]+\.\S+/gi;
// A bare domain like "playref-prize.xyz" or "evil[.]com".
const DOMAIN_RE = /\b[\w-]+(?:\[\.\]|\.)(?:[a-z]{2,24})(?:\/\S*)?\b/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /\+?\(?\d[\d\s().-]{7,}\d/;

/** Removes links from AI text. Playref answers never need links; the rules sheet link is added by the app. */
export function stripLinks(text: string): string {
  return text.replace(URL_RE, '').replace(/\[([^\]]*)\]\(\s*\)/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

/** Contact details or web addresses have no place in a rules answer. */
export function hasContactOrDomain(text: string): boolean {
  // Card names like "+2" and plain numbers are fine; long digit runs, emails and domains are not.
  return EMAIL_RE.test(text) || PHONE_RE.test(text) || DOMAIN_RE.test(text.replace(/\b(?:e\.g|i\.e|etc)\./gi, ''));
}

/** Signs that the AI leaked its instructions or produced markup instead of an answer. */
export function looksLikeLeak(text: string): boolean {
  return /you are playref|rule cards\s*\n|<\s*script|<\/?[a-z][^>]*>/i.test(text);
}
