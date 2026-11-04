/**
 * Voice questions and read-aloud.
 * - Speech to text: the browser records the question, Whisper on Workers AI writes it down, and the
 *   text goes back to the player to check. Only that text is ever asked, through the normal path.
 * - Text to speech: browsers read answers out with their own voice. MeloTTS is the fallback for the
 *   few browsers without one. It only reads Playref-style answer text, never links or abuse.
 * No audio is ever stored.
 */
import type { AiRunner } from './ask';
import { answerIsRude, hasContactOrDomain } from './abuse';
import { cleanText } from './http';
import type { Store } from './store';
import type { TranscribeResponse } from '../shared/types';
import { RULES_VERSION } from '../shared/generated/rules-data';
import { spokenText, VOICE_NAME, VOICE_STYLE, voiceKey, voicePrompt } from '../shared/spoken';

export type { TranscribeResponse };

export const STT_MODEL = '@cf/openai/whisper-large-v3-turbo';
export const TTS_MODEL = '@cf/myshell-ai/melotts';

/** About 30 seconds of compressed speech from any browser; the app stops recording at 20. */
export const MAX_AUDIO_BYTES = 1_000_000;
/** Anything smaller is a tap with no speech in it. */
export const MIN_AUDIO_BYTES = 800;
export const VOICE_PER_HOUR = 20;
export const SPEAK_PER_HOUR = 20;
export const MAX_SPEAK_CHARS = 600;
const HOUR = 3_600_000;

/** Helps Whisper spell card names the way players say them. */
const HINT = 'A question about the UNO card game: plus two, plus four, Wild, Wild Draw Four, Skip, Reverse, draw pile, colour.';

/** What Whisper sometimes writes for a clip with no real speech. Treated as "did not catch that". */
const NOISE = new Set(['', 'you', 'thank you', 'thanks', 'thank you for watching', 'thanks for watching', 'bye', 'okay', 'ok', 'hmm', 'uh', 'um']);


function isDailyLimit(e: unknown): boolean {
  return /3036|daily free allocation/i.test(String(e instanceof Error ? e.message : e));
}

/** Base64 without Node's Buffer (Workers do not have it unless nodejs_compat is on). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Cleans what Whisper wrote: no control characters, one line, at most 300 characters. */
export function cleanTranscript(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return cleanText(raw).replace(/\s+/g, ' ').trim().slice(0, 300);
}

function isNoise(text: string): boolean {
  const t = text.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, '').replace(/\s+/g, ' ').trim();
  return NOISE.has(t) || t === HINT.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, '').replace(/\s+/g, ' ').trim();
}

export async function transcribe(input: { audio: Uint8Array; clientId: string; now: number }, deps: { ai: AiRunner; store: Store }): Promise<TranscribeResponse> {
  if (input.audio.byteLength < MIN_AUDIO_BYTES) return { status: 'empty' };
  if (input.audio.byteLength > MAX_AUDIO_BYTES) return { status: 'error', message: 'That was too long. Keep it under 20 seconds.' };

  let allowed = true;
  try {
    allowed = await deps.store.claim(`voice:${input.clientId}`, VOICE_PER_HOUR, HOUR, input.now);
  } catch {
    allowed = false; // If the limit cannot be checked, do not spend AI.
  }
  if (!allowed) return { status: 'rate_limited' };

  try {
    const raw = (await deps.ai.run(STT_MODEL, {
      audio: toBase64(input.audio),
      task: 'transcribe',
      language: 'en',
      vad_filter: true,
      initial_prompt: HINT,
    })) as { text?: unknown } | null;
    const text = cleanTranscript(raw?.text);
    return isNoise(text) ? { status: 'empty' } : { status: 'ok', text };
  } catch (e) {
    if (isDailyLimit(e)) return { status: 'ai_off' };
    return { status: 'error', message: "Couldn't hear that. Try again, or type it." };
  }
}

export type SpeakResult = { status: 'ok'; audio: Uint8Array; type: string } | { status: 'refused' | 'rate_limited' | 'ai_off' | 'error' };

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** MeloTTS answers with WAV today (the docs say MP3), so the type is read from the bytes. */
export function audioType(bytes: Uint8Array): string {
  const head = String.fromCharCode(...bytes.subarray(0, 4));
  if (head === 'RIFF') return 'audio/wav';
  if (head === 'OggS') return 'audio/ogg';
  return 'audio/mpeg';
}

/** Read-aloud fallback. Only short, clean answer text: no links, contact details or abuse. */
export async function speak(input: { text: unknown; clientId: string; now: number }, deps: { ai: AiRunner; store: Store }): Promise<SpeakResult> {
  const text = typeof input.text === 'string' ? cleanText(input.text).replace(/\s+/g, ' ').trim() : '';
  if (!text || text.length > MAX_SPEAK_CHARS || answerIsRude(text) || hasContactOrDomain(text)) return { status: 'refused' };

  let allowed = true;
  try {
    allowed = await deps.store.claim(`speak:${input.clientId}`, SPEAK_PER_HOUR, HOUR, input.now);
  } catch {
    allowed = false;
  }
  if (!allowed) return { status: 'rate_limited' };

  try {
    const raw = (await deps.ai.run(TTS_MODEL, { prompt: text, lang: 'en' })) as { audio?: unknown } | null;
    if (typeof raw?.audio !== 'string' || !raw.audio) return { status: 'error' };
    const audio = fromBase64(raw.audio);
    return { status: 'ok', audio, type: audioType(audio) };
  } catch (e) {
    return { status: isDailyLimit(e) ? 'ai_off' : 'error' };
  }
}

