import { useEffect, useState, type KeyboardEvent } from 'react';
import { IMPOSTER_FIGHTS } from '../../../shared/generated/imposter-data';
import { cardFor, dealRound, freshFairness, MAX_PLAYERS, MIN_PLAYERS, updateFairness, type Fairness, type Round } from '../../../shared/imposter/engine';
import { WORD_PACKS } from '../../../shared/imposter/words';
import { fightToAnswer } from '../../../shared/rules';
import type { Answer } from '../../../shared/types';
import { track } from '../../lib/api';
import { Footer } from '../Footer';
import { GameTabs } from '../GameTabs';
import { VerdictScreen } from '../VerdictScreen';

/** Phases of one round, following rules/imposter.md. */
type Phase =
  | { name: 'setup' }
  | { name: 'fight'; answer: Answer }
  | { name: 'pass'; player: number; seen: boolean; peek: boolean }
  | { name: 'peek-pick' }
  | { name: 'talk' }
  | { name: 'vote'; tie: boolean }
  | { name: 'early-pick' }
  | { name: 'guess'; player: number; early: boolean }
  | { name: 'not-imposter'; player: number; early: boolean }
  | { name: 'result'; imposterWin: boolean; reason: string };

const STORE = 'playref.imposter.v1';

interface Saved {
  players: number;
  packId: string;
  fairness: Fairness;
  used: string[];
}

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Saved | null;
    if (s && s.players >= MIN_PLAYERS && s.players <= MAX_PLAYERS) return s;
  } catch {
    // Private mode or blocked storage: start fresh.
  }
  return { players: 5, packId: WORD_PACKS[0].id, fairness: freshFairness(5), used: [] };
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    // Nothing to do: the game still works without saving.
  }
}

const name = (i: number) => `Player ${i + 1}`;
const list = (ids: number[]) => ids.map(name).join(' and ');

