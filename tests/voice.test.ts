import { describe, expect, it, vi } from 'vitest';
import { readAudioBody } from '../server/http';
import { MemoryStore } from '../server/store';
import { isAllowedEvent } from '../server/usage';
import {
  audioType,
  cleanTranscript,
  MAX_AUDIO_BYTES,
  speak,
  STT_MODEL,
  toBase64,
  transcribe,
  TTS_MODEL,
  VOICE_PER_HOUR,
} from '../server/voice';
import { forCloud, spokenText } from '../src/lib/speak';

const clip = (n = 4000) => new Uint8Array(n).fill(7);
const deps = (reply: unknown) => ({ ai: { run: vi.fn(async () => reply) }, store: new MemoryStore() });

describe('transcribe', () => {
  it('sends the clip to Whisper in English with a card-name hint and returns the words', async () => {
    const d = deps({ text: '  Can I stack a plus two on a plus two?  ' });
    const r = await transcribe({ audio: clip(), clientId: 'a', now: 1 }, d);
    expect(r).toEqual({ status: 'ok', text: 'Can I stack a plus two on a plus two?' });
    const [model, input] = d.ai.run.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(model).toBe(STT_MODEL);
    expect(input).toMatchObject({ task: 'transcribe', language: 'en', vad_filter: true });
    expect(input.audio).toBe(toBase64(clip()));
    expect(String(input.initial_prompt)).toMatch(/UNO/);
  });

  it('a tiny clip is "did not catch that" and uses no AI', async () => {
    const d = deps({ text: 'x' });
    expect(await transcribe({ audio: clip(100), clientId: 'a', now: 1 }, d)).toEqual({ status: 'empty' });
    expect(d.ai.run).not.toHaveBeenCalled();
  });

  it('silence and Whisper filler ("Thank you for watching.") count as empty', async () => {
    for (const text of ['', '   ', 'Thank you for watching.', 'you', 'Bye!']) {
      expect(await transcribe({ audio: clip(), clientId: 'a', now: 1 }, deps({ text }))).toEqual({ status: 'empty' });
    }
  });

  it('never returns the hint itself as the question', async () => {
    const hint = 'A question about the UNO card game: plus two, plus four, Wild, Wild Draw Four, Skip, Reverse, draw pile, colour.';
    expect(await transcribe({ audio: clip(), clientId: 'a', now: 1 }, deps({ text: hint }))).toEqual({ status: 'empty' });
  });

  it('cleans what comes back: no control characters, one line, at most 300 characters', () => {
    expect(cleanTranscript('Can I\u0000 play\n\na +4?')).toBe('Can I play a +4?');
    expect(cleanTranscript('a'.repeat(500))).toHaveLength(300);
    expect(cleanTranscript(42)).toBe('');
  });

  it('has its own hourly limit', async () => {
    const d = deps({ text: 'Who goes first?' });
    for (let i = 0; i < VOICE_PER_HOUR; i++) expect((await transcribe({ audio: clip(), clientId: 'a', now: 1 }, d)).status).toBe('ok');
    expect(await transcribe({ audio: clip(), clientId: 'a', now: 1 }, d)).toEqual({ status: 'rate_limited' });
    expect((await transcribe({ audio: clip(), clientId: 'b', now: 1 }, d)).status).toBe('ok');
  });

  it('reports the daily AI cap as ai_off, other failures as a friendly error', async () => {
    const cap = { ai: { run: async () => { throw new Error('3036: daily free allocation'); } }, store: new MemoryStore() };
    expect(await transcribe({ audio: clip(), clientId: 'a', now: 1 }, cap)).toEqual({ status: 'ai_off' });
    const boom = { ai: { run: async () => { throw new Error('boom'); } }, store: new MemoryStore() };
    expect((await transcribe({ audio: clip(), clientId: 'a', now: 1 }, boom)).status).toBe('error');
  });

  it('spends no AI when the limit cannot be checked', async () => {
    const d = deps({ text: 'hi' });
    d.store.claim = async () => { throw new Error('db down'); };
    expect(await transcribe({ audio: clip(), clientId: 'a', now: 1 }, d)).toEqual({ status: 'rate_limited' });
    expect(d.ai.run).not.toHaveBeenCalled();
  });

  it('base64 matches Node for large clips', () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 251);
    expect(toBase64(big)).toBe(Buffer.from(big).toString('base64'));
  });
});

