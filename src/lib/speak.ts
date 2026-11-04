/**
 * "Read it out": the phone's own voice first (free, no AI, works offline on most phones).
 * If the browser has no voice, or it fails to start, a cloud voice (MeloTTS) reads it instead.
 */
import type { Answer } from '../../shared/types';

const VERDICT_SAID: Record<Answer['verdict'], string> = {
  YES: 'Yes.',
  NO: 'No.',
  'HOUSE RULE': 'House rule.',
  RULE: 'The rule.',
  'NOT SURE': 'Not sure.',
};

/** Card names said the way players say them. */
function sayable(text: string): string {
  return text
    .replace(/\+\s?2\b/g, 'plus 2')
    .replace(/\+\s?4\b/g, 'plus 4')
    .replace(/\s+/g, ' ')
    .trim();
}

function endSentence(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

/** What gets read: the verdict, the one-line ruling, then what the rules say. */
export function spokenText(a: Pick<Answer, 'verdict' | 'label' | 'line' | 'rules'>): string {
  const verdict = a.label ? endSentence(a.label.charAt(0) + a.label.slice(1).toLowerCase()) : VERDICT_SAID[a.verdict];
  return sayable(`${verdict} ${endSentence(a.line)} ${endSentence(a.rules)}`);
}

/** The cloud voice takes at most 600 characters: cut at the last full sentence that fits. */
export function forCloud(text: string, max = 600): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return end > 0 ? cut.slice(0, end + 1) : cut;
}

export type ReadResult = 'device' | 'cloud' | 'failed';

let stopCurrent: (() => void) | null = null;

export function stopReading(): void {
  stopCurrent?.();
  stopCurrent = null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('en'));
  const rank = (v: SpeechSynthesisVoice) => (v.localService ? 0 : 10) + (/en[-_]in/i.test(v.lang) ? 0 : /en[-_]gb/i.test(v.lang) ? 1 : /en[-_]us/i.test(v.lang) ? 2 : 3);
  return voices.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** Reads with the browser's voice. Resolves true when it finished, false if it never started or failed. */
function readOnDevice(text: string): Promise<boolean> {
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
    // No sound within 2.5 seconds: this browser has no working voice, so use the cloud one.
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
      u.rate = 1;
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

async function readInCloud(text: string): Promise<boolean> {
  try {
    const res = await fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: forCloud(text) }) });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    return await new Promise<boolean>((resolve) => {
      const end = (ok: boolean) => {
        URL.revokeObjectURL(url);
        resolve(ok);
      };
      stopCurrent = () => {
        audio.pause();
        end(true);
      };
      audio.onended = () => end(true);
      audio.onerror = () => end(false);
      audio.play().catch(() => end(false));
    });
  } catch {
    return false;
  }
}

/** Reads the text out loud and resolves when it ends (or is stopped). */
export async function readAloud(text: string): Promise<ReadResult> {
  stopReading();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
    if (await readOnDevice(text)) return 'device';
  }
  return (await readInCloud(text)) ? 'cloud' : 'failed';
}
