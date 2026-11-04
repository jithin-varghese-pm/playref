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
