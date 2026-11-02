import { describe, expect, it } from 'vitest';
import { askOutcome, countEvent, isAllowedEvent, istDay } from '../server/usage';
import { MemoryStore } from '../server/store';
import type { Answer } from '../shared/types';

const answer = (over: Partial<Answer>): Answer => ({
  question: 'q', verdict: 'YES', line: 'l', rules: 'r', house: 'h', cards: ['R1'], source: 'ai', ...over,
});

describe('usage counter', () => {
  it('accepts only known events and keys', () => {
    expect(isAllowedEvent('tap', 'stack-plus2')).toBe(true);
    expect(isAllowedEvent('share', 'copied')).toBe(true);
    expect(isAllowedEvent('page', 'about')).toBe(true);
    expect(isAllowedEvent('vote', 'no')).toBe(true);
    expect(isAllowedEvent('tap', 'not-a-fight')).toBe(false);
    expect(isAllowedEvent('tap', 'points')).toBe(false); // hidden fights are not buttons
    expect(isAllowedEvent('ask', 'ai')).toBe(false); // asks are counted by the server only
    expect(isAllowedEvent('hack', 'x')).toBe(false);
    expect(isAllowedEvent(undefined, 'x')).toBe(false);
  });

  it('labels how a typed question was handled', () => {
    expect(askOutcome({ status: 'ok', answer: answer({ source: 'fight' }), feedbackKey: null })).toBe('fight');
    expect(askOutcome({ status: 'ok', answer: answer({ source: 'saved' }), feedbackKey: 'k' })).toBe('saved');
    expect(askOutcome({ status: 'ok', answer: answer({ source: 'ai' }), feedbackKey: 'k' })).toBe('ai');
    expect(askOutcome({ status: 'ok', answer: answer({ verdict: 'NOT SURE', source: 'ai' }), feedbackKey: null })).toBe('not_sure');
    expect(askOutcome({ status: 'ok', answer: answer({ verdict: 'NOT SURE', source: 'scope', label: 'UNO ONLY' }), feedbackKey: null })).toBe('scope');
    expect(askOutcome({ status: 'ai_off' })).toBe('ai_off');
    expect(askOutcome({ status: 'rate_limited' })).toBe('rate_limited');
  });

  it('counts days in India time', () => {
    // 2 Nov 2026 20:00 UTC is already 3 Nov in India.
    expect(istDay(Date.UTC(2026, 10, 2, 20, 0))).toBe('2026-11-03');
    expect(istDay(Date.UTC(2026, 10, 2, 10, 0))).toBe('2026-11-02');
  });

  it('adds up daily totals without storing who did it', async () => {
    const store = new MemoryStore();
    const now = Date.UTC(2026, 10, 2, 10, 0);
    await countEvent(store, 'tap', 'stack-plus2', now);
    await countEvent(store, 'tap', 'stack-plus2', now);
    await countEvent(store, 'tap', 'seven-zero', now);
    expect(store.counts.get('2026-11-02|tap|stack-plus2')).toBe(2);
    expect(store.counts.get('2026-11-02|tap|seven-zero')).toBe(1);
  });
});
