import { useEffect, useRef, useState } from 'react';
import { MAX_RECORD_MS, MicError, startRecording, transcribeClip, type Recording } from './voice';

export type VoiceState = 'idle' | 'starting' | 'recording' | 'writing';

const MIC_MESSAGES: Record<MicError['problem'], string> = {
  denied: 'The microphone is blocked. Allow it for this site in your browser settings, or type your question.',
  'no-mic': 'No microphone found. Type your question instead.',
  failed: "Couldn't start the microphone. Type your question instead.",
};

/**
 * Tap to talk, tap again to stop (or it stops itself after 20 seconds). The words land in the
 * question box for the player to check; nothing is asked until they tap Ask.
 */
export function useVoice(onText: (text: string) => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const rec = useRef<Recording | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = useRef(true);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimers();
      rec.current?.cancel();
      rec.current = null;
    };
  }, []);

  async function finish() {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    clearTimers();
    setState('writing');
    const clip = await r.stop();
    const res = await transcribeClip(clip);
    if (!alive.current) return;
    setState('idle');
    if (res.status === 'ok') {
      onTextRef.current(res.text);
      setMessage('Check the words, then tap Ask.');
    } else if (res.status === 'empty') setMessage("Didn't catch that. Hold the phone closer and try again.");
    else if (res.status === 'rate_limited') setMessage("You've used voice a lot this hour. Type your question instead.");
    else if (res.status === 'ai_off') setMessage('Voice is resting until tomorrow. Type your question, or tap a common fight.');
    else setMessage(res.message);
  }

  async function start() {
    setMessage(null);
    setState('starting');
    try {
      const r = await startRecording();
      if (!alive.current) return r.cancel();
      rec.current = r;
      setSeconds(0);
      setState('recording');
      const began = Date.now();
      const tick = () => {
        setSeconds(Math.floor((Date.now() - began) / 1000));
        timers.current.push(setTimeout(tick, 250));
      };
      timers.current.push(setTimeout(tick, 250));
      timers.current.push(setTimeout(() => void finish(), MAX_RECORD_MS));
    } catch (e) {
      if (!alive.current) return;
      setState('idle');
      setMessage(MIC_MESSAGES[e instanceof MicError ? e.problem : 'failed']);
    }
  }

  function toggle() {
    if (state === 'idle') void start();
    else if (state === 'recording') void finish();
  }

  return { state, seconds, message, toggle, clearMessage: () => setMessage(null) };
}
