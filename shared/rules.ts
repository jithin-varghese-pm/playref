import { FIGHTS } from './generated/rules-data';
import type { Answer, Fight, Verdict } from './types';

export const RULES_SHEET_URL = 'https://service.mattel.com/instruction_sheets/GDJ85-Eng.pdf';

export const buttonFights: Fight[] = FIGHTS.filter((f) => f.button);

export function fightToAnswer(f: Fight, question: string = f.question): Answer {
  return { question, verdict: f.verdict, line: f.line, rules: f.rules, house: f.house, cards: f.cards, source: 'fight' };
}

const WORDS: Record<Verdict, string> = {
  YES: 'YES',
  NO: 'NO',
  'HOUSE RULE': 'HOUSE\nRULE',
  RULE: 'THE\nRULE',
  'NOT SURE': 'NOT\nSURE',
};

/** The big word on the verdict card. */
export function verdictWord(a: Pick<Answer, 'verdict' | 'label'>): string {
  return a.label ? a.label.replace(' ', '\n') : WORDS[a.verdict];
}
