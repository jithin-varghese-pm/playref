// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import type { AskResponse } from '../shared/types';

// jsdom does not implement scrolling.
window.scrollTo = () => {};

function mockFetch(response: AskResponse) {
  const fn = vi.fn(async () => ({ ok: true, json: async () => response }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('App', () => {
  it('shows the 6 fight buttons and the disclaimer', () => {
    render(<App minThinkMs={0} />);
    expect(screen.getAllByRole('button', { name: /\?|now what/i }).length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText(/UNO is a trademark of Mattel/)).toBeTruthy();
  });

  it('a fight button shows its checked verdict without calling the server', () => {
    const fetch = mockFetch({ status: 'error', message: 'should not be called' });
    render(<App minThinkMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Can I stack +2 on +2?' }));
    expect(screen.getByLabelText('Verdict').textContent).toContain('HOUSE');
    expect(screen.queryByText('Was this answer right?')).toBeNull();
    expect(screen.queryByText('AI answer from the Classic rules')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a typed question shows the AI verdict with the AI tag and feedback', async () => {
    mockFetch({
      status: 'ok',
      feedbackKey: 'who shuffles',
      answer: { question: 'who shuffles', verdict: 'RULE', line: 'The dealer shuffles.', rules: 'R2 says so.', house: 'None common.', cards: ['R2'], source: 'ai' },
    });
    render(<App minThinkMs={0} />);
    fireEvent.change(screen.getByLabelText('Or type your own'), { target: { value: 'who shuffles' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await waitFor(() => expect(screen.getByLabelText('Verdict').textContent).toContain('THE'));
    expect(screen.getByText('AI answer from the Classic rules')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(screen.getByText('Thanks, noted.')).toBeTruthy());
  });

  it('when the free AI is used up, the type box rests and buttons still work', async () => {
    mockFetch({ status: 'ai_off' });
    render(<App minThinkMs={0} />);
    fireEvent.change(screen.getByLabelText('Or type your own'), { target: { value: 'something new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await waitFor(() => expect(screen.getByText(/Typed questions are back tomorrow/)).toBeTruthy());
    expect((screen.getByLabelText('Or type your own') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Can I finish on a power card?' }));
    expect(screen.getByLabelText('Verdict').textContent).toContain('YES');
  });

  it('shows the rate-limit message', async () => {
    mockFetch({ status: 'rate_limited' });
    render(<App minThinkMs={0} />);
    fireEvent.change(screen.getByLabelText('Or type your own'), { target: { value: 'something new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await waitFor(() => expect(screen.getByText(/asked a lot this hour/)).toBeTruthy());
  });

  it('on a laptop, fights and the verdict show side by side', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('min-width: 900px'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<App minThinkMs={0} />);
    expect(screen.getByText(/The verdict lands here/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Can I stack +2 on +2?' }));
    expect(screen.getByLabelText('Verdict').textContent).toContain('HOUSE');
    // The fights are still on screen, so a second fight replaces the verdict in place.
    fireEvent.click(screen.getByRole('button', { name: 'Can I finish on a power card?' }));
    expect(screen.getByLabelText('Verdict').textContent).toContain('YES');
    expect(screen.queryByRole('button', { name: 'Back to fights' })).toBeNull();
  });

  it('on a phone, a verdict replaces the fights and has a back button', () => {
    render(<App minThinkMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Can I stack +2 on +2?' }));
    expect(screen.queryByRole('button', { name: 'Can I finish on a power card?' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to fights' }));
    expect(screen.getByRole('button', { name: 'Can I finish on a power card?' })).toBeTruthy();
  });

  it('credits Jithin with portfolio, LinkedIn and code links', () => {
    render(<App minThinkMs={0} />);
    expect(screen.getByRole('link', { name: 'LinkedIn' }).getAttribute('href')).toBe('https://www.linkedin.com/in/jithin-varghese-1b1a828a/');
    expect(screen.getByRole('link', { name: 'Portfolio' }).getAttribute('href')).toBe('https://jithin-varghese-pm.github.io/');
    expect(screen.getByRole('link', { name: 'Code' }).getAttribute('href')).toBe('https://github.com/jithin-varghese-pm/playref');
    expect(screen.getByRole('link', { name: 'How Playref was built' }).getAttribute('href')).toBe('#/about');
  });

  it('shows the case study on #/about', async () => {
    mockFetch({ status: 'error', message: 'unused' });
    window.location.hash = '#/about';
    render(<App minThinkMs={0} />);
    expect(screen.getByRole('heading', { name: /referee for the fights/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Connect on LinkedIn' })).toBeTruthy();
  });

  it('Classic-only answers show their own label', async () => {
    mockFetch({
      status: 'ok',
      feedbackKey: null,
      answer: { question: 'uno flip', verdict: 'NOT SURE', label: 'CLASSIC ONLY', line: 'Classic only for now.', rules: 'x', house: 'None common.', cards: [], source: 'scope' },
    });
    render(<App minThinkMs={0} />);
    fireEvent.change(screen.getByLabelText('Or type your own'), { target: { value: 'uno flip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await waitFor(() => expect(screen.getByLabelText('Verdict').textContent).toContain('CLASSIC'));
  });
});
