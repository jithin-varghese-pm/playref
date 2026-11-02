import { useState } from 'react';
import { RULES_SHEET_URL, verdictWord } from '../../shared/rules';
import type { Answer, Verdict } from '../../shared/types';
import { sendFeedback } from '../lib/api';
import { shareVerdict } from '../lib/share';
import { Footer } from './Footer';

const CARD_STYLE: Record<Verdict, { bg: string; fg: string }> = {
  YES: { bg: '#7ED957', fg: '#1A1A1A' },
  NO: { bg: '#FFFFFF', fg: '#C8102E' },
  'HOUSE RULE': { bg: '#FFD100', fg: '#1A1A1A' },
  RULE: { bg: '#8FD3FF', fg: '#1A1A1A' },
  'NOT SURE': { bg: '#E6E6E6', fg: '#1A1A1A' },
};

interface Props {
  answer: Answer;
  feedbackKey: string | null;
  onBack: () => void;
}

export function VerdictScreen({ answer, feedbackKey, onBack }: Props) {
  const [voted, setVoted] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const style = CARD_STYLE[answer.verdict];
  const fromAi = answer.source === 'ai' || answer.source === 'saved';

  async function vote(correct: boolean) {
    setVoted(true);
    if (feedbackKey) await sendFeedback(feedbackKey, answer, correct);
  }

  async function share() {
    const r = await shareVerdict(answer);
    setShareMsg(r === 'copied' ? 'Verdict copied. Paste it in your group chat.' : r === 'failed' ? 'Could not share. Try a screenshot.' : null);
  }

  return (
    <main className="screen verdict">
      <nav className="verdict-nav">
        <button type="button" className="back tap" aria-label="Back to fights" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="verdict-q">{answer.question}</div>
      </nav>

      <div className="card-stage">
        <section className="verdict-card flip" aria-label="Verdict">
          <div className="verdict-inner" style={{ background: style.bg, color: style.fg }}>
            <div className="verdict-label">VERDICT</div>
            <div className="verdict-word">{verdictWord(answer)}</div>
            <div className="verdict-line">{answer.line}</div>
          </div>
        </section>
      </div>

      {fromAi && <div className="ai-tag up1">AI answer from the Classic rules</div>}

      <section className="detail up1">
        <h2>What the rules say</h2>
        <p>{answer.rules}</p>
        <a href={RULES_SHEET_URL} target="_blank" rel="noreferrer">
          Read Mattel's rules sheet
        </a>
      </section>

      {answer.house && answer.house !== 'None common.' && (
        <section className="detail up2">
          <h2>Playing house rules?</h2>
          <p>{answer.house}</p>
        </section>
      )}

      {feedbackKey && (
        <div className="feedback up2">
          {voted ? (
            <span role="status">Thanks, noted.</span>
          ) : (
            <>
              <span>Was this answer right?</span>
              <div className="feedback-btns">
                <button type="button" className="tap" onClick={() => vote(true)}>
                  Yes
                </button>
                <button type="button" className="tap" onClick={() => vote(false)}>
                  No
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="actions up3">
        <div className="action-row">
          <button type="button" className="primary tap" onClick={share}>
            Share verdict
          </button>
          <button type="button" className="secondary tap" onClick={onBack}>
            Ask another
          </button>
        </div>
        {shareMsg && (
          <p className="notice" role="status">
            {shareMsg}
          </p>
        )}
        <Footer />
      </div>
    </main>
  );
}
