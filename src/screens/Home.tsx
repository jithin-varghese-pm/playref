import { useState, type FormEvent } from 'react';
import { buttonFights } from '../../shared/rules';
import type { Fight } from '../../shared/types';
import { Footer } from './Footer';

const DOTS = ['#C8102E', '#0067B1', '#00A651', '#FFD100'];

interface Props {
  aiOff: boolean;
  notice: string | null;
  onPick: (f: Fight) => void;
  onAsk: (question: string) => void;
}

export function Home({ aiOff, notice, onPick, onAsk }: Props) {
  const [q, setQ] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim() && !aiOff) onAsk(q.trim());
  }

  return (
    <main className="screen home">
      <header className="brand">
        <div>
          <div className="wordmark">
            Play<span>ref</span>
          </div>
          <div className="byline">by MBM</div>
        </div>
        <div className="tagline">Unofficial rules referee</div>
      </header>

      <section className="game-card" aria-label="Game">
        <div className="mini-card" aria-hidden="true" />
        <div>
          <div className="game-title">UNO card game</div>
          <div className="game-sub">Classic rules. More road-trip games soon.</div>
        </div>
      </section>

      <section className="fights">
        <h1 className="display">What's the fight?</h1>
        <div className="fight-list">
          {buttonFights.map((f, i) => (
            <button key={f.id} type="button" className="fight tap" onClick={() => onPick(f)}>
              <span className="dot" aria-hidden="true" style={{ background: DOTS[i % DOTS.length] }} />
              {f.question}
            </button>
          ))}
        </div>
      </section>

      <form className="ask" onSubmit={submit}>
        <label htmlFor="ask-input">Or type your own</label>
        <div className="ask-row">
          <input
            id="ask-input"
            type="text"
            value={q}
            maxLength={300}
            disabled={aiOff}
            placeholder={aiOff ? 'Resting until tomorrow' : 'Describe the fight'}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" className="ask-btn tap" disabled={aiOff || !q.trim()}>
            Ask
          </button>
        </div>
        {aiOff && (
          <p className="notice" role="status">
            Typed questions are back tomorrow. Try the common fights above.
          </p>
        )}
        {!aiOff && notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </form>

      <Footer showAccuracy />
    </main>
  );
}
