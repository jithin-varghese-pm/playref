import { describe, expect, it } from 'vitest';
import {
  cardFor,
  dealRound,
  freshFairness,
  imposterCount,
  pickImposters,
  pickStarter,
  pickWord,
  scoreRound,
  updateFairness,
  MAX_IN_A_ROW,
  type Rng,
} from '../shared/imposter/engine';
import { WORD_PACKS } from '../shared/imposter/words';
import { IMPOSTER_CARDS, IMPOSTER_FIGHTS } from '../shared/generated/imposter-data';
import { VERDICTS } from '../shared/types';

/** Small repeatable random generator for tests. */
function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('Imposter rules data', () => {
  it('has 14 rule cards and 12 fights that cite real cards', () => {
    expect(IMPOSTER_CARDS).toHaveLength(14);
    expect(IMPOSTER_FIGHTS).toHaveLength(12);
    const ids = new Set(IMPOSTER_CARDS.map((c) => c.id));
    for (const f of IMPOSTER_FIGHTS) {
      expect(VERDICTS).toContain(f.verdict);
      for (const c of f.cards) expect(ids.has(c), `${f.id} -> ${c}`).toBe(true);
    }
    expect(IMPOSTER_FIGHTS.filter((f) => f.button)).toHaveLength(6);
  });

  it('never uses protected game names in the rules or fights', () => {
    const text = JSON.stringify([IMPOSTER_CARDS, IMPOSTER_FIGHTS]).toLowerCase();
    for (const name of ['spyfall', 'chameleon', 'mr. white', 'mr white', 'among us', 'crewmate']) expect(text).not.toContain(name);
  });
});

describe('word packs', () => {
  it('has 6 packs of 30 unique words, each with a category', () => {
    expect(WORD_PACKS).toHaveLength(6);
    for (const p of WORD_PACKS) {
      expect(p.category.length).toBeGreaterThan(2);
      expect(new Set(p.words).size, p.id).toBe(p.words.length);
      expect(p.words.length, p.id).toBe(30);
    }
  });
});

describe('Imposter engine', () => {
  it('uses 1 imposter for 3 to 6 players and 2 for 7 to 10 (rule I2)', () => {
    expect([3, 4, 5, 6].map(imposterCount)).toEqual([1, 1, 1, 1]);
    expect([7, 8, 9, 10].map(imposterCount)).toEqual([2, 2, 2, 2]);
  });

  it('never picks anyone more than twice in a row, but does allow twice (rule I5)', () => {
    const rng = seeded(7);
    for (const players of [3, 4, 6, 7, 10]) {
      let f = freshFairness(players);
      const run = Array.from({ length: players }, () => 0);
      let doubles = 0;
      for (let r = 0; r < 400; r++) {
        const imps = pickImposters(players, f, rng);
        expect(imps).toHaveLength(imposterCount(players));
        expect(new Set(imps).size).toBe(imps.length);
        for (let i = 0; i < players; i++) run[i] = imps.includes(i) ? run[i] + 1 : 0;
        expect(Math.max(...run), 'players ' + players + ' round ' + r).toBeLessThanOrEqual(MAX_IN_A_ROW);
        if (imps.some((i) => f.last.includes(i))) doubles++;
        f = updateFairness(players, f, imps);
      }
      // Last round's imposter is NOT ruled out: repeats really happen.
      expect(doubles, 'players ' + players).toBeGreaterThan(10);
    }
  });

  it('gives everyone the same chance over a long night', () => {
    const rng = seeded(42);
    const players = 5;
    const counts = Array.from({ length: players }, () => 0);
    let f = freshFairness(players);
    for (let r = 0; r < 2000; r++) {
      const imps = pickImposters(players, f, rng);
      for (const i of imps) counts[i]++;
      f = updateFairness(players, f, imps);
    }
    // Equal chance would be 400 each. Allow a normal random spread.
    for (const c of counts) expect(c).toBeGreaterThan(330), expect(c).toBeLessThan(470);
  });

  it('a player on a streak of 2 sits out the next round', () => {
    const f = { streak: [0, 2, 0, 0], last: [1] };
    for (let s = 1; s < 50; s++) expect(pickImposters(4, f, seeded(s))).not.toContain(1);
  });

  it('never makes an imposter start the clues (rule I6)', () => {
    const rng = seeded(3);
    for (let r = 0; r < 200; r++) {
      const s = pickStarter(7, [2, 5], rng);
      expect([2, 5]).not.toContain(s);
    }
  });

  it('avoids repeating words until the pack runs out', () => {
    const rng = seeded(9);
    const pack = WORD_PACKS[0];
    const used: string[] = [];
    for (let i = 0; i < pack.words.length; i++) used.push(pickWord(pack, used, rng));
    expect(new Set(used).size).toBe(pack.words.length);
    expect(pack.words).toContain(pickWord(pack, used, rng));
  });

  it('gives the imposter no word and no category (rule I3)', () => {
    const round = dealRound(6, 'kerala-food', freshFairness(6), [], seeded(1));
    expect(round.imposters).toHaveLength(1);
    const imp = round.imposters[0];
    const civilian = [0, 1, 2, 3, 4, 5].find((i) => i !== imp)!;
    const impCard = cardFor(round, imp);
    expect(impCard).toEqual({ title: 'YOU ARE THE', main: 'IMPOSTER', note: 'Blend in and find the word' });
    expect(JSON.stringify(impCard)).not.toContain(round.word);
    expect(JSON.stringify(impCard).toLowerCase()).not.toContain('food');
    expect(cardFor(round, civilian)).toEqual({ title: 'YOUR WORD', main: round.word, note: "Don't say it out loud" });
    // Same shape for both, so the layout gives nothing away.
    expect(Object.keys(impCard)).toEqual(Object.keys(cardFor(round, civilian)));
  });

  it('"Surprise me" picks a real pack each round', () => {
    const rng = seeded(11);
    const ids = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const r = dealRound(4, 'surprise', freshFairness(4), [], rng);
      ids.add(r.packId);
      expect(WORD_PACKS.find((p) => p.id === r.packId)!.words).toContain(r.word);
    }
    expect(ids.size).toBeGreaterThan(3);
  });

  it('rejects player counts outside 3 to 10', () => {
    expect(() => dealRound(2, 'cricket', freshFairness(2), [])).toThrow();
    expect(() => dealRound(11, 'cricket', freshFairness(11), [])).toThrow();
  });

  it('scores rounds as in rule I14', () => {
    const round = dealRound(4, 'cricket', freshFairness(4), [], seeded(5));
    const imp = round.imposters[0];
    const caught = scoreRound(round, { escaped: [], caughtRight: [], imposterWin: false });
    expect(caught[imp]).toBe(0);
    expect(caught.filter((p, i) => i !== imp && p === 1)).toHaveLength(3);
    const escaped = scoreRound(round, { escaped: [imp], caughtRight: [], imposterWin: true });
    expect(escaped[imp]).toBe(2);
    expect(escaped.reduce((a, b) => a + b, 0)).toBe(2);
  });
});
