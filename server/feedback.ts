import { RULES_VERSION } from '../shared/generated/rules-data';
import type { Answer } from '../shared/types';
import type { Store } from './store';

/** A saved answer with this many "No" votes is removed and goes to review. */
export const NO_LIMIT = 3;

export interface FeedbackInput {
  key: string;
  question: string;
  answer: Answer;
  correct: boolean;
  clientId: string;
  now: number;
}

/** Keeps every vote for review. One vote per person per answer; enough "No" votes remove the saved answer. */
export async function recordFeedback(input: FeedbackInput, store: Store): Promise<{ counted: boolean }> {
  const counted = await store.addFeedback({
    key: input.key,
    version: RULES_VERSION,
    clientId: input.clientId,
    question: input.question.slice(0, 300),
    answer: input.answer,
    correct: input.correct,
    at: input.now,
  });
  if (counted && !input.correct) {
    const no = await store.addNo(input.key, RULES_VERSION);
    if (no >= NO_LIMIT) await store.deleteSaved(input.key, RULES_VERSION);
  }
  return { counted };
}
