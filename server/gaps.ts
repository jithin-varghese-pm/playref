import type { AskResponse } from '../shared/types';
import { cleanText } from './http';

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
  return cleanText(question.normalize('NFKC'))
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu, '[email]')
    .replace(/\b[\w.+-]+\s+(?:at|\[at\])\s+[\w-]+\s+(?:dot|\[dot\])\s+\w+/giu, '[email]')
    .replace(/\+?\(?\p{Nd}[\p{Nd}\s().-]{6,}\p{Nd}/gu, '[number]')
    .replace(/(^|\s)@[\w.]{2,}/gu, '$1[handle]')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 300);
}

export interface GapStore {
  addUnanswered(question: string, outcome: string, version: string, at: number): Promise<void>;
}
