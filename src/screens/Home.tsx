import { useRef, useState, type FormEvent } from 'react';
import { useVoice } from '../lib/useVoice';
import { canRecord } from '../lib/voice';
import { buttonFights } from '../../shared/rules';
import type { Fight } from '../../shared/types';
import { Footer } from './Footer';
import { GameTabs } from './GameTabs';


const EXAMPLES = ['Can I play a Skip on a Reverse?', 'Who goes first?', 'Can I play a green 7 on a red 7?'];

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
    </svg>
  );
}

interface Props {
  aiOff: boolean;
  /** True while a typed question is being checked: the box and button are locked. */
  busy?: boolean;
  notice: string | null;
  onPick: (f: Fight) => void;
  onAsk: (question: string) => void;
}

export function Home({ aiOff, busy = false, notice, onPick, onAsk }: Props) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Voice uses AI to write the question down, so it rests with typed questions.
  const [voiceOk] = useState(canRecord);
  const voice = useVoice((text) => setQ(text));
  const listening = voice.state !== 'idle';

  function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim() && !aiOff && !busy && voice.state === 'idle') onAsk(q.trim());
  }

  return (
    <main className="screen home">
      <header className="brand">
        <div>
          <div className="wordmark">
            Play<span>ref</span>
          </div>
          <div className="byline">
            <span>by</span>
            <img src="/mbm-logo.png" alt="Moved By Machines" width={84} height={30} />
          </div>
        </div>
        <div className="tagline">Unofficial rules referee</div>
      </header>

      <GameTabs active="uno" />

      <form className="ask-hero" onSubmit={submit} aria-label="Ask the AI referee">
        <div className="ask-head">
          <span className="ai-badge">
            <SparkIcon />
            AI referee
          </span>
          <span className="game-pill">
            <span className="mini-card" aria-hidden="true" />
            UNO · Classic rules
          </span>
        </div>
        <h1 className="display ask-title">What's the fight?</h1>
        <label htmlFor="ask-input" className="ask-sub">
          Describe it in your own words. Every answer is checked against the rules.
        </label>
        <textarea
          id="ask-input"
          ref={inputRef}
          rows={2}
          value={q}
          maxLength={300}
          disabled={aiOff}
          readOnly={busy || listening}
          placeholder={aiOff ? 'Resting until tomorrow' : 'e.g. My friend played a +4 but I think she had red'}
          onChange={(e) => {
            setQ(e.target.value);
            voice.clearMessage();
          }}
          onKeyDown={(e) => {
            // Enter while an Indian-language keyboard is still composing a word must not send.
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (q.trim() && !aiOff && !busy && !listening) onAsk(q.trim());
            }
          }}
        />
        {!aiOff && (
          <div className="examples" aria-label="Example questions">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="example"
                onClick={() => {
                  setQ(ex);
                  // Only fill the box. Focusing it would pop up the keyboard on phones.
                  // With a mouse (laptop) focusing is harmless and lets people edit straight away.
                  if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus();
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        <div className="ask-row">
          {voiceOk && !aiOff && (
            <button
              type="button"
              className={`mic-btn tap${voice.state === 'recording' ? ' on' : ''}`}
              disabled={busy || voice.state === 'starting' || voice.state === 'writing'}
              aria-pressed={voice.state === 'recording'}
              aria-label={voice.state === 'recording' ? 'Stop recording' : 'Ask by voice'}
              onClick={voice.toggle}
            >
              {voice.state === 'recording' ? <span className="mic-stop" aria-hidden="true" /> : <MicIcon />}
            </button>
          )}
          <button type="submit" className="ask-btn tap" disabled={aiOff || busy || listening || !q.trim()}>
            <SparkIcon />
            Ask the referee
          </button>
        </div>
        {voice.state === 'recording' && (
          <p className="voice-status live" role="status">
            <span className="rec-dot" aria-hidden="true" />
            Listening… 0:{String(voice.seconds).padStart(2, '0')} · tap ■ when done
          </p>
        )}
        {voice.state === 'writing' && (
          <p className="voice-status" role="status">
            Writing it down…
          </p>
        )}
        {voice.state === 'idle' && voice.message && (
          <p className="voice-status" role="status">
            {voice.message}
          </p>
        )}
        <p className="privacy-note">
          Questions Playref can't answer are saved without anything about you, so they can be added later.
          {voiceOk && " Voice questions are written down by Cloudflare's speech AI. Playref never keeps the recording."}
        </p>
        {aiOff && (
          <p className="notice" role="status">
            Typed questions are back tomorrow. Tap a common fight below.
          </p>
        )}
        {!aiOff && notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </form>

      <section className="fights">
        <h2 className="fights-title">Or tap a common fight</h2>
        <div className="fight-list">
          {buttonFights.map((f) => (
            <button key={f.id} type="button" className="fight tap" onClick={() => onPick(f)}>
              <span className="dot" aria-hidden="true" />
              {f.question}
            </button>
          ))}
        </div>
        <p className="fights-note">More road-trip games coming soon.</p>
      </section>

      <Footer showAccuracy />
    </main>
  );
}
