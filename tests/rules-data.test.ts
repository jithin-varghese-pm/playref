import { describe, expect, it } from 'vitest';
import { FIGHTS, RULE_CARDS, RULES_TEXT, RULES_VERSION } from '../shared/generated/rules-data';
import { VERDICTS } from '../shared/types';

describe('rules data', () => {
  it('has numbered rule cards with text', () => {
    expect(RULE_CARDS.length).toBeGreaterThanOrEqual(15);
    for (const c of RULE_CARDS) {
      expect(c.id).toMatch(/^R\d+$/);
      expect(c.official.length).toBeGreaterThan(20);
      expect(c.house.length).toBeGreaterThan(3);
    }
  });

  it('shows exactly 6 fights as home-screen buttons', () => {
    expect(FIGHTS.filter((f) => f.button)).toHaveLength(6);
  });

  it('only cites rule cards that exist and only uses known verdicts', () => {
    const ids = new Set(RULE_CARDS.map((c) => c.id));
    for (const f of FIGHTS) {
      expect(VERDICTS).toContain(f.verdict);
      expect(f.verdict).not.toBe('NOT SURE');
      expect(f.cards.length).toBeGreaterThan(0);
      for (const c of f.cards) expect(ids.has(c)).toBe(true);
      expect(f.match.length).toBeGreaterThan(0);
    }
  });

  it('has unique fight ids', () => {
    expect(new Set(FIGHTS.map((f) => f.id)).size).toBe(FIGHTS.length);
  });

  it('has a short version id and compact rules text', () => {
    expect(RULES_VERSION).toMatch(/^[0-9a-f]{12}$/);
    expect(RULES_TEXT).toContain('R7: Draw Two');
  });

  it('never ships the word "official" next to Playref branding in answers', () => {
    for (const f of FIGHTS) expect(f.line.toLowerCase()).not.toContain('playref official');
  });
});
