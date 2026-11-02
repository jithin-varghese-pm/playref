import type { Answer } from '../../shared/types';
import { verdictWord } from '../../shared/rules';

/** The answer a feedback report is about, carried from the verdict screen to the form. */
let current: string | null = null;

export function setReportContext(a: Answer | null): void {
  current = a ? `"${a.question}" → ${verdictWord(a).replace('\n', ' ')} (${a.source}${a.cards.length ? `, ${a.cards.join(', ')}` : ''}): ${a.line}` : null;
}

export function getReportContext(): string | null {
  return current;
}
