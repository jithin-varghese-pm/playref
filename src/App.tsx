import { useEffect, useState } from 'react';
import { fightToAnswer } from '../shared/rules';
import type { Answer } from '../shared/types';
import { ask } from './lib/api';
import { Accuracy } from './screens/Accuracy';
import { Home } from './screens/Home';
import { Thinking } from './screens/Thinking';
import { VerdictScreen } from './screens/VerdictScreen';

type Screen = { name: 'home' } | { name: 'thinking' } | { name: 'verdict'; answer: Answer; feedbackKey: string | null };

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

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [screen.name]);

  if (hash === '#/accuracy') return <Accuracy />;

  async function onAsk(question: string) {
    setNotice(null);
    setScreen({ name: 'thinking' });
    const [res] = await Promise.all([ask(question), wait(minThinkMs)]);
    if (res.status === 'ok') {
      setScreen({ name: 'verdict', answer: res.answer, feedbackKey: res.feedbackKey });
      return;
    }
    if (res.status === 'ai_off') setAiOff(true);
    if (res.status === 'rate_limited') setNotice("You've asked a lot this hour. Try the common fights, or ask again a little later.");
    if (res.status === 'error') setNotice(res.message);
    setScreen({ name: 'home' });
  }

  if (screen.name === 'thinking') return <Thinking />;
  if (screen.name === 'verdict')
    return <VerdictScreen answer={screen.answer} feedbackKey={screen.feedbackKey} onBack={() => setScreen({ name: 'home' })} />;
  return (
    <Home
      aiOff={aiOff}
      notice={notice}
      onPick={(f) => setScreen({ name: 'verdict', answer: fightToAnswer(f), feedbackKey: null })}
      onAsk={onAsk}
    />
  );
}
