import { RULES_VERSION } from '../shared/generated/rules-data';
import type { Answer } from '../shared/types';
import { cleanText } from './http';
import type { Store } from './store';

/** A saved answer with this many "No" votes is removed and goes to review. */
export const NO_LIMIT = 3;

export interface FeedbackInput {
  key: string;
  question: string;
  /** What the browser says it showed. Only used as a fallback label; the saved copy is what gets stored. */
  answer?: Answer;
  correct: boolean;
  clientId: string;
  now: number;
}

/**
 * Keeps every vote for review. Votes only count for answers that really exist in the saved
 * answers (so made-up keys cannot add rows or delete anything), and the server's own copy of the
 * answer is stored, never the one the browser sent. One vote per person per answer; enough "No"
 * votes remove the saved answer.
 */
export async function recordFeedback(input: FeedbackInput, store: Store): Promise<{ counted: boolean }> {
  const saved = await store.getSaved(input.key, RULES_VERSION);
  if (!saved) return { counted: false };
  const counted = await store.addFeedback({
    key: input.key,
    version: RULES_VERSION,
    clientId: input.clientId,
    question: cleanText(input.question).slice(0, 300),
    answer: saved,
    correct: input.correct,
    at: input.now,
  });
  if (counted && !input.correct) {
    const no = await store.addNo(input.key, RULES_VERSION);
    if (no >= NO_LIMIT) await store.deleteSaved(input.key, RULES_VERSION);
  }
  return { counted };
}
