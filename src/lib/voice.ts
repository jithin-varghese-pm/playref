/**
 * Voice questions: record with the browser's own recorder (works in Chrome, Safari, Firefox, Edge,
 * Samsung Internet and Brave), then send the clip to /api/transcribe and get the words back.
 */
import type { TranscribeResponse } from '../../shared/types';

/** The app stops recording on its own after this long. */
export const MAX_RECORD_MS = 20_000;

/** First type the browser can record wins. Chrome/Firefox/Edge: WebM or Ogg. Safari: MP4. */
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/aac'];

export function canRecord(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export type MicProblem = 'denied' | 'no-mic' | 'failed';

export class MicError extends Error {
  constructor(public problem: MicProblem) {
    super(problem);
  }
}

export interface Recording {
  /** Stops and returns the clip. */
  stop(): Promise<Blob>;
  /** Stops and throws the clip away. */
  cancel(): void;
}

export async function startRecording(): Promise<Recording> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    const name = e instanceof DOMException || e instanceof Error ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new MicError('denied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new MicError('no-mic');
    throw new MicError('failed');
  }
  const mimeType = TYPES.find((t) => typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(t));
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
  } catch {
    rec = new MediaRecorder(stream);
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const release = () => stream.getTracks().forEach((t) => t.stop());
  rec.start();

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' }));
        };
        if (rec.state === 'inactive') rec.onstop(new Event('stop'));
        else rec.stop();
      }),
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      release();
    },
  };
}

const NO_SIGNAL = 'Voice needs a signal. Type your question, or tap a common fight.';

export async function transcribeClip(clip: Blob): Promise<TranscribeResponse> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'error', message: NO_SIGNAL };
  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      // The server only takes audio types; strip codec details some servers dislike.
      headers: { 'Content-Type': (clip.type || 'audio/webm').split(';')[0] },
      body: clip,
    });
    return (await res.json()) as TranscribeResponse;
  } catch {
    return { status: 'error', message: NO_SIGNAL };
  }
}
