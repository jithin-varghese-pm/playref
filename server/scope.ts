import { normalize } from '../shared/normalize';

export type Scope = 'in' | 'other-version' | 'not-uno';

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

/** Finds questions about other UNO versions or other games, so they never reach the AI. */
export function classifyScope(question: string): Scope {
  const text = normalize(question);
  if (OTHER_VERSIONS.some((p) => has(text, p))) return 'other-version';
  if (OTHER_GAMES.some((p) => has(text, p)) && !UNO_WORDS.some((p) => has(text, p))) return 'not-uno';
  return 'in';
}
