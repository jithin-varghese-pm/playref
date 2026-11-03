// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../src/App';
import { load, resizeFairness } from '../src/screens/imposter/Imposter';

window.scrollTo = () => {};
const KEY = 'playref.imposter.v1';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
  localStorage.clear();
  sessionStorage.clear();
});

const imposters = (): number[] => JSON.parse(localStorage.getItem(KEY) ?? '{}').fairness?.last ?? [];

function setPlayers(n: number) {
  while (Number(screen.getByText(/^\d+$/, { selector: '.stepper-num' }).textContent) < n) fireEvent.click(screen.getByRole('button', { name: 'More players' }));
}

function deal(players: number) {
  for (let p = 0; p < players; p++) {
    const card = screen.getByRole('button', { name: 'Hold to see your card' });
    fireEvent.pointerDown(card);
    fireEvent.pointerUp(screen.getByRole('button', { name: /YOUR WORD|YOU ARE THE IMPOSTER/ }));
    fireEvent.click(screen.getByRole('button', { name: /Hide/ }));
  }
}

function startGame(players: number) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  window.location.hash = '#/imposter';
  render(<App minThinkMs={0} />);
  setPlayers(players);
  fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
  deal(players);
}

describe('Imposter bug-hunt fixes', () => {
  it('with 2 imposters, the word is never shown before the second imposter guesses (critical #1)', () => {
    startGame(7);
    const [a, b] = imposters();
    fireEvent.click(screen.getByRole('button', { name: 'Time to vote' }));
    fireEvent.click(screen.getByRole('button', { name: `Player ${a + 1}` }));
    expect(screen.queryByText(/The word was/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guessed wrong' }));
    fireEvent.click(screen.getByRole('button', { name: `Player ${b + 1}` }));
    expect(screen.queryByText(/The word was/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guessed wrong' }));
    expect(screen.getByLabelText('Result').textContent).toContain('The word was');
  });

  it('early guess never says out loud who is or is not an imposter (critical #2)', () => {
    startGame(5);
    const imp = imposters()[0];
    const civ = [0, 1, 2, 3, 4].find((i) => i !== imp)!;
    for (const p of [civ, imp]) {
      fireEvent.click(screen.getByRole('button', { name: 'Imposter guessing early' }));
      fireEvent.click(screen.getByRole('button', { name: `Player ${p + 1}` }));
      // The screen before the card is held is the same for both.
      expect(screen.queryByText(/not an imposter/i)).toBeNull();
      expect(screen.getByRole('button', { name: 'Guess now' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(screen.getByRole('button', { name: 'Time to vote' })).toBeTruthy();
    }
    // The real imposter can still guess after checking privately.
    fireEvent.click(screen.getByRole('button', { name: 'Imposter guessing early' }));
    fireEvent.click(screen.getByRole('button', { name: `Player ${imp + 1}` }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Hold to see your card' }));
    fireEvent.pointerUp(screen.getByRole('button', { name: /YOU ARE AN IMPOSTER/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guess now' }));
    expect(screen.getByRole('heading', { name: `Player ${imp + 1} is an imposter` })).toBeTruthy();
  });

  it('the next button is locked while the card is held, and the next card starts closed (high #3)', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    window.location.hash = '#/imposter';
    render(<App minThinkMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Hold to see your card' }));
    const next = screen.getByRole('button', { name: 'Let go of the card first' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.pointerUp(screen.getByRole('button', { name: /YOUR WORD|YOU ARE THE IMPOSTER/ }));
    fireEvent.click(screen.getByRole('button', { name: /Hide and pass/ }));
    expect(screen.getByRole('button', { name: 'Hold to see your card' })).toBeTruthy();
  });

  it('a round survives switching tabs (high #4)', () => {
    startGame(5);
    expect(screen.getByRole('button', { name: 'Time to vote' })).toBeTruthy();
    act(() => {
      window.location.hash = '#/';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    act(() => {
      window.location.hash = '#/imposter';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('button', { name: 'Time to vote' })).toBeTruthy();
  });

  it.each([
    { fairness: {} },
    { players: 5, fairness: { streak: [0, 0, 0, 0, 0], last: 3 } },
    { players: 5, fairness: { streak: [0, 0, 0, 0, 0], last: [] }, used: 7 },
    { players: 5, fairness: { streak: [0, 0, 0, 0, 0], last: [] }, names: [42] },
    { players: 4.5, fairness: { streak: [], last: [] } },
    { players: 5, packId: 'gone-pack', fairness: { streak: [0, 0, 0, 0, 0], last: [] } },
  ])('broken saved data falls back safely (high #5): %j', (bad) => {
    localStorage.setItem(KEY, JSON.stringify(bad));
    const s = load();
    expect(Number.isInteger(s.players)).toBe(true);
    expect(s.fairness.streak).toHaveLength(s.players);
    expect(['surprise', 'kerala-food', 'malayalam-films', 'cricket', 'bengaluru', 'bollywood', 'everyday']).toContain(s.packId);
    startGame(s.players);
    expect(screen.getByRole('button', { name: 'Time to vote' })).toBeTruthy();
  });

  it('phones saved with the old fairness data carry over last round as a streak of 1', () => {
    localStorage.setItem(KEY, JSON.stringify({ players: 5, fairness: { waits: [1, 0, 2, 1, 1], last: [1] } }));
    expect(load().fairness).toEqual({ streak: [0, 1, 0, 0, 0], last: [1] });
  });

  it('changing the player count keeps fairness (medium #6)', () => {
    const f = resizeFairness({ streak: [0, 2, 0, 0, 0], last: [1] }, 6);
    expect(f).toEqual({ streak: [0, 2, 0, 0, 0, 0], last: [1] });
    expect(resizeFairness({ streak: [0, 0, 0, 0, 1], last: [4] }, 4).last).toEqual([]);
  });

  it('duplicate names get their seat number (medium #7)', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    window.location.hash = '#/imposter';
    render(<App minThinkMs={0} />);
    fireEvent.change(screen.getByLabelText('Name for player 1'), { target: { value: 'Gary' } });
    fireEvent.change(screen.getByLabelText('Name for player 2'), { target: { value: 'gary' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    deal(5);
    fireEvent.click(screen.getByRole('button', { name: 'Time to vote' }));
    expect(screen.getByRole('button', { name: 'Gary (1)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'gary (2)' })).toBeTruthy();
  });

  it('every round screen has End round, and the vote has Back to the clues (medium #12)', () => {
    startGame(5);
    fireEvent.click(screen.getByRole('button', { name: 'Time to vote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to the clues' }));
    fireEvent.click(screen.getByRole('button', { name: 'End round' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, end it' }));
    expect(screen.getByRole('button', { name: 'Start game' })).toBeTruthy();
  });

  it('with 2 imposters, a wrong early guess catches that one and the group votes for the other (rule I11)', () => {
    startGame(7);
    const [a, b] = imposters();
    fireEvent.click(screen.getByRole('button', { name: 'Imposter guessing early' }));
    fireEvent.click(screen.getByRole('button', { name: 'Player ' + (a + 1) }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Hold to see your card' }));
    fireEvent.pointerUp(screen.getByRole('button', { name: /YOU ARE AN IMPOSTER/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guess now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guessed wrong' }));
    expect(screen.queryByLabelText('Result')).toBeNull();
    expect(screen.getByRole('heading', { name: 'One more vote' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Player ' + (b + 1) }));
    fireEvent.click(screen.getByRole('button', { name: 'Guessed wrong' }));
    expect(screen.getByLabelText('Result').textContent).toContain('The group wins!');
  });
});
