import { useEffect, useState } from 'react';
import { LINKS } from '../lib/links';
import type { AccuracyReport } from './Accuracy';
import { Footer } from './Footer';

/** "How Playref was built": a short case study for people who arrive from the portfolio. */
export function About() {
  const [score, setScore] = useState<AccuracyReport | null>(null);

  useEffect(() => {
    fetch('/accuracy.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setScore(d && typeof d === 'object' && 'total' in d ? d : null))
      .catch(() => setScore(null));
  }, []);

  return (
    <main className="screen about">
      <nav className="verdict-nav">
        <a href="#/" className="back tap" aria-label="Back to fights">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </a>
        <div className="verdict-q">How Playref was built</div>
      </nav>

      <section className="about-hero">
        <p className="about-kicker">Side project · AI product</p>
        <h1 className="display">A referee for the fights every road trip has.</h1>
        <p className="detail-p">
          Card games on road trips end in arguments about rules nobody can check. Ask a general AI chatbot and it will happily invent a rule. Playref settles the fight in
          seconds, and says so honestly when it is not sure.
        </p>
      </section>

      <section className="about-stats" aria-label="Key numbers">
        <div className="stat">
          <div className="stat-num">{score ? `${score.correct}/${score.total}` : '-'}</div>
          <div className="stat-label">on the public test set</div>
        </div>
        <div className="stat">
          <div className="stat-num">3 steps</div>
          <div className="stat-label">before any AI is used</div>
        </div>
        <div className="stat">
          <div className="stat-num">$0</div>
          <div className="stat-label">to run, on free tiers</div>
        </div>
      </section>

      <section className="detail">
        <h2>The product calls</h2>
        <ul className="about-list">
          <li>
            <strong>Answers come from the rulebook, not the model.</strong> 18 rule cards written in plain English and checked against Mattel's Classic rules sheet are the
            single source of truth.
          </li>
          <li>
            <strong>AI is the last step, not the first.</strong> A question is first matched to known fights with hand-checked answers, then to saved answers. Only a truly new
            question reaches the AI.
          </li>
          <li>
            <strong>Honest over confident.</strong> Every AI reply must cite real rule cards. If it does not, the player sees NOT SURE instead of a guess.
          </li>
          <li>
            <strong>Built for the moment of the fight.</strong> Phone first, one tap for the common fights, a verdict you can read from across the table, and a share button for
            the group chat.
          </li>
          <li>
            <strong>Measured in public.</strong> A fixed set of 50 tricky questions runs before every release, and the score, misses included, is on the{' '}
            <a href="#/accuracy">Accuracy page</a>.
          </li>
        </ul>
      </section>

      <section className="detail">
        <h2>Built with</h2>
        <p>React and TypeScript, Cloudflare Pages, Workers AI (Llama 3.3 70B) and D1, with tests and auto-deploy on GitHub Actions. Built with Claude as a coding partner.</p>
      </section>

      <section className="about-cta">
        <a className="primary tap cta-btn" href={LINKS.portfolio} target="_blank" rel="noopener">
          See my portfolio
        </a>
        <a className="secondary tap cta-btn" href={LINKS.linkedin} target="_blank" rel="noopener">
          Connect on LinkedIn
        </a>
        <a className="cta-text" href={LINKS.code} target="_blank" rel="noopener">
          Read the code on GitHub
        </a>
      </section>

      <Footer />
    </main>
  );
}
