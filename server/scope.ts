import { normalize } from '../shared/normalize';

export type Scope = 'in' | 'other-version' | 'not-uno' | 'abuse' | 'chitchat';

/** Abuse in English and common Indian slang. Matched as whole words (and word starts for the f-word family). */
const ABUSE_STARTS = ['fuck', 'motherfuck', 'bitch', 'asshole', 'bastard', 'cunt', 'dickhead', 'chutiya', 'madarchod', 'behenchod', 'bhenchod', 'bhosdi'];
const ABUSE_WORDS = ['shit', 'dick', 'slut', 'whore', 'wtf', 'stfu', 'gandu', 'randi', 'myre', 'myran', 'thendi', 'kunna', 'poori'];

/** Greetings and questions about the bot itself: answered with a friendly intro, never sent to the AI. */
const GREETING = /^(hi+|hello+|hey+|yo|hola|namaste|good (morning|afternoon|evening|night)|sup|whats up|wassup)( (there|playref|bro|da|machane|buddy|all))?$/;
const ABOUT_BOT = /\b(are you (a |an )?(bot|ai|robot|human|real|chatgpt|claude|gpt)|who (are|made|built|created) you|what are you|your name)\b/;

const OTHER_VERSIONS = [
  'no mercy', 'uno flip', 'flip side', 'dark side', 'light side', 'uno attack', 'card launcher', 'uno dos', 'show em',
  'uno flex', 'all wild', 'uno junior', 'uno teams', 'stacko', 'wild color roulette', 'wild colour roulette',
  'skip everyone', 'discard all', '+6', '+10', 'draw 6', 'draw six', 'draw 10', 'draw ten',
];
const OTHER_GAMES = [
  'chess', 'poker', 'monopoly', 'rummy', 'ludo', 'carrom', 'scrabble', 'catan', 'teen patti', 'blackjack',
  'solitaire', 'go fish', 'cricket', 'football', 'antakshari', 'charades', 'mafia', 'werewolf', 'bridge', 'snakes and ladders',
];
const UNO_WORDS = ['uno', 'card', '+2', '+4', 'wild', 'skip', 'reverse', 'draw', 'deck', 'pile', 'colour', 'color'];

function has(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${normalize(phrase)} `) || (phrase.startsWith('+') && text.includes(phrase));
}

/**
 * Runs before any AI call. Catches abuse, small talk, other UNO versions and other games,
 * so none of them use AI quota or get a confusing "rules" answer.
 */
export function classifyScope(question: string): Scope {
  const text = normalize(question);
  const words = text.split(' ');
  if (words.some((w) => ABUSE_WORDS.includes(w) || ABUSE_STARTS.some((s) => w.startsWith(s)))) return 'abuse';
  if (GREETING.test(text) || (ABOUT_BOT.test(text) && !UNO_WORDS.some((p) => has(text, p)))) return 'chitchat';
  if (OTHER_VERSIONS.some((p) => has(text, p))) return 'other-version';
  if (OTHER_GAMES.some((p) => has(text, p)) && !UNO_WORDS.some((p) => has(text, p))) return 'not-uno';
  return 'in';
}
