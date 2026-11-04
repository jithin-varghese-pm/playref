/**
 * "Read it out", in this order:
 * 1. A fixed answer (fights, blocked-question cards): its Playref-voice (Aoede) clip, shipped with the app.
 * 2. A saved AI answer that already has its Playref-voice clip: fetched from /api/voice.
 * 3. Anything else: the phone's own voice (free, no AI, works offline). For a saved AI answer,
 *    the server records the Playref voice in the background, so the next read uses it.
 * 4. No working phone voice: the cloud voice (MeloTTS).
 *
 * Sound starts inside the tap with no waiting first, because iPhones block sound that starts later.
 */
import { fitForVoice, spokenText, voiceKey } from '../../shared/spoken';
import type { Answer } from '../../shared/types';
import { VOICE_CLIPS } from '../../shared/voiceClips';

export { spokenText };
/** Kept for the cloud voice's 600-character limit. */
export const forCloud = fitForVoice;

const CLIPS = new Set(VOICE_CLIPS);
const SILENCE = '/voice/silence.mp3';

export type ReadResult = 'clip' | 'aoede' | 'device' | 'cloud' | 'failed';

export interface ReadOptions {
  /** The saved-answer key, for AI answers that can have a Playref-voice clip. */
  feedbackKey?: string | null;
  /** The server says this saved answer already has its clip. */
  voice?: boolean;
}

let stopCurrent: (() => void) | null = null;
let player: HTMLAudioElement | null = null;

export function stopReading(): void {
  stopCurrent?.();
  stopCurrent = null;
}

function audioEl(): HTMLAudioElement {
  player ??= new Audio();
  return player;
}

/** Plays a URL on the shared player. Call play() first thing in a tap for iPhones. */
function play(url: string, revoke = false): Promise<boolean> {
  const a = audioEl();
  return new Promise<boolean>((resolve) => {
    let done = false;
    const end = (ok: boolean) => {
      if (done) return;
      done = true;
      a.onended = a.onerror = null;
      if (revoke) URL.revokeObjectURL(url);
      resolve(ok);
    };
    stopCurrent = () => {
      a.pause();
      end(true);
    };
    a.onended = () => end(true);
    a.onerror = () => end(false);
    a.src = url;
    a.play().catch(() => end(false));
  });
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('en'));
  // Natural-sounding voices first (Edge "Natural", Chrome "Google", iPhone "Enhanced/Premium"), then Indian English.
  const natural = (v: SpeechSynthesisVoice) => (/natural|neural|enhanced|premium|google/i.test(v.name) ? 0 : 10);
  const accent = (v: SpeechSynthesisVoice) => (/en[-_]in/i.test(v.lang) ? 0 : /en[-_]gb/i.test(v.lang) ? 1 : /en[-_]us/i.test(v.lang) ? 2 : 3);
  return voices.sort((a, b) => natural(a) + accent(a) - (natural(b) + accent(b)))[0] ?? null;
}

/** Reads with the browser's voice. Resolves true when it finished, false if it never started or failed. */
function readOnDevice(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    // Long text is cut into sentences: some browsers stop one long utterance after about 15 seconds.
    const parts = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
    const voice = pickVoice();
    let started = false;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ok);
    };
    // No sound within 2.5 seconds: this browser has no working voice.
    const timer = setTimeout(() => {
      if (!started) {
        synth.cancel();
        finish(false);
      }
    }, 2500);
    stopCurrent = () => {
      synth.cancel();
      finish(true);
    };
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = voice?.lang ?? 'en-IN';
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onstart = () => {
        started = true;
      };
      u.onerror = (e) => {
        // "interrupted" / "canceled" mean the player pressed Stop or left the screen.
        if (e.error === 'interrupted' || e.error === 'canceled') finish(true);
        else finish(started);
      };
      if (i === parts.length - 1) u.onend = () => finish(true);
      synth.speak(u);
    });
  });
}

async function fetchAudio(url: string, body: unknown, timeoutMs: number): Promise<Response | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    return await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl?.signal });
  } catch {
    return null;
  } finally {
    if (t) clearTimeout(t);
  }
}

async function readInCloud(text: string): Promise<boolean> {
  const res = await fetchAudio('/api/speak', { text: fitForVoice(text) }, 15_000);
  if (!res?.ok) return false;
  return play(URL.createObjectURL(await res.blob()), true);
}

async function deviceThenCloud(text: string): Promise<ReadResult> {
  if (await readOnDevice(text)) return 'device';
  return (await readInCloud(text)) ? 'cloud' : 'failed';
}

/** Reads the answer out loud and resolves when it ends (or is stopped). Call it straight from the tap. */
export async function readAloud(answer: Answer, opts: ReadOptions = {}): Promise<ReadResult> {
  stopReading();
  const text = spokenText(answer);
  const key = voiceKey(text);

  // 1. A fixed answer: its clip ships with the app.
  if (CLIPS.has(key)) {
    if (await play(`/voice/${key}.mp3`)) return 'clip';
    return deviceThenCloud(text);
  }

  const isAi = answer.source === 'ai' || answer.source === 'saved';
  // 2. A saved AI answer with its clip: start a silent clip inside the tap (unlocks sound on iPhones), then fetch.
  if (isAi && opts.feedbackKey && opts.voice) {
    void play(SILENCE);
    const res = await fetchAudio('/api/voice', { key: opts.feedbackKey }, 8000);
    if (res?.ok && (res.headers.get('Content-Type') ?? '').startsWith('audio/')) {
      if (await play(URL.createObjectURL(await res.blob()), true)) return 'aoede';
    }
    return deviceThenCloud(text);
  }

  // 3. The phone's voice now. For a saved AI answer, ask the server to record the Playref voice for next time.
  const reading = deviceThenCloud(text);
  if (isAi && opts.feedbackKey) void fetchAudio('/api/voice', { key: opts.feedbackKey }, 8000);
  return reading;
}
