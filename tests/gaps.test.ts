import { describe, expect, it } from 'vitest';
import { gapOutcome, scrub } from '../server/gaps';
import type { Answer } from '../shared/types';

const a = (over: Partial<Answer>): Answer => ({ question: 'q', verdict: 'NOT SURE', line: 'l', rules: 'r', house: 'h', cards: [], source: 'ai', ...over });

describe('gap finder', () => {
  it('keeps AI NOT SURE, other-version and other-game questions', () => {
    expect(gapOutcome({ status: 'ok', answer: a({}), feedbackKey: null })).toBe('not_sure');
    expect(gapOutcome({ status: 'ok', answer: a({ label: 'CLASSIC ONLY', source: 'scope' }), feedbackKey: null })).toBe('classic_only');
    expect(gapOutcome({ status: 'ok', answer: a({ label: 'UNO ONLY', source: 'ai' }), feedbackKey: null })).toBe('uno_only');
  });

  it('never keeps abuse, unsafe, greetings, real answers or errors', () => {
    for (const label of ['FOUL!', 'NOT HERE', 'HELLO!', 'TIME OUT', 'OOPS']) {
      expect(gapOutcome({ status: 'ok', answer: a({ label, source: 'scope' }), feedbackKey: null }), label).toBeNull();
    }
    expect(gapOutcome({ status: 'ok', answer: a({ verdict: 'YES' }), feedbackKey: 'k' })).toBeNull();
    expect(gapOutcome({ status: 'rate_limited' })).toBeNull();
  });

  it('blanks out emails and phone numbers', () => {
    expect(scrub('call me on +91 98765 43210 or mail a.b@gmail.com about +4 rules')).toBe('call me on [number] or mail [email] about +4 rules');
    expect(scrub('can I play a 7 on a 7')).toBe('can I play a 7 on a 7');
  });
});