export function Imposter() {
  const [saved, setSaved] = useState<Saved>(load);
  const [round, setRound] = useState<Round | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'setup' });
  const [caught, setCaught] = useState<number[]>([]);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => save(saved), [saved]);
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [phase.name]);

  function setPlayers(n: number) {
    const players = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n));
    setSaved((s) => ({ ...s, players, fairness: players === s.players ? s.fairness : freshFairness(players) }));
  }

  function start() {
    const r = dealRound(saved.players, saved.packId, saved.fairness, saved.used);
    setSaved((s) => ({ ...s, fairness: updateFairness(s.players, s.fairness, r.imposters), used: [...s.used, r.word].slice(-200) }));
    setRound(r);
    setCaught([]);
    setPhase({ name: 'pass', player: 0, seen: false, peek: false });
    track('game', 'imposter-start');
  }

  function finish(imposterWin: boolean, reason: string) {
    setPhase({ name: 'result', imposterWin, reason });
    track('game', imposterWin ? 'imposter-win' : 'group-win');
  }

  function accuse(player: number) {
    if (!round) return;
    if (round.imposters.includes(player)) setPhase({ name: 'guess', player, early: false });
    else finish(true, `${name(player)} was not an imposter.`);
  }

  function guessed(right: boolean, player: number, early: boolean) {
    if (!round) return;
    if (right) return finish(true, `${name(player)} guessed the word${early ? ' early' : ''}.`);
    if (early) return finish(false, `${name(player)} guessed early and got it wrong.`);
    const nowCaught = [...caught, player];
    setCaught(nowCaught);
    const left = round.imposters.filter((i) => !nowCaught.includes(i));
    if (left.length === 0) finish(false, `Every imposter was caught.`);
    else setPhase({ name: 'vote', tie: false });
  }

  if (phase.name === 'fight') {
    return <VerdictScreen answer={phase.answer} feedbackKey={null} onBack={() => setPhase({ name: 'setup' })} />;
  }

  if (phase.name === 'setup') {
    const pack = WORD_PACKS.find((p) => p.id === saved.packId) ?? WORD_PACKS[0];
    const fights = IMPOSTER_FIGHTS.filter((f) => f.button || showMore);
    return (
      <main className="screen imposter">
        <Brand />
        <GameTabs active="imposter" />
        <section className="imp-card">
          <h1 className="display imp-title">Who's the imposter?</h1>
          <p className="imp-sub">Everyone gets the same secret word, except the imposter. Give one-word clues, then find the faker. Works in the car.</p>
          <div className="imp-row">
            <span className="imp-label">Players</span>
            <div className="stepper">
              <button type="button" aria-label="Fewer players" onClick={() => setPlayers(saved.players - 1)} disabled={saved.players <= MIN_PLAYERS}>
                −
              </button>
              <span aria-live="polite" className="stepper-num">
                {saved.players}
              </span>
              <button type="button" aria-label="More players" className="dark" onClick={() => setPlayers(saved.players + 1)} disabled={saved.players >= MAX_PLAYERS}>
                +
              </button>
            </div>
          </div>
          <p className="imp-hint">{saved.players >= 7 ? '2 hidden imposters' : '1 hidden imposter'} for this group.</p>
          <fieldset className="imp-packs">
            <legend className="imp-label">Word pack</legend>
            {WORD_PACKS.map((p) => (
              <button key={p.id} type="button" className={`pack${p.id === pack.id ? ' on' : ''}`} aria-pressed={p.id === pack.id} onClick={() => setSaved((s) => ({ ...s, packId: p.id }))}>
                {p.id === pack.id ? '✓ ' : ''}
                {p.name}
              </button>
            ))}
          </fieldset>
          <button type="button" className="ask-btn tap imp-start" onClick={start}>
            Start game
          </button>
          <p className="imp-fair">Free. Fair: nobody is the imposter twice in a row.</p>
        </section>

        <section className="fights">
          <h2 className="fights-title">Imposter fights</h2>
          <div className="fight-list">
            {fights.map((f) => (
              <button
                key={f.id}
                type="button"
                className="fight tap"
                onClick={() => {
                  track('tap', f.id);
                  setPhase({ name: 'fight', answer: { ...fightToAnswer(f), game: 'imposter' } });
                }}
              >
                <span className="dot" aria-hidden="true" />
                {f.question}
              </button>
            ))}
          </div>
          {!showMore && (
            <button type="button" className="more-link" onClick={() => setShowMore(true)}>
              More Imposter fights
            </button>
          )}
        </section>
        <Footer />
      </main>
    );
  }

  if (!round) return null;

  if (phase.name === 'pass') {
    const last = phase.player === round.players - 1;
    return (
      <main className="screen imposter imp-dark">
        <div className="imp-top">
          <span>Imposter · {WORD_PACKS.find((p) => p.id === round.packId)?.name}</span>
          {!phase.peek && (
            <span>
              {phase.player} of {round.players} seen
            </span>
          )}
        </div>
        {!phase.peek && (
          <div className="progress" aria-hidden="true">
            {Array.from({ length: round.players }, (_, i) => (
              <span key={i} className={i < phase.player ? 'done' : ''} />
            ))}
          </div>
        )}
        <div className="pass-to">
          <span>{phase.peek ? 'Peek again for' : 'Pass the phone to'}</span>
          <strong className="display">{name(phase.player)}</strong>
        </div>
        <HoldCard card={cardFor(round, phase.player)} onSeen={() => setPhase((p) => (p.name === 'pass' ? { ...p, seen: true } : p))} />
        <button
          type="button"
          className="ask-btn tap imp-next"
          disabled={!phase.seen}
          onClick={() => {
            if (phase.peek) setPhase({ name: 'talk' });
            else if (last) setPhase({ name: 'talk' });
            else setPhase({ name: 'pass', player: phase.player + 1, seen: false, peek: false });
          }}
        >
          {!phase.seen ? 'Hold the card to see it first' : phase.peek ? 'Hide and give back' : last ? 'Hide. Everyone has seen their card' : `Hide and pass to ${name(phase.player + 1)}`}
        </button>
      </main>
    );
  }

  if (phase.name === 'peek-pick' || phase.name === 'early-pick') {
    const early = phase.name === 'early-pick';
    return (
      <main className="screen imposter">
        <section className="imp-card">
          <h1 className="display imp-title">{early ? 'Who is guessing early?' : 'Who forgot their word?'}</h1>
          <p className="imp-sub">{early ? 'An imposter can stop the game and guess the word once. Right wins, wrong loses (rule I11).' : 'Only that player should look at the phone.'}</p>
          <PlayerGrid
            players={round.players}
            onPick={(p) => {
              if (!early) return setPhase({ name: 'pass', player: p, seen: false, peek: true });
              if (round.imposters.includes(p) && !caught.includes(p)) setPhase({ name: 'guess', player: p, early: true });
              else setPhase({ name: 'not-imposter', player: p, early: true });
            }}
          />
          <button type="button" className="more-link dark" onClick={() => setPhase({ name: 'talk' })}>
            Back
          </button>
        </section>
      </main>
    );
  }

  if (phase.name === 'not-imposter') {
    return (
      <main className="screen imposter">
        <section className="imp-card">
          <h1 className="display imp-title">{name(phase.player)} is not an imposter</h1>
          <p className="imp-sub">Only an imposter can guess early. Carry on with the clues.</p>
          <button type="button" className="ask-btn tap imp-start" onClick={() => setPhase({ name: 'talk' })}>
            Back to the game
          </button>
        </section>
      </main>
    );
  }

  if (phase.name === 'talk') {
    return (
      <main className="screen imposter">
        <div className="imp-top light">
          <span>Imposter · clues</span>
        </div>
        <section className="imp-card">
          <span className="imp-kicker">Everyone has seen their card</span>
          <h1 className="display imp-title">{name(round.starter)} starts</h1>
          <ol className="imp-steps">
            <li>Two rounds. Go clockwise. Each player says one word that hints at the secret word.</li>
            <li>No saying the word, a form of it or a translation. No repeating a clue. No passing.</li>
            <li>Then talk it out. Anyone can bluff.</li>
          </ol>
          <button type="button" className="ask-btn tap imp-start" onClick={() => setPhase({ name: 'vote', tie: false })}>
            Time to vote
          </button>
          <div className="imp-two">
            <button type="button" className="secondary tap" onClick={() => setPhase({ name: 'peek-pick' })}>
              Forgot your word?
            </button>
            <button type="button" className="secondary tap" onClick={() => setPhase({ name: 'early-pick' })}>
              Imposter guessing early
            </button>
          </div>
          <button
            type="button"
            className="more-link dark"
            onClick={() => {
              track('game', 'imposter-word-said');
              start();
            }}
          >
            Someone said the word? Cancel and deal a new word
          </button>
        </section>
      </main>
    );
  }

  if (phase.name === 'vote') {
    const second = caught.length > 0;
    return (
      <main className="screen imposter">
        <section className="imp-card">
          <span className="imp-kicker">{second ? `${list(caught)} caught. Find the other imposter.` : 'Vote'}</span>
          <h1 className="display imp-title">{second ? 'One more vote' : 'On 3, 2, 1, everyone points'}</h1>
          <p className="imp-sub">{second ? 'No new clues. Vote straight away (rule I13).' : 'Everyone votes, the imposter too. Who got the most votes?'}</p>
          {phase.tie && (
            <p className="notice imp-tie" role="status">
              Tie: each tied player gives one more clue word, then vote again between them only. Still tied? The imposters win.
            </p>
          )}
          <PlayerGrid players={round.players} disabled={caught} onPick={accuse} />
          {!phase.tie ? (
            <button type="button" className="more-link dark" onClick={() => setPhase({ name: 'vote', tie: true })}>
              It's a tie
            </button>
          ) : (
            <button type="button" className="more-link dark" onClick={() => finish(true, 'The vote was still tied after the tie-break.')}>
              Still tied after the revote
            </button>
          )}
        </section>
      </main>
    );
  }

  if (phase.name === 'guess') {
    return (
      <main className="screen imposter">
        <section className="imp-card">
          <span className="imp-kicker">{phase.early ? 'Early guess' : 'Caught!'}</span>
          <h1 className="display imp-title">{name(phase.player)} is an imposter</h1>
          <p className="imp-sub">
            {name(phase.player)}, say your one guess at the word out loud. Then tap below to check. The same thing in another language counts; a broader word does not.
          </p>
          <RevealWord word={round.word} category={round.category} onJudge={(right) => guessed(right, phase.player, phase.early)} />
        </section>
      </main>
    );
  }

  // Result
  const result = phase as Extract<Phase, { name: 'result' }>;
  const shareText = `Playref Imposter: ${result.imposterWin ? 'the imposter won' : 'the group won'}! Imposter: ${list(round.imposters)}. The word was ${round.word}. ${window.location.origin}/#/imposter`;
  return (
    <main className="screen imposter">
      <div className="card-stage">
        <section className="verdict-card flip" aria-label="Result">
          <div className="verdict-inner" style={{ background: result.imposterWin ? '#1A1A1A' : '#FFD100', color: result.imposterWin ? '#FFD100' : '#1A1A1A' }}>
            <div className="verdict-label">{round.imposters.length > 1 ? 'THE IMPOSTERS WERE' : 'THE IMPOSTER WAS'}</div>
            <div className="verdict-word imp-result-name">{list(round.imposters)}</div>
            <div className="verdict-line">
              The word was <strong>{round.word}</strong>. {result.imposterWin ? 'Imposter wins!' : 'The group wins!'}
            </div>
          </div>
        </section>
      </div>
      <p className="imp-reason up1">{result.reason}</p>
      <div className="actions up2">
        <button type="button" className="primary tap" onClick={start}>
          Play again (new word, same players)
        </button>
        <div className="action-row">
          <button type="button" className="secondary tap" onClick={() => setPhase({ name: 'setup' })}>
            Change players or pack
          </button>
          <button
            type="button"
            className="secondary tap"
            onClick={async () => {
              track('share', 'shared');
              try {
                if (navigator.share) await navigator.share({ title: 'Playref Imposter', text: shareText });
                else await navigator.clipboard.writeText(shareText);
              } catch {
                // Sharing cancelled: nothing to do.
              }
            }}
          >
            Share result
          </button>
        </div>
      </div>
    </main>
  );
}

