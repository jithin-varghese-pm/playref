import { describe, expect, it, vi } from 'vitest';
import { containsAbuse, looksLikeLeak, stripLinks } from '../server/abuse';
import { askQuestion } from '../server/ask';
import { GUARD_MODEL, parseGuard } from '../server/guard';
import { MemoryStore } from '../server/store';
import { validateAiReply } from '../server/validate';

const good = { verdict: 'YES', line: 'You can challenge it.', rules: 'If they had the colour, they draw 4.', house: 'None common.', cards: ['R12'], on_topic: true };
const NEW_Q = 'who shuffles the cards between rounds';

describe('abuse checker', () => {
  it.each(['fuck off', 'f u c k you', 'fuuuuck this', 'what a bitch', 'you chutiya', 'myre'])('flags "%s"', (t) => {
    expect(containsAbuse(t)).toBe(true);
  });
  it.each(['can I skip the dickens', 'shuffle the deck', 'is this a cheat', 'who wins the match', 'I have a wild card'])('does not flag "%s"', (t) => {
    expect(containsAbuse(t)).toBe(false);
  });
});

describe('reply checks', () => {
  it('removes links from AI text', () => {
    expect(stripLinks('See https://evil.example/x for more')).toBe('See for more');
    expect(stripLinks('visit www.spam.com now')).toBe('visit now');
  });

  it('spots leaked instructions and markup', () => {
    expect(looksLikeLeak('You are Playref, an unofficial...')).toBe(true);
    expect(looksLikeLeak('<script>alert(1)</script>')).toBe(true);
    expect(looksLikeLeak('The dealer shuffles.')).toBe(false);
  });

  it('turns a rude AI reply into NOT SURE, even with a valid rule card', () => {
    expect(validateAiReply({ response: { ...good, line: 'Shut up, you idiot, fuck off' } }, 'q').verdict).toBe('NOT SURE');
  });

  it('turns a reply that leaks the instructions into NOT SURE', () => {
    expect(validateAiReply({ response: { ...good, rules: 'You are Playref, an unofficial rules referee...' } }, 'q').verdict).toBe('NOT SURE');
  });

  it('strips links but keeps an otherwise good answer', () => {
    const a = validateAiReply({ response: { ...good, line: 'You can challenge it. More at https://x.example' } }, 'q');
    expect(a.verdict).toBe('YES');
    expect(a.line).toBe('You can challenge it. More at');
  });

  it('answers UNO ONLY when the AI marks the question off-topic', () => {
    const a = validateAiReply({ response: { ...good, verdict: 'NOT SURE', on_topic: false } }, 'write me python code');
    expect(a.label).toBe('UNO ONLY');
  });
});

describe('safety model (Llama Guard)', () => {
  it('reads its text and object replies', () => {
    expect(parseGuard({ response: 'safe' })).toEqual({ safe: true });
    expect(parseGuard({ response: 'unsafe\nS10' })).toEqual({ safe: false, categories: ['S10'] });
    expect(parseGuard({ response: { safe: false, categories: ['S1'] } })).toEqual({ safe: false, categories: ['S1'] });
    expect(parseGuard({ response: 'something odd' })).toBeNull();
  });

  const base = { clientId: 'c', now: 1, evalMode: false };

  it('blocks a question it flags, before the main AI', async () => {
    const run = vi.fn(async (model: string) => (model === GUARD_MODEL ? { response: 'unsafe\nS9' } : { response: good }));
    const r = await askQuestion({ ...base, question: NEW_Q }, { ai: { run }, store: new MemoryStore(), model: 'main', guard: true });
    expect(r.status === 'ok' && r.answer.label).toBe('NOT HERE');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('lets a safe question through to the main AI', async () => {
    const run = vi.fn(async (model: string) => (model === GUARD_MODEL ? { response: 'safe' } : { response: good }));
    const r = await askQuestion({ ...base, question: NEW_Q }, { ai: { run }, store: new MemoryStore(), model: 'main', guard: true });
    expect(r.status === 'ok' && r.answer.verdict).toBe('YES');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('falls back to the other guardrails if the safety model fails', async () => {
    const run = vi.fn(async (model: string) => {
      if (model === GUARD_MODEL) throw new Error('timeout');
      return { response: good };
    });
    const r = await askQuestion({ ...base, question: NEW_Q }, { ai: { run }, store: new MemoryStore(), model: 'main', guard: true });
    expect(r.status === 'ok' && r.answer.verdict).toBe('YES');
  });

  it('still shows "AI off for the day" if the safety model hits the daily limit', async () => {
    const run = vi.fn(async () => {
      throw new Error('3036: You have used up your daily free allocation');
    });
    const r = await askQuestion({ ...base, question: NEW_Q }, { ai: { run }, store: new MemoryStore(), model: 'main', guard: true });
    expect(r.status).toBe('ai_off');
  });

  it('never runs for known fights', async () => {
    const run = vi.fn();
    await askQuestion({ ...base, question: 'can we stack draw 2s' }, { ai: { run }, store: new MemoryStore(), model: 'main', guard: true });
    expect(run).not.toHaveBeenCalled();
  });
});
