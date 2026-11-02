export const VERDICTS = ['YES', 'NO', 'HOUSE RULE', 'RULE', 'NOT SURE'] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface RuleCard {
  id: string;
  title: string;
  official: string;
  house: string;
}

export interface Fight {
  id: string;
  button: boolean;
  question: string;
  verdict: Verdict;
  line: string;
  rules: string;
  house: string;
  cards: string[];
  /** Every group must hit at least one phrase for a confident match. */
  match: string[][];
}

/** Where an answer came from. */
export type AnswerSource = 'fight' | 'saved' | 'ai' | 'scope';

export interface Answer {
  question: string;
  verdict: Verdict;
  line: string;
  rules: string;
  house: string;
  cards: string[];
  source: AnswerSource;
  /** Replaces the verdict word on the card, e.g. "CLASSIC ONLY". */
  label?: string;
}

export type AskResponse =
  | { status: 'ok'; answer: Answer; feedbackKey: string | null }
  | { status: 'ai_off' }
  | { status: 'rate_limited' }
  | { status: 'error'; message: string };
