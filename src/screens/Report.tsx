import { useState, type FormEvent } from 'react';
import { Footer } from './Footer';

type ReportType = 'bug' | 'idea' | 'other';

const TYPES: { value: ReportType; label: string; hint: string }[] = [
  { value: 'bug', label: 'Report a bug', hint: 'Something broke or an answer looked wrong' },
  { value: 'idea', label: 'Suggest an idea', hint: 'A feature, a game, a fight we should cover' },
  { value: 'other', label: 'Something else', hint: 'Anything you want to tell me' },
];

interface Props {
  /** The question and verdict this is about, when sent from a verdict screen. */
  context: string | null;
  wide: boolean;
}

export function Report({ context, wide }: Props) {
  const [type, setType] = useState<ReportType>(context ? 'bug' : 'idea');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState(''); // honeypot, hidden from people
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setState('sending');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, contact, context, website, page: context ? 'verdict' : 'home', device: wide ? 'laptop' : 'phone' }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) setState('sent');
      else {
        setError(data.error ?? 'Could not send. Try again.');
        setState('idle');
      }
    } catch {
      setError('No connection. Try again in a moment.');
      setState('idle');
    }
  }

  return (
    <main className="screen report">
      <nav className="verdict-nav">
        <a href="#/" className="back tap" aria-label="Back to fights">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </a>
        <div className="verdict-q">Feedback</div>
      </nav>

      {state === 'sent' ? (
        <section className="report-card" role="status">
          <h1 className="display report-title">Thank you!</h1>
          <p>Jithin reads every message. {contact ? "If it needs a reply, he'll get back to you." : ''}</p>
          <a className="ask-btn tap report-done" href="#/">
            Back to Playref
          </a>
        </section>
      ) : (
        <form className="report-card" onSubmit={submit}>
          <h1 className="display report-title">Help make Playref better</h1>
          <fieldset className="report-types">
            <legend>What is it about?</legend>
            {TYPES.map((t) => (
              <label key={t.value} className={`report-type${type === t.value ? ' on' : ''}`}>
                <input type="radio" name="type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} />
                <span className="rt-label">{t.label}</span>
                <span className="rt-hint">{t.hint}</span>
              </label>
            ))}
          </fieldset>

          {context && (
            <div className="report-context">
              <span>About this answer</span>
              <p>{context}</p>
            </div>
          )}

          <label className="report-field">
            <span>Your message</span>
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={type === 'bug' ? 'What happened, and what did you expect?' : 'Tell me your idea'}
            />
          </label>

          <label className="report-field">
            <span>Email or phone (optional, only if you want a reply)</span>
            <input type="text" maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" />
          </label>

          <label className="hp" aria-hidden="true">
            Website
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>

          {error && (
            <p className="report-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="ask-btn tap" disabled={state === 'sending' || message.trim().length < 5}>
            {state === 'sending' ? 'Sending...' : 'Send feedback'}
          </button>
          <p className="report-note">Messages go only to Jithin. Contact details are used only to reply.</p>
        </form>
      )}

      <Footer />
    </main>
  );
}
