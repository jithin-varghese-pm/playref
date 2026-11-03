import { normalize } from '../shared/normalize';
import { containsAbuse } from './abuse';

export type Scope = 'in' | 'other-version' | 'not-uno' | 'abuse' | 'chitchat';

/** Greetings and questions about the bot itself: answered with a friendly intro, never sent to the AI. */
const GREETING = /^(hi+|hello+|hey+|yo|hola|namaste|good (morning|afternoon|evening|night)|sup|whats up|wassup|ok|okay|thanks|thank you|thx|bye|good bye|goodbye|lol|cool|nice)( (there|playref|bro|da|machane|buddy|all|thanks|bye))*$/;
const ABOUT_BOT = /\b(are you (a |an )?(bot|ai|robot|human|real|chatgpt|claude|gpt)|who (are|made|built|created) you|what are you|your name)\b/;

// Names of other UNO versions, and cards that only exist in them. Generic phrases that also make
// sense in Classic ("discard all my cards", "draw 10 cards as a penalty") are deliberately left out.
const OTHER_VERSIONS = [
  'no mercy', 'uno flip', 'flip side', 'dark side', 'light side', 'uno attack', 'card launcher', 'uno dos', 'uno flex',
  'uno all wild', 'uno show em', 'show em no mercy', 'uno junior', 'uno teams', 'stacko', 'wild color roulette',
  'wild colour roulette', 'color roulette', 'colour roulette', 'skip everyone', 'wild draw six', 'wild draw ten',
  'wild draw 6', 'wild draw 10', 'wild +6', 'wild +10', '+6', '+10',
];
const OTHER_GAMES = [
  'chess', 'poker', 'monopoly', 'rummy', 'ludo', 'carrom', 'scrabble', 'catan', 'teen patti', 'blackjack',
  'solitaire', 'go fish', 'cricket', 'football', 'antakshari', 'charades', 'mafia', 'werewolf', 'bridge', 'snakes and ladders',
];
const UNO_WORDS = ['uno', 'card', '+2', '+4', 'wild', 'skip', 'reverse', 'draw', 'deck', 'pile', 'colour', 'color'];

function has(text: string, phrase: string): boolean {
  // Whole words only, so "+65" or "+100" never count as "+6" or "+10".
  return ` ${text} `.includes(` ${normalize(phrase)} `);
}

/**
 * Runs before any AI call. Catches abuse, small talk, other UNO versions and other games,
 * so none of them use AI quota or get a confusing "rules" answer.
 */
export function classifyScope(question: string): Scope {
  const text = normalize(question);
  if (containsAbuse(question)) return 'abuse';
  if (GREETING.test(text) || (ABOUT_BOT.test(text) && !UNO_WORDS.some((p) => has(text, p)))) return 'chitchat';
  if (OTHER_VERSIONS.some((p) => has(text, p))) return 'other-version';
  // "Flip" on its own means UNO Flip ("what is flip?"), but "flip the first card" / "flipped over" is Classic.
  if (/(^| )flip( (?!the |over|a |it|first|my |your |his |her |their |them|up|down|cards?|face)|$)/.test(text)) return 'other-version';
  if (OTHER_GAMES.some((p) => has(text, p)) && !UNO_WORDS.some((p) => has(text, p))) return 'not-uno';
  return 'in';
}