describe('readAudioBody', () => {
  const req = (body: BodyInit, headers: Record<string, string>) => new Request('https://playref.pages.dev/api/transcribe', { method: 'POST', body, headers });

  it('takes audio from Playref pages', async () => {
    const r = await readAudioBody(req(clip(), { 'Content-Type': 'audio/webm', Origin: 'https://playref.pages.dev' }), MAX_AUDIO_BYTES);
    expect(r.ok && r.audio.byteLength).toBe(4000);
  });

  it('refuses other websites, non-audio types and big clips', async () => {
    expect((await readAudioBody(req(clip(), { 'Content-Type': 'audio/webm', Origin: 'https://evil.example' }), MAX_AUDIO_BYTES)) as unknown).toMatchObject({ ok: false, status: 403 });
    expect((await readAudioBody(req('{}', { 'Content-Type': 'application/json' }), MAX_AUDIO_BYTES)) as unknown).toMatchObject({ ok: false, status: 415 });
    expect((await readAudioBody(req(clip(5000), { 'Content-Type': 'audio/mp4' }), 1000)) as unknown).toMatchObject({ ok: false, status: 413 });
  });
});

describe('speak (cloud read-aloud fallback)', () => {
  const wav = btoa('RIFF' + 'x'.repeat(40));

  it('reads answer text with MeloTTS and labels the audio by its bytes', async () => {
    const d = deps({ audio: wav });
    const r = await speak({ text: 'House rule. Official rules say no.', clientId: 'a', now: 1 }, d);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.type).toBe('audio/wav');
    expect(d.ai.run).toHaveBeenCalledWith(TTS_MODEL, { prompt: 'House rule. Official rules say no.', lang: 'en' });
  });

  it('refuses links, contact details, abuse, empty and over-long text without using AI', async () => {
    for (const text of ['visit evil.com now', 'call 98765 43210', 'you are an idiot', '', 'a'.repeat(601), 42]) {
      const d = deps({ audio: wav });
      expect((await speak({ text, clientId: 'a', now: 1 }, d)).status).toBe('refused');
      expect(d.ai.run).not.toHaveBeenCalled();
    }
  });

  it('knows WAV, Ogg and MP3', () => {
    expect(audioType(new TextEncoder().encode('RIFF....'))).toBe('audio/wav');
    expect(audioType(new TextEncoder().encode('OggS....'))).toBe('audio/ogg');
    expect(audioType(new Uint8Array([0xff, 0xfb, 0, 0]))).toBe('audio/mpeg');
  });
});

describe('what gets read out', () => {
  it('says the verdict, the line and the rules, with card names spoken', () => {
    expect(spokenText({ verdict: 'HOUSE RULE', line: 'Official rules say no', rules: 'A +2 makes the next player draw 2.' })).toBe(
      'House rule. Official rules say no. A plus 2 makes the next player draw 2.',
    );
    expect(spokenText({ verdict: 'NOT SURE', label: 'CLASSIC ONLY', line: 'Classic only.', rules: 'Check the box.' })).toBe('Classic only. Classic only. Check the box.');
  });

  it('cuts cloud text at a sentence end', () => {
    const t = 'One two three. ' + 'Four five six. '.repeat(60);
    const c = forCloud(t);
    expect(c.length).toBeLessThanOrEqual(600);
    expect(c.endsWith('.')).toBe(true);
  });

  it('read-aloud taps are counted, junk is not', () => {
    expect(isAllowedEvent('listen', 'device')).toBe(true);
    expect(isAllowedEvent('listen', 'cloud')).toBe(true);
    expect(isAllowedEvent('listen', 'anything')).toBe(false);
  });
});

describe('Whisper text goes down the normal path', () => {
  it('"plus two" as Whisper writes it still hits the known +2 fight, with no AI', async () => {
    const { askQuestion } = await import('../server/ask');
    const ai = { run: vi.fn() };
    const r = await askQuestion({ question: 'Can I stack a plus two on a plus two card?', clientId: 'a', now: 1, evalMode: false }, { ai, store: new MemoryStore(), model: 'm' });
    expect(r.status === 'ok' && r.answer.source).toBe('fight');
    expect(ai.run).not.toHaveBeenCalled();
  });
});
