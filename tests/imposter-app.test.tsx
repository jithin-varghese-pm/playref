// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../src/App';

window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
  localStorage.clear();
});

function imposters(): number[] {
  return JSON.parse(localStorage.getItem('playref.imposter.v1') ?? '{}').fairness?.last ?? [];
}

function dealToEveryone(players: number) {
  for (let p = 0; p < players; p++) {
    const card = screen.getByRole('button', { name: 'Hold to see your card' });
    // The "next" button stays locked until the player has looked.
    expect((screen.getByRole('button', { name: 'Hold the card to see it first' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.pointerDown(card);
    const seen = screen.getByRole('button', { name: /YOUR WORD|YOU ARE THE IMPOSTER/ });
    if (imposters().includes(p)) expect(seen.textContent).toContain('IMPOSTER');
    else expect(seen.textContent).not.toContain('IMPOSTER');
    fireEvent.pointerUp(seen);
    // Released: the card is hidden again before the phone is passed.
    expect(screen.getByRole('button', { name: 'Hold to see your card' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Hide/ }));
  }
}

describe('Imposter game', () => {
  it('plays a full round: deal, clues, vote, caught imposter guesses wrong, group wins', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    window.location.hash = '#/imposter';
    render(<App minThinkMs={0} />);

    // 5 players by default, one imposter.
    expect(screen.getByText('1 hidden imposter for this group.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    dealToEveryone(5);

    // The starter is never the imposter.
    const starter = screen.getByRole('heading', { name: /Player \d+ starts/ }).textContent!;
    const starterIndex = Number(/Player (\d+)/.exec(starter)![1]) - 1;
    expect(imposters()).not.toContain(starterIndex);

    fireEvent.click(screen.getByRole('button', { name: 'Time to vote' }));
    const imp = imposters()[0];
    fireEvent.click(screen.getByRole('button', { name: `Player ${imp + 1}` }));
    expect(screen.getByRole('heading', { name: `Player ${imp + 1} is an imposter` })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Show the word/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guessed wrong' }));
    expect(screen.getByLabelText('Result').textContent).toContain('The group wins!');
  });

  it('voting out a non-imposter makes the imposter win', () => {
    window.location.hash = '#/imposter';
    render(<App minThinkMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fewer players' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fewer players' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    dealToEveryone(3);
    fireEvent.click(screen.getByRole('button', { name: 'Time to vote' }));
    const innocent = [0, 1, 2].find((i) => !imposters().includes(i))!;
    fireEvent.click(screen.getByRole('button', { name: `Player ${innocent + 1}` }));
    expect(screen.getByLabelText('Result').textContent).toContain('Imposter wins!');
  });

  it('shows Imposter fights with Playref standard rules, not Mattel', () => {
    window.location.hash = '#/imposter';
    render(<App minThinkMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: "It's a tie. Now what?" }));
    expect(screen.getByLabelText('Verdict').textContent).toContain('THE');
    expect(screen.getByText(/Playref standard rules/)).toBeTruthy();
    expect(screen.queryByText("Read Mattel's rules sheet")).toBeNull();
    expect(screen.getByText('I9 · Ties')).toBeTruthy();
  });

  it('has a tab to switch between the games', () => {
    render(<App minThinkMs={0} />);
    expect(screen.getByRole('link', { name: /Imposter/ }).getAttribute('href')).toBe('#/imposter');
  });
});
