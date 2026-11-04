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
  /** A short friendly line shown above the card, e.g. when the question came with swearing. */
  note?: string;
  /** Which game the answer is about. Missing means UNO. */
  game?: 'imposter';
}

export type AskResponse =
  /** voice: this saved answer already has its Playref-voice recording. */
  | { status: 'ok'; answer: Answer; feedbackKey: string | null; voice?: boolean }
  | { status: 'ai_off' }
  | { status: 'rate_limited' }
  | { status: 'error'; message: string };

/** /api/transcribe: a voice question written down, for the player to check before asking. */
export type TranscribeResponse =
  | { status: 'ok'; text: string }
  | { status: 'empty' }
  | { status: 'rate_limited' }
  | { status: 'ai_off' }
  | { status: 'error'; message: string };
