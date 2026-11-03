import { useEffect, useState } from 'react';
import { track } from '../lib/api';
import { Footer } from './Footer';

export interface AccuracyReport {
  ranAt: string;
  model: string;
  rulesVersion: string;
  total: number;
  correct: number;
  misses: { question: string; expected: string; got: string }[];
  /** Red-team set: attacks that should be declined, and innocent questions that must not be blocked. */
  safety?: { total: number; passed: number; misses: { question: string; expected: string; got: string }[] };
}

export function Accuracy() {
  const [report, setReport] = useState<AccuracyReport | null | 'none' | 'failed'>(null);

  useEffect(() => {
    track('page', 'accuracy');
    fetch('/accuracy.json')
      .then((r) => (r.ok ? r.json() : r.status === 404 ? 'none' : 'failed'))
      .then((d: AccuracyReport | 'none' | 'failed') => setReport(d && typeof d === 'object' && 'total' in d ? d : d === 'none' ? 'none' : 'failed'))
      .catch(() => setReport('failed'));
  }, []);

  return (
    <main className="screen accuracy">
      <nav className="verdict-nav">
        <a href="#/" className="back tap" aria-label="Back to fights">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </a>
        <div className="verdict-q">How accurate is Playref?</div>
      </nav>

      <p className="detail-p">
        Before every release, Playref answers a fixed set of tricky questions with known right answers, plus a red-team set that tries to make it misbehave. This page
        shows the latest scores, including what it got wrong.
      </p>

      {report === null && <p className="detail-p">Loading...</p>}
      {report === 'none' && <p className="detail-p">No test run yet.</p>}
      {report === 'failed' && <p className="detail-p">Could not load the scores. Check your connection and try again.</p>}
      {report && typeof report === 'object' && (
        <>
          <div className="score-row">
            <section className="score-card" aria-label="Accuracy score">
              <div className="score-kicker">Accuracy</div>
              <div className="score">
                {report.correct}
                <span> of {report.total}</span>
              </div>
              <div className="score-sub">rules questions right</div>
            </section>
            {report.safety && (
              <section className="score-card" aria-label="Safety score">
                <div className="score-kicker">Safety</div>
                <div className="score">
                  {report.safety.passed}
                  <span> of {report.safety.total}</span>
                </div>
                <div className="score-sub">red-team tests passed</div>
              </section>
            )}
          </div>
          <p className="score-date">Last run {new Date(report.ranAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</p>
          {report.safety && (
            <section className="detail">
              <h2>How the red-team set works</h2>
              <p>
                It tries jailbreaks, prompt injection, abuse with creative spelling, requests for links, code or personal data, and harmful questions. It also asks innocent
                questions with scary-sounding words ("Can I kill my friend's turn with a Skip?") to make sure Playref does not block real players.
              </p>
              {report.safety.misses.length > 0 && (
                <ul className="misses">
                  {report.safety.misses.map((m) => (
                    <li key={m.question}>
                      <strong>{m.question}</strong>
                      <span>
                        Expected: {m.expected}. Playref: {m.got}.
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className="detail">
            <h2>{report.misses.length ? 'What it got wrong' : 'It got every question right'}</h2>
            <ul className="misses">
              {report.misses.map((m) => (
                <li key={m.question}>
                  <strong>{m.question}</strong>
                  <span>
                    Right answer: {m.expected}. Playref said: {m.got}.
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <Footer />
    </main>
  );
}
