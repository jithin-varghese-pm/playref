// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FIGHTS } from '../shared/generated/rules-data';
import { fightToAnswer } from '../shared/rules';
import { spokenText, voiceKey } from '../shared/spoken';

const stackKey = voiceKey(spokenText(fightToAnswer(FIGHTS.find((f) => f.id === 'stack-plus2')!)));
vi.mock('../shared/voiceClips', () => ({ VOICE_CLIPS: [stackKey] }));

const { App } = await import('../src/App');

window.scrollTo = () => {};
URL.createObjectURL = () => 'blob:clip';
URL.revokeObjectURL = () => {};

const played: string[] = [];
class FakeAudio {
  src = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play() {
    played.push(this.src);
    setTimeout(() => this.onended?.(), 0);
    return Promise.resolve();
  }
  pause() {}
}

function calls(fetch: ReturnType<typeof vi.fn>) {
  return fetch.mock.calls as unknown as [string, RequestInit][];
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  played.length = 0;
});

describe('the Playref voice', () => {
  it('a fixed answer plays its shipped clip, with no server call and no phone voice', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    render(<App minThinkMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Can I stack +2 on +2?' }));
    fireEvent.click(screen.getByRole('button', { name: /Read it out/ }));
    expect(played).toEqual([`/voice/${stackKey}.mp3`]);
    await waitFor(() => expect(calls(fetch).some(([u, i]) => u === '/api/event' && String(i.body).includes('"clip"'))).toBe(true));
    expect(calls(fetch).some(([u]) => u === '/api/voice')).toBe(false);
  });

  it('a saved AI answer with its clip: silent unlock inside the tap, then the Aoede clip', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const answer = { question: 'time limit?', verdict: 'NO', line: 'No time limit.', rules: 'No timer in Classic.', house: 'None common.', cards: ['R4'], source: 'saved' };
    const fetch = vi.fn(async (url: string) => {
      if (url === '/api/ask') return new Response(JSON.stringify({ status: 'ok', answer, feedbackKey: 'time limit', voice: true }));
      if (url === '/api/voice') return new Response(new Uint8Array(8), { headers: { 'Content-Type': 'audio/wav' } });
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetch);
    render(<App minThinkMs={0} />);
    fireEvent.change(screen.getByLabelText(/Describe it/), { target: { value: 'is there a time limit?' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask the referee/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Read it out/ }));
    expect(played[0]).toBe('/voice/silence.mp3');
    await waitFor(() => expect(played).toContain('blob:clip'));
    const sent = calls(fetch).find(([u]) => u === '/api/voice')!;
    expect(JSON.parse(String(sent[1].body))).toEqual({ key: 'time limit' });
  });

  it('a saved AI answer without its clip: the phone voice reads now, and the server is asked to record it', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const spoken: string[] = [];
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        constructor(public text: string) {}
      },
    );
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        cancel: () => {},
        speak: (u: { text: string; onstart?: () => void; onend?: () => void }) => {
          spoken.push(u.text);
          u.onstart?.();
          setTimeout(() => u.onend?.(), 0);
        },
      },
    });
    const answer = { question: 'q', verdict: 'NO', line: 'No time limit.', rules: 'No timer.', house: 'None common.', cards: ['R4'], source: 'ai' };
    const fetch = vi.fn(async (url: string) => {
      if (url === '/api/ask') return new Response(JSON.stringify({ status: 'ok', answer, feedbackKey: 'k1' }));
      if (url === '/api/voice') return new Response('{"status":"preparing"}', { status: 202 });
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetch);
    render(<App minThinkMs={0} />);
    fireEvent.change(screen.getByLabelText(/Describe it/), { target: { value: 'is there a time limit?' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask the referee/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Read it out/ }));
    expect(spoken.join(' ')).toMatch(/^No\. No time limit\./);
    expect(played).toEqual([]);
    expect(calls(fetch).some(([u]) => u === '/api/voice')).toBe(true);
    // @ts-expect-error test cleanup
    delete window.speechSynthesis;
  });
});
