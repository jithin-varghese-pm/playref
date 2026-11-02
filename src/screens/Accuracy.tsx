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
}

export function Accuracy() {
  const [report, setReport] = useState<AccuracyReport | null | 'none'>(null);

  useEffect(() => {
    track('page', 'accuracy');
    fetch('/accuracy.json')
      .then((r) => (r.ok ? r.json() : 'none'))
      .then((d: AccuracyReport | 'none') => setReport(d && typeof d === 'object' && 'total' in d ? d : 'none'))
      .catch(() => setReport('none'));
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
        Before every release, Playref answers a fixed set of tricky questions with known right answers. This page shows the latest score, including what it got wrong.
      </p>

      {report === null && <p className="detail-p">Loading...</p>}
      {report === 'none' && <p className="detail-p">No test run yet.</p>}
      {report && report !== 'none' && (
        <>
          <section className="score-card" aria-label="Score">
            <div className="score">
              {report.correct}
              <span> of {report.total}</span>
            </div>
            <div className="score-sub">correct on {new Date(report.ranAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </section>
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
