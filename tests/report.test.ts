import { describe, expect, it } from 'vitest';
import { parseReport, REPORTS_PER_HOUR, submitReport } from '../server/report';
import { MemoryStore } from '../server/store';

const good = { type: 'bug', message: 'The +4 answer looked wrong', contact: 'me@example.com', context: '"q" → NO', page: 'verdict', device: 'laptop' };

describe('feedback form (reports)', () => {
  it('accepts a normal report and keeps the context', async () => {
    const store = new MemoryStore();
    expect(await submitReport(good, 'c1', 1000, store)).toEqual({ ok: true });
    expect(store.reports[0]).toMatchObject({ type: 'bug', page: 'verdict', device: 'laptop', contact: 'me@example.com', clientId: 'c1' });
  });

  it('rejects an unknown type and a too-short message with a helpful message', () => {
    expect(parseReport({ ...good, type: 'rant' })).toEqual({ error: 'Pick bug, idea or other.' });
    expect('error' in parseReport({ ...good, message: 'hi' })).toBe(true);
  });

  it('trims long text and ignores unknown pages', () => {
    const r = parseReport({ ...good, message: 'x'.repeat(5000), page: 'admin' });
    expect('error' in r).toBe(false);
    if (!('error' in r)) {
      expect(r.message.length).toBe(2000);
      expect(r.page).toBe('home');
    }
  });

  it('quietly drops bot submissions that fill the hidden field', async () => {
    const store = new MemoryStore();
    expect(await submitReport({ ...good, website: 'http://spam' }, 'bot', 1000, store)).toEqual({ ok: true });
    expect(store.reports).toHaveLength(0);
  });

  it(`limits each person to ${REPORTS_PER_HOUR} messages an hour`, async () => {
    const store = new MemoryStore();
    for (let i = 0; i < REPORTS_PER_HOUR; i++) expect((await submitReport(good, 'c1', 1000 + i, store)).ok).toBe(true);
    expect((await submitReport(good, 'c1', 2000, store)).ok).toBe(false);
    expect((await submitReport(good, 'c2', 2000, store)).ok).toBe(true);
  });
});
