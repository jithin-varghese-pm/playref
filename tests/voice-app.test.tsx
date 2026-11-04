// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';

window.scrollTo = () => {};

class FakeRecorder {
  static isTypeSupported = (t: string) => t === 'audio/mp4';
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/mp4';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: ((e: Event) => void) | null = null;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(3000)], { type: 'audio/mp4' }) });
    this.onstop?.(new Event('stop'));
  }
}

const trackStop = vi.fn();
function stubMic(getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] }))) {
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  return getUserMedia;
}

function stubFetch(routes: Record<string, unknown>) {
  const fn = vi.fn(async (url: string) => ({ ok: true, json: async () => routes[url] ?? {} }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // @ts-expect-error test cleanup
  delete navigator.mediaDevices;
  window.location.hash = '';
});

describe('voice questions', () => {
  it('no mic button when the browser cannot record', () => {
    render(<App minThinkMs={0} />);
    expect(screen.queryByRole('button', { name: 'Ask by voice' })).toBeNull();
  });

  it('record, stop: the words land in the box for checking, and nothing is asked yet', async () => {
    const gum = stubMic();
    const fetch = stubFetch({ '/api/transcribe': { status: 'ok', text: 'Can I stack a plus two on a plus two?' } });
    render(<App minThinkMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask by voice' }));
    const stop = await screen.findByRole('button', { name: 'Stop recording' });
    expect(gum).toHaveBeenCalled();
    expect(screen.getByText(/Listening/)).toBeTruthy();
    // Ask is locked while recording.
    expect((screen.getByRole('button', { name: /Ask the referee/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(stop);
    await screen.findByText('Check the words, then tap Ask.');
    expect((screen.getByLabelText(/Describe it/) as HTMLTextAreaElement).value).toBe('Can I stack a plus two on a plus two?');
    expect(trackStop).toHaveBeenCalled();

    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    const sent = calls.find(([u]) => u === '/api/transcribe')!;
    expect((sent[1].headers as Record<string, string>)['Content-Type']).toBe('audio/mp4');
    expect(calls.some(([u]) => u === '/api/ask')).toBe(false);
  });

  it('a blocked microphone explains how to fix it', async () => {
    stubMic(vi.fn(async () => { throw new DOMException('no', 'NotAllowedError'); }));
    render(<App minThinkMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask by voice' }));
    await screen.findByText(/microphone is blocked/);
  });

  it('"did not catch that" when the clip had no speech', async () => {
    stubMic();
    stubFetch({ '/api/transcribe': { status: 'empty' } });
    render(<App minThinkMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask by voice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
    await screen.findByText(/Didn't catch that/);
    expect((screen.getByLabelText(/Describe it/) as HTMLTextAreaElement).value).toBe('');
  });

  it('stops by itself after 20 seconds', async () => {
    vi.useFakeTimers();
    try {
      stubMic();
      stubFetch({ '/api/transcribe': { status: 'ok', text: 'Who goes first?' } });
      render(<App minThinkMs={0} />);
      fireEvent.click(screen.getByRole('button', { name: 'Ask by voice' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_500);
      });
      expect((screen.getByLabelText(/Describe it/) as HTMLTextAreaElement).value).toBe('Who goes first?');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('read it out', () => {
  it("uses the phone's own voice, and counts it", async () => {
    const spoken: string[] = [];
    class Utterance {
      lang = '';
      voice: unknown = null;
      rate = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    const synth = {
      getVoices: () => [{ lang: 'en-IN', localService: true, name: 'India' }],
      cancel: vi.fn(),
      speak: vi.fn((u: Utterance) => {
        spoken.push(u.text);
        u.onstart?.();
        setTimeout(() => u.onend?.(), 0);
      }),
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    const fetch = stubFetch({});

    render(<App minThinkMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Can I stack +2 on +2?' }));
    fireEvent.click(screen.getByRole('button', { name: /Read it out/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Read it out/ })).toBeTruthy());
    expect(spoken.join(' ')).toMatch(/^House rule\. .*plus 2/);
    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(calls.some(([u]) => u === '/api/speak')).toBe(false);
    const ev = calls.find(([u, init]) => u === '/api/event' && String(init.body).includes('listen'));
    expect(JSON.parse(String(ev?.[1].body))).toEqual({ event: 'listen', key: 'device' });
    // @ts-expect-error test cleanup
    delete window.speechSynthesis;
  });
});
