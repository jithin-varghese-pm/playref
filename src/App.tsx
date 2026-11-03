import { useEffect, useState } from 'react';
import { fightToAnswer } from '../shared/rules';
import type { Answer } from '../shared/types';
import { ask, track } from './lib/api';
import { getReportContext } from './lib/reportContext';
import { useMediaQuery } from './lib/useMediaQuery';
import { Imposter } from './screens/imposter/Imposter';
import { Report } from './screens/Report';
import { About } from './screens/About';
import { Accuracy } from './screens/Accuracy';
import { EmptyPanel } from './screens/EmptyPanel';
import { Home } from './screens/Home';
import { Thinking } from './screens/Thinking';
import { VerdictScreen } from './screens/VerdictScreen';

type Screen = { name: 'home' } | { name: 'thinking' } | { name: 'verdict'; answer: Answer; feedbackKey: string | null };

/** Laptop and wide tablet screens get the split layout. Must match the CSS breakpoint. */
export const WIDE_QUERY = '(min-width: 900px)';

function noticeCard(question: string, res: { status: 'rate_limited' } | { status: 'error'; message: string }): Answer {
  const base = { question, verdict: 'NOT SURE' as const, house: 'None common.', cards: [], source: 'scope' as const };
  return res.status === 'rate_limited'
    ? {
        ...base,
        label: 'TIME OUT',
        line: "You've asked a lot of new questions this hour.",
        rules: 'The common fights still answer instantly. New questions open up again within the hour.',
      }
    : { ...base, label: 'OOPS', line: res.message, rules: 'The common fights still answer instantly. Try your question again in a moment.' };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

/** minThinkMs keeps the shuffle on screen long enough to read; tests pass 0. */
export function App({ minThinkMs = 900 }: { minThinkMs?: number }) {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [aiOff, setAiOff] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const hash = useHashRoute();
  const wide = useMediaQuery(WIDE_QUERY);

  useEffect(() => {
    if (!wide) window.scrollTo?.(0, 0);
  }, [screen.name, wide]);

  if (hash === '#/accuracy') return <Accuracy />;
  if (hash === '#/about') return <About />;
  if (hash === '#/report') return <Report context={getReportContext()} wide={wide} />;
  if (hash === '#/imposter') return <Imposter />;

  async function onAsk(question: string) {
    setNotice(null);
    setScreen({ name: 'thinking' });
    const [res] = await Promise.all([ask(question), wait(minThinkMs)]);
    if (res.status === 'ok') {
      setScreen({ name: 'verdict', answer: res.answer, feedbackKey: res.feedbackKey });
      return;
    }
    if (res.status === 'rate_limited' || res.status === 'error') {
      // Show it as a card where the verdict would be, so it cannot be missed on a phone or a laptop.
      setScreen({ name: 'verdict', answer: noticeCard(question, res), feedbackKey: null });
      return;
    }
    if (res.status === 'ai_off') setAiOff(true);
    setScreen({ name: 'home' });
  }

  const home = (
    <Home
      aiOff={aiOff}
      notice={notice}
      onPick={(f) => {
        track('tap', f.id);
        setScreen({ name: 'verdict', answer: fightToAnswer(f), feedbackKey: null });
      }}
      onAsk={onAsk}
    />
  );
  const goHome = () => {
    setScreen({ name: 'home' });
    if (wide) document.getElementById('ask-input')?.focus();
  };

  // Laptop: fights on the left, the verdict lands on the right without leaving the page.
  if (wide) {
    return (
      <div className="desk">
        {home}
        <div className="panel-wrap" aria-live="polite">
          {screen.name === 'thinking' && <Thinking embedded />}
          {screen.name === 'verdict' && (
            <VerdictScreen
              key={`${screen.answer.question}|${screen.answer.verdict}`}
              embedded
              answer={screen.answer}
              feedbackKey={screen.feedbackKey}
              onBack={goHome}
            />
          )}
          {screen.name === 'home' && <EmptyPanel />}
        </div>
      </div>
    );
  }

  // Phone: one screen at a time.
  if (screen.name === 'thinking') return <Thinking />;
  if (screen.name === 'verdict') return <VerdictScreen answer={screen.answer} feedbackKey={screen.feedbackKey} onBack={goHome} />;
  return home;
}
