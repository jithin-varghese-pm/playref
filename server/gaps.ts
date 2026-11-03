import type { AskResponse } from '../shared/types';

/** Which unanswered questions are worth keeping, and under what name. Abuse, unsafe and greetings are never kept. */
export function gapOutcome(r: AskResponse): 'not_sure' | 'classic_only' | 'uno_only' | null {
  if (r.status !== 'ok' || r.answer.verdict !== 'NOT SURE') return null;
  if (r.answer.label === 'CLASSIC ONLY') return 'classic_only';
  if (r.answer.label === 'UNO ONLY') return 'uno_only';
  if (!r.answer.label && r.answer.source === 'ai') return 'not_sure';
  return null; // FOUL!, NOT HERE, HELLO!, TIME OUT, OOPS
}

/** Blanks out anything that could identify someone: emails, phone numbers and long digit runs. */
export function scrub(question: string): string {
  return question
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number]')
    .slice(0, 300);
}

export interface GapStore {
  addUnanswered(question: string, outcome: string, version: string, at: number): Promise<void>;
}
