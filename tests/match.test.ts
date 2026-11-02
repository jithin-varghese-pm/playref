import { describe, expect, it } from 'vitest';
import { matchFight } from '../shared/match';
import { FIGHTS } from '../shared/generated/rules-data';

describe('matchFight', () => {
  it('matches every fight to its own question', () => {
    for (const f of FIGHTS) expect(matchFight(f.question)?.id, f.question).toBe(f.id);
  });

  it.each([
    ['can we stack draw 2s', 'stack-plus2'],
    ['my friend put a plus two on my draw two, is that allowed', 'stack-plus2'],
    ['do i have to keep picking up until i get a card', 'keep-drawing'],
    ['he played a wild draw 4 but still had a red card', 'plus4-with-colour'],
    ['can you win with a skip as your last card', 'finish-power-card'],
    ['she didnt say uno', 'forgot-uno'],
    ['zero swap rule real?', 'seven-zero'],
    ['I think he is bluffing with his +4, can I challenge', 'challenge-plus4'],
    ['what if the deck runs out', 'empty-draw-pile'],
  ])('matches "%s" to %s', (q, id) => {
    expect(matchFight(q)?.id).toBe(id);
  });

  it.each([
    'what is the best pizza',
    'how do I play chess',
    'can I play a red 5 on a blue 5',
    '',
    'Who will win the next election in India',
    'Can I skip class tomorrow',
    'How do I reverse a car',
    'Is black better than white',
    'What is the score in the cricket match',
  ])(
    'returns null for "%s"',
    (q) => {
      expect(matchFight(q)).toBeNull();
    },
  );

  it('returns null on a weak match (only some groups hit)', () => {
    expect(matchFight('tell me about +2')).toBeNull();
  });

  it('prefers the more specific fight', () => {
    expect(matchFight('can I stack a +2 on a +4')?.id).toBe('mixed-stack');
  });
});