/* ---------- The Playref voice (Gemini, Aoede) for saved AI answers ---------- */

export const GEMINI_TTS_MODEL = 'gemini-3.8-flash-tts';
/** Google's free tier allows 10 a day for this model; the rest are kept for making the fixed clips (npm run voice). */
export const GEMINI_RUNTIME_PER_DAY = 3;
/** Per person per hour: how many new answers one person can have voiced. */
export const VOICE_MAKE_PER_HOUR = 10;
const DAY = 86_400_000;
/** D1 keeps rows up to 2 MB; longer clips are not saved (the phone voice reads them instead). */
const MAX_CLIP_BYTES = 1_900_000;

export class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function wavHeader(dataBytes: number, rate: number): Uint8Array {
  const b = new ArrayBuffer(44);
  const v = new DataView(b);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  return new Uint8Array(b);
}

/** Gemini sends 16-bit mono PCM (sometimes already wrapped as WAV). Always returns a playable WAV. */
export function toWav(bytes: Uint8Array, mimeType: string): Uint8Array {
  if (String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF') return bytes;
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
  const out = new Uint8Array(44 + bytes.byteLength);
  out.set(wavHeader(bytes.byteLength, rate), 0);
  out.set(bytes, 44);
  return out;
}

/** Asks Gemini to read the text in the Playref voice. Throws GeminiError on any failure. */
export async function geminiSpeech(text: string, apiKey: string, styleAndVoice: { style: string; voice: string }, fetchFn: typeof fetch = fetch): Promise<Uint8Array> {
  const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: voicePrompt(text, styleAndVoice.style) }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: styleAndVoice.voice } } } },
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  } | null;
  if (!res.ok) throw new GeminiError(res.status, body?.error?.message ?? `HTTP ${res.status}`);
  const part = body?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!part?.data) throw new GeminiError(502, 'No audio in the reply');
  return toWav(fromBase64(part.data), part.mimeType ?? '');
}

export type VoiceResult =
  | { status: 'ok'; audio: Uint8Array }
  /** Not recorded yet. `make` (when present) records it in the background for next time. */
  | { status: 'preparing'; make?: () => Promise<void> }
  | { status: 'unknown' };

/**
 * The Playref voice for a saved AI answer, found by its saved-answer key. Only answers Playref
 * really gave can be voiced, so nobody can make the Playref voice say anything else.
 */
export async function voiceForSaved(
  input: { key: unknown; clientId: string; now: number; apiKey?: string },
  deps: { store: Store; fetch?: typeof fetch },
): Promise<VoiceResult> {
  if (typeof input.key !== 'string' || !input.key || input.key.length > 300) return { status: 'unknown' };
  const saved = await deps.store.getSaved(input.key, RULES_VERSION);
  if (!saved) return { status: 'unknown' };
  const text = spokenText(saved);
  const vkey = voiceKey(text);
  const clip = await deps.store.getVoice(vkey);
  if (clip instanceof Uint8Array) return { status: 'ok', audio: clip };
  if (clip === 'pending' || !input.apiKey) return { status: 'preparing' };
  const apiKey = input.apiKey;

  const make = async () => {
    const { store, now } = { store: deps.store, now: input.now };
    // Shared daily budget (checked before counting, so refused tries never use it up), then a per-person limit.
    if ((await store.countHits('gemini-tts', now - DAY)) >= GEMINI_RUNTIME_PER_DAY) return;
    if (!(await store.claim(`voicemake:${input.clientId}`, VOICE_MAKE_PER_HOUR, HOUR, now))) return;
    if (!(await store.startVoice(vkey, now))) return;
    await store.addHit('gemini-tts', now);
    try {
      const audio = await geminiSpeech(text, apiKey, { style: VOICE_STYLE, voice: VOICE_NAME }, deps.fetch);
      if (audio.byteLength > MAX_CLIP_BYTES) return void (await store.dropVoice(vkey));
      await store.saveVoice(vkey, audio, Date.now());
    } catch (e) {
      await store.dropVoice(vkey);
      // Google says the free quota is used up: stop trying until the window clears.
      if (e instanceof GeminiError && e.status === 429) for (let i = 0; i < GEMINI_RUNTIME_PER_DAY; i++) await store.addHit('gemini-tts', now);
    }
  };
  return { status: 'preparing', make };
}

/** True when a saved answer already has its Playref-voice clip (so the app can play it straight away). */
export async function hasSavedVoice(answer: Parameters<typeof spokenText>[0], store: Store): Promise<boolean> {
  try {
    return await store.hasVoice(voiceKey(spokenText(answer)));
  } catch {
    return false;
  }
}
