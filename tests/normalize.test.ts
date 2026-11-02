import { describe, expect, it } from 'vitest';
import { normalize } from '../shared/normalize';

describe('normalize', () => {
  it('lower-cases and strips punctuation', () => {
    expect(normalize('Can we STACK?!')).toBe('can we stack');
  });
  it('turns every Draw Two spelling into +2', () => {
    for (const s of ['draw two', 'Draw 2', 'plus two', 'plus 2', '+2', '+ 2', 'draw2', 'draw-two'])
      expect(normalize(`a ${s} b`)).toBe('a +2 b');
  });
  it('turns every Wild Draw Four spelling into +4', () => {
    for (const s of ['wild draw four', 'Wild Draw 4', 'draw four', 'draw 4', 'plus four', '+4', 'wild 4', 'wild four', 'wild +4', 'WD4'])
      expect(normalize(`a ${s} b`)).toBe('a +4 b');
  });
  it('keeps plain wild and uno', () => {
    expect(normalize('Wild card, UNO!')).toBe('wild card uno');
  });
  it('turns apostrophes into spaces so "didn\'t" becomes "didn t"', () => {
    expect(normalize("He didn't say it")).toBe('he didn t say it');
  });
  it('maps colour spellings and plurals of +2', () => {
    expect(normalize('draw 2s')).toBe('+2');
  });
});
