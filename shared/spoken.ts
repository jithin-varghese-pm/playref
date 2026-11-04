/**
 * What "Read it out" says, and the key its recording is stored under.
 * Shared by the browser, the server and the clip maker, so a clip always matches its text.
 */
import type { Answer } from './types';

/** The Playref voice. Changing the voice or its style gives every clip a new key, so old clips are never played. */
export const VOICE_NAME = 'Aoede';
/**
 * Style notes for the voice. They go in a "director's notes" block above the words, because a
 * plain "Read this like..." line in front of the words gets read out loud (seen on 4 Nov 2026).
 */
export const VOICE_STYLE = 'Style: a friendly, confident referee settling an argument at a card game.\nAccent: warm Indian English.\nPace: natural.';
export const VOICE_ID = 'aoede-v2';

/** The full prompt sent to the voice model: notes first, then only the words to say. */
export function voicePrompt(text: string, style = VOICE_STYLE): string {
  return `### DIRECTOR'S NOTES\n${style}\n\n### TRANSCRIPT\n${text}`;
}

const VERDICT_SAID: Record<Answer['verdict'], string> = {
  YES: 'Yes.',
  NO: 'No.',
  'HOUSE RULE': 'House rule.',
  RULE: 'The rule.',
  'NOT SURE': 'Not sure.',
};

/** Card names said the way players say them. */
function sayable(text: string): string {
  return text
    .replace(/\+\s?2\b/g, 'plus 2')
    .replace(/\+\s?4\b/g, 'plus 4')
    .replace(/\s+/g, ' ')
    .trim();
}

function endSentence(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** The cloud voices take at most this many characters: cut at the last full sentence that fits. */
export function fitForVoice(text: string, max = 600): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return end > 0 ? cut.slice(0, end + 1) : cut;
}

/** What gets read: the verdict, the one-line ruling, then what the rules say. */
export function spokenText(a: Pick<Answer, 'verdict' | 'label' | 'line' | 'rules'>): string {
  const verdict = a.label ? endSentence(a.label.charAt(0) + a.label.slice(1).toLowerCase()) : VERDICT_SAID[a.verdict];
  return fitForVoice(sayable(`${verdict} ${endSentence(a.line)} ${endSentence(a.rules)}`));
}

/**
 * A short, fixed key for a spoken text in the Playref voice (cyrb53, 64 bits as hex).
 * Synchronous on purpose: on iPhones, sound must start inside the tap, with no waiting first.
 */
export function voiceKey(text: string): string {
  const s = `${VOICE_ID}|${text}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
