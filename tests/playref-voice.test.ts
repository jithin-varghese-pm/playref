import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { askQuestion, SCOPE_ANSWERS } from '../server/ask';
import { MemoryStore } from '../server/store';
import { GEMINI_RUNTIME_PER_DAY, GeminiError, geminiSpeech, toWav, voiceForSaved } from '../server/voice';
import { RULES_VERSION } from '../shared/generated/rules-data';
import { spokenText, VOICE_NAME, voiceKey } from '../shared/spoken';
import { VOICE_CLIPS } from '../shared/voiceClips';
import type { Answer } from '../shared/types';

const saved: Answer = {
  question: 'is there a time limit',
  verdict: 'NO',
  line: 'There is no time limit for a turn.',
  rules: 'The Classic rules set no timer.',
  house: 'None common.',
  cards: ['R4'],
  source: 'ai',
};
const pcm = new Uint8Array(480).fill(1);
const geminiOk = (data = pcm) =>
  vi.fn(
    async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.from(data).toString('base64') } }] } }] }),
        { status: 200 },
      ),
  );
const asFetch = (f: unknown) => f as typeof fetch;

describe('voice keys', () => {
  it('are stable, short, and change with the words', () => {
    expect(voiceKey('House rule.')).toBe(voiceKey('House rule.'));
    expect(voiceKey('House rule.')).toMatch(/^[0-9a-f]{16}$/);
    expect(voiceKey('House rule.')).not.toBe(voiceKey('House rule!'));
  });

  it('every listed fixed clip has its file', () => {
    for (const k of VOICE_CLIPS) expect(existsSync(`public/voice/${k}.mp3`)).toBe(true);
  });

  it('blocked-question cards have text to read', () => {
    for (const a of Object.values(SCOPE_ANSWERS)) expect(spokenText(a).length).toBeGreaterThan(10);
  });
});

describe('toWav / geminiSpeech', () => {
  it('wraps raw PCM in a 24 kHz WAV header and keeps a WAV as it is', () => {
    const w = toWav(pcm, 'audio/L16;codec=pcm;rate=24000');
    expect(String.fromCharCode(...w.subarray(0, 4))).toBe('RIFF');
    expect(new DataView(w.buffer).getUint32(24, true)).toBe(24000);
    expect(w.byteLength).toBe(44 + pcm.byteLength);
    expect(toWav(w, 'audio/wav')).toBe(w);
  });

  it('asks for the Aoede voice with the style line in front of the words', async () => {
    const f = geminiOk();
    await geminiSpeech('Yes. You can.', 'k', { style: 'STYLE: ', voice: VOICE_NAME }, asFetch(f));
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    // Style goes in a notes block above the words, never in front of them (it would be read out).
    expect(body.contents[0].parts[0].text).toBe("### DIRECTOR'S NOTES\nSTYLE: \n\n### TRANSCRIPT\nYes. You can.");
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Aoede');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
  });

  it('turns a quota error into GeminiError 429', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }));
    await expect(geminiSpeech('x', 'k', { style: '', voice: 'Aoede' }, asFetch(f))).rejects.toMatchObject({ status: 429 });
    expect(new GeminiError(429, 'q')).toBeInstanceOf(Error);
  });
});

describe('voiceForSaved', () => {
  async function setup() {
    const store = new MemoryStore();
    await store.saveAnswer('time limit', RULES_VERSION, saved, 1);
    return store;
  }

  it('only voices answers Playref really saved', async () => {
    const store = await setup();
    expect((await voiceForSaved({ key: 'made up', clientId: 'a', now: 1, apiKey: 'k' }, { store })).status).toBe('unknown');
    expect((await voiceForSaved({ key: 42, clientId: 'a', now: 1, apiKey: 'k' }, { store })).status).toBe('unknown');
  });

  it('first ask: preparing, then records once in the background; next ask: the clip', async () => {
    const store = await setup();
    const f = geminiOk();
    const first = await voiceForSaved({ key: 'time limit', clientId: 'a', now: 1, apiKey: 'k' }, { store, fetch: asFetch(f) });
    expect(first.status).toBe('preparing');
    if (first.status === 'preparing') await first.make?.();
    expect(f).toHaveBeenCalledTimes(1);
    const again = await voiceForSaved({ key: 'time limit', clientId: 'b', now: 2, apiKey: 'k' }, { store, fetch: asFetch(f) });
    expect(again.status).toBe('ok');
    expect(await store.hasVoice(voiceKey(spokenText(saved)))).toBe(true);
  });

  it('two players at once never pay for the same clip twice', async () => {
    const store = await setup();
    const f = geminiOk();
    const deps = { store, fetch: asFetch(f) };
    const [a, b] = await Promise.all([
      voiceForSaved({ key: 'time limit', clientId: 'a', now: 1, apiKey: 'k' }, deps),
      voiceForSaved({ key: 'time limit', clientId: 'b', now: 1, apiKey: 'k' }, deps),
    ]);
    await Promise.all([a, b].map((r) => (r.status === 'preparing' ? r.make?.() : null)));
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('stops at the daily budget', async () => {
    const store = new MemoryStore();
    const f = geminiOk();
    for (let i = 0; i < GEMINI_RUNTIME_PER_DAY + 2; i++) {
      await store.saveAnswer(`q${i}`, RULES_VERSION, { ...saved, line: `Line number ${i}.` }, 1);
      const r = await voiceForSaved({ key: `q${i}`, clientId: `c${i}`, now: 10, apiKey: 'k' }, { store, fetch: asFetch(f) });
      if (r.status === 'preparing') await r.make?.();
    }
    expect(f).toHaveBeenCalledTimes(GEMINI_RUNTIME_PER_DAY);
  });

  it('a quota error frees the clip and stops further tries for the day', async () => {
    const store = await setup();
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }));
    const r = await voiceForSaved({ key: 'time limit', clientId: 'a', now: 1, apiKey: 'k' }, { store, fetch: asFetch(f) });
    if (r.status === 'preparing') await r.make?.();
    expect(await store.getVoice(voiceKey(spokenText(saved)))).toBeNull();
    expect(await store.countHits('gemini-tts', 0)).toBeGreaterThanOrEqual(GEMINI_RUNTIME_PER_DAY);
  });

  it('without a key it never calls Gemini', async () => {
    const store = await setup();
    expect(await voiceForSaved({ key: 'time limit', clientId: 'a', now: 1 }, { store })).toEqual({ status: 'preparing' });
  });
});

describe('the ask path tells the app when a saved answer has its voice', () => {
  it('voice: true once the clip exists', async () => {
    const store = new MemoryStore();
    const ai = { run: vi.fn() };
    const q = 'is there a time limit for each turn';
    await store.saveAnswer(q, RULES_VERSION, saved, 1);
    const before = await askQuestion({ question: q, clientId: 'a', now: 1, evalMode: false }, { ai, store, model: 'm' });
    expect(before.status === 'ok' && before.voice).toBe(false);
    await store.saveVoice(voiceKey(spokenText(saved)), new Uint8Array(10), 1);
    const after = await askQuestion({ question: q, clientId: 'a', now: 1, evalMode: false }, { ai, store, model: 'm' });
    expect(after.status === 'ok' && after.voice).toBe(true);
  });
});
