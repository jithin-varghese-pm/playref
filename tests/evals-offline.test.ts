import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { askQuestion } from '../server/ask';
import { MemoryStore } from '../server/store';
// @ts-expect-error plain JS module shared with the Node eval runner
import { scoreOne } from '../evals/score.mjs';

interface Item {
  group: string;
  q: string;
  verdicts: string[];
  cards?: string[];
  label?: string;
}

const { questions } = JSON.parse(readFileSync(new URL('../evals/questions.json', import.meta.url), 'utf8')) as { questions: Item[] };
const noAi = { run: async () => { throw new Error('offline: no AI'); } };

describe('eval set', () => {
  it('has 50 questions', () => {
    expect(questions).toHaveLength(50);
  });

  it('every question answered without AI (known fight or scope) is right', async () => {
    let offline = 0;
    for (const item of questions) {
      const r = await askQuestion({ question: item.q, clientId: 'eval', now: 0, evalMode: true }, { ai: noAi, store: new MemoryStore(), model: 'none' });
      if (r.status !== 'ok') continue; // needs the AI; scored by evals/run.mjs against the live site
      offline++;
      expect(scoreOne(item, r.answer), item.q).toBeNull();
    }
    // Most questions should never need the AI. If this drops, the matcher got weaker.
    expect(offline).toBeGreaterThanOrEqual(35);
  });
});