function Brand() {
  return (
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
  );
}

function PlayerGrid({ players, disabled = [], onPick }: { players: number; disabled?: number[]; onPick: (p: number) => void }) {
  return (
    <div className="player-grid">
      {Array.from({ length: players }, (_, i) => (
        <button key={i} type="button" className="player-btn tap" disabled={disabled.includes(i)} onClick={() => onPick(i)}>
          {name(i)}
        </button>
      ))}
    </div>
  );
}

/**
 * Rule I4: hold to see, release to hide. Every card has the same size and layout,
 * and there is no sound or vibration, so nothing gives the imposter away.
 */
function HoldCard({ card, onSeen }: { card: { title: string; main: string; category: string }; onSeen: () => void }) {
  const [open, setOpen] = useState(false);
  const show = () => {
    setOpen(true);
    onSeen();
  };
  const hide = () => setOpen(false);
  const keyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      show();
    }
  };
  return (
    <button
      type="button"
      className={`hold-card${open ? ' open' : ''}`}
      aria-label={open ? `${card.title} ${card.main}. Category ${card.category}.` : 'Hold to see your card'}
      onPointerDown={show}
      onPointerUp={hide}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onKeyDown={keyDown}
      onKeyUp={hide}
      onBlur={hide}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="hold-inner">
        {open ? (
          <>
            <span className="hold-title">{card.title}</span>
            <span className="hold-main">{card.main}</span>
            <span className="hold-cat">Category: {card.category}</span>
          </>
        ) : (
          <>
            <span className="hold-q" aria-hidden="true">
              ?
            </span>
            <span className="hold-help">Hold to see your card</span>
          </>
        )}
      </span>
    </button>
  );
}

/** The group checks the caught imposter's spoken guess against the hidden word. */
function RevealWord({ word, category, onJudge }: { word: string; category: string; onJudge: (right: boolean) => void }) {
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <button type="button" className="ask-btn tap imp-start" onClick={() => setShown(true)}>
        They've guessed. Show the word
      </button>
    );
  }
  return (
    <>
      <div className="word-reveal" role="status">
        <span>The word was</span>
        <strong className="display">{word}</strong>
        <span>Category: {category}</span>
      </div>
      <div className="imp-two">
        <button type="button" className="primary tap" onClick={() => onJudge(true)}>
          Guessed right
        </button>
        <button type="button" className="secondary tap dark-outline" onClick={() => onJudge(false)}>
          Guessed wrong
        </button>
      </div>
    </>
  );
}
