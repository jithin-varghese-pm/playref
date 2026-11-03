import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { IMPOSTER_FIGHTS } from '../../../shared/generated/imposter-data';
import {
  cardFor,
  dealRound,
  freshFairness,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SURPRISE,
  updateFairness,
  type Fairness,
  type Round,
} from '../../../shared/imposter/engine';
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
  /** The player who says they are guessing early checks their role privately on the phone. */
  | { name: 'early-check'; player: number; seen: boolean }
  | { name: 'result'; imposterWin: boolean; reason: string };

const STORE = 'playref.imposter.v1';

interface Saved {
  players: number;
  packId: string;
  fairness: Fairness;
  used: string[];
  /** Optional player names, remembered on this phone. Empty means "Player N". */
  names: string[];
}

export const MAX_NAME = 16;

const PACK_IDS = new Set([SURPRISE, ...WORD_PACKS.map((p) => p.id)]);
const isSeat = (n: unknown, players: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < players;

/** Keeps what it can for a new player count: existing waits stay, new seats start at 0. */
export function resizeFairness(f: Fairness, players: number): Fairness {
  return {
    waits: Array.from({ length: players }, (_, i) => (Number.isFinite(f.waits[i]) && f.waits[i] >= 0 ? f.waits[i] : 0)),
    last: f.last.filter((i) => isSeat(i, players)),
  };
}

/** Reads saved settings, checking every field. Anything odd falls back to a fresh value, never a crash. */
export function load(): Saved {
  const fresh: Saved = { players: 5, packId: SURPRISE, fairness: freshFairness(5), used: [], names: [] };
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Record<string, unknown> | null;
    if (!s || typeof s !== 'object') return fresh;
    const players = Number.isInteger(s.players) && (s.players as number) >= MIN_PLAYERS && (s.players as number) <= MAX_PLAYERS ? (s.players as number) : 5;
    const f = s.fairness as Partial<Fairness> | undefined;
    const fairness =
      f && Array.isArray(f.waits) && Array.isArray(f.last)
        ? resizeFairness({ waits: f.waits.map(Number), last: f.last.filter((i) => isSeat(i, players)) }, players)
        : freshFairness(players);
    return {
      players,
      packId: typeof s.packId === 'string' && PACK_IDS.has(s.packId) ? s.packId : SURPRISE,
      fairness,
      used: Array.isArray(s.used) ? s.used.filter((w): w is string => typeof w === 'string').slice(-200) : [],
      names: Array.isArray(s.names) ? s.names.map((n) => (typeof n === 'string' ? n.slice(0, MAX_NAME) : '')) : [],
    };
  } catch {
    // Private mode, blocked storage or broken JSON: start fresh.
    return fresh;
  }
}

/** The round in progress, kept for this tab only, so switching tabs or a refresh does not lose it. */
const ROUND_STORE = 'playref.imposter.round.v1';
interface SavedRound {
  round: Round;
  phase: Phase;
  caught: number[];
}
function loadRound(): SavedRound | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(ROUND_STORE) ?? 'null') as SavedRound | null;
    if (!r || !r.round || !Array.isArray(r.round.imposters) || typeof r.round.word !== 'string' || !r.phase || !Array.isArray(r.caught)) return null;
    if (!Number.isInteger(r.round.players) || r.round.players < MIN_PLAYERS || r.round.players > MAX_PLAYERS) return null;
    // A held card is never restored open; the player taps it again.
    const phase = r.phase.name === 'pass' ? { ...r.phase, seen: false } : r.phase;
    return phase.name === 'fight' || phase.name === 'setup' ? null : { ...r, phase };
  } catch {
    return null;
  }
}
function saveRound(r: SavedRound | null) {
  try {
    if (r) sessionStorage.setItem(ROUND_STORE, JSON.stringify(r));
    else sessionStorage.removeItem(ROUND_STORE);
  } catch {
    // The game still works without it.
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    // Nothing to do: the game still works without saving.
  }
}

export function Imposter() {
  const [saved, setSaved] = useState<Saved>(load);
  const [restored] = useState(loadRound);
  const raw = (i: number) => saved.names[i]?.trim() || `Player ${i + 1}`;
  // Two players with the same name get their seat number, so vote buttons are never ambiguous.
  const name = (i: number) => {
    const n = raw(i);
    const total = round?.players ?? saved.players;
    const dup = Array.from({ length: total }, (_, j) => j).some((j) => j !== i && raw(j).toLowerCase() === n.toLowerCase());
    return dup ? `${n} (${i + 1})` : n;
  };
  const list = (ids: number[]) => ids.map(name).join(' and ');
  const [round, setRound] = useState<Round | null>(restored?.round ?? null);
  const [phase, setPhase] = useState<Phase>(restored?.phase ?? { name: 'setup' });
  const [caught, setCaught] = useState<number[]>(restored?.caught ?? []);
  const [showMore, setShowMore] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => save(saved), [saved]);
  useEffect(() => {
    const inRound = round && phase.name !== 'setup' && phase.name !== 'fight';
    saveRound(inRound ? { round, phase, caught } : null);
  }, [round, phase, caught]);
  useEffect(() => {
    window.scrollTo?.(0, 0);
    setConfirmQuit(false);
    // Move focus to the new screen's heading, so screen readers announce the change.
    const h = document.querySelector<HTMLElement>('main h1');
    if (h && phase.name !== 'setup') {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }, [phase.name]);

  function setPlayers(n: number) {
    const players = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n));
    // Keep fairness when the group grows or shrinks, so last round's imposter is still protected.
    setSaved((s) => ({ ...s, players, fairness: resizeFairness(s.fairness, players) }));
  }

  /** Leaves the round without a result. Shown on every round screen behind a confirm. */
  function quitRound() {
    setRound(null);
    setCaught([]);
    setPhase({ name: 'setup' });
  }
  const quit = (
    <div className="imp-quit">
      {confirmQuit ? (
        <>
          <span>End this round?</span>
          <button type="button" className="more-link dark" onClick={quitRound}>
            Yes, end it
          </button>
          <button type="button" className="more-link dark" onClick={() => setConfirmQuit(false)}>
            No
          </button>
        </>
      ) : (
        <button type="button" className="more-link dark" onClick={() => setConfirmQuit(true)}>
          End round
        </button>
      )}
    </div>
  );

  function start() {
    const r = dealRound(saved.players, saved.packId, saved.fairness, saved.used);
    setSaved((s) => ({ ...s, fairness: updateFairness(s.players, s.fairness, r.imposters), used: [...s.used, r.word].slice(-200) }));
    setRound(r);
    setCaught([]);
    setShareNote('');
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
    const nowCaught = [...caught, player];
    setCaught(nowCaught);
    const left = round.imposters.filter((i) => !nowCaught.includes(i));
    // A wrong early guess counts as a catch (rule I11); the group still has to find any other imposter.
    if (left.length === 0) finish(false, early && round.imposters.length === 1 ? `${name(player)} guessed early and got it wrong.` : 'Every imposter was caught.');
    else setPhase({ name: 'vote', tie: false });
  }

  if (phase.name === 'fight') {
    return <VerdictScreen answer={phase.answer} feedbackKey={null} onBack={() => setPhase({ name: 'setup' })} />;
  }

  if (phase.name === 'setup') {
    const packs = [{ id: SURPRISE, name: 'Surprise me' }, ...WORD_PACKS];
    const pack = packs.find((p) => p.id === saved.packId) ?? packs[0];
    const fights = IMPOSTER_FIGHTS.filter((f) => f.button || showMore);
    return (
      <main className="screen imposter">
        <Brand />
        <GameTabs active="imposter" />
        <section className="imp-card">
          <h1 className="display imp-title">Who's the imposter?</h1>
          <p className="imp-sub">Everyone gets the same secret word, except the imposter. Give one-word clues, then find the faker. Works in the car, even with no signal once you have opened it here.</p>
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
          <fieldset className="imp-names">
            <legend className="imp-label">Names (optional)</legend>
            <div className="name-grid">
              {Array.from({ length: saved.players }, (_, i) => (
                <input
                  key={i}
                  type="text"
                  aria-label={`Name for player ${i + 1}`}
                  placeholder={`Player ${i + 1}`}
                  maxLength={MAX_NAME}
                  value={saved.names[i] ?? ''}
                  autoComplete="off"
                  onChange={(e) =>
                    setSaved((s) => {
                      const names = [...s.names];
                      names[i] = e.target.value;
                      return { ...s, names };
                    })
                  }
                />
              ))}
            </div>
            <p className="imp-hint">Go round the circle in seating order, so "clockwise" works.</p>
          </fieldset>
          <fieldset className="imp-packs">
            <legend className="imp-label">Word pack</legend>
            {packs.map((p) => (
              <button key={p.id} type="button" className={`pack${p.id === pack.id ? ' on' : ''}`} aria-pressed={p.id === pack.id} onClick={() => setSaved((s) => ({ ...s, packId: p.id }))}>
                {p.id === pack.id ? '✓ ' : ''}
                {p.name}
              </button>
            ))}
            <p className="imp-hint">
              {pack.id === SURPRISE ? 'A random pack each round, kept secret, so the imposter has no idea of the category.' : 'Everyone, including the imposter, will know the category.'}
            </p>
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
          <span>Imposter</span>
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
        <HoldCard
          key={`${phase.player}-${phase.peek}`}
          card={cardFor(round, phase.player)}
          onOpenChange={(open) => {
            setCardOpen(open);
            if (open) setPhase((p) => (p.name === 'pass' ? { ...p, seen: true } : p));
          }}
        />
        <button
          type="button"
          className="ask-btn tap imp-next"
          // Locked while the card is held open, so the next player's card can never appear open.
          disabled={!phase.seen || cardOpen}
          onClick={() => {
            if (phase.peek) setPhase({ name: 'talk' });
            else if (last) setPhase({ name: 'talk' });
            else setPhase({ name: 'pass', player: phase.player + 1, seen: false, peek: false });
          }}
        >
          {cardOpen ? 'Let go of the card first' : !phase.seen ? 'Hold the card to see it first' : phase.peek ? 'Hide and give back' : last ? 'Hide. Everyone has seen their card' : <>Hide and pass to <bdi>{name(phase.player + 1)}</bdi></>}
        </button>
        {quit}
      </main>
    );
  }

  if (phase.name === 'early-check') {
    const isImposter = round.imposters.includes(phase.player) && !caught.includes(phase.player);
    // Both cards look the same, and both screens have the same two buttons, so watchers learn nothing.
    const card = isImposter
      ? { title: 'YOU ARE AN IMPOSTER', main: 'Guess now?', note: 'Tap "Guess now", or "Back" to keep bluffing' }
      : { title: 'YOU ARE NOT AN IMPOSTER', main: 'No guess', note: 'Tap either button to go back' };
    return (
      <main className="screen imposter imp-dark">
        <div className="pass-to">
          <span>Only this player looks</span>
          <strong className="display">
            <bdi>{name(phase.player)}</bdi>
          </strong>
        </div>
        <HoldCard key={`early-${phase.player}`} card={card} onOpenChange={(open) => {
          setCardOpen(open);
          if (open) setPhase((p) => (p.name === 'early-check' ? { ...p, seen: true } : p));
        }} />
        <div className="imp-two">
          <button type="button" className="ask-btn tap" disabled={!phase.seen || cardOpen} onClick={() => setPhase(isImposter ? { name: 'guess', player: phase.player, early: true } : { name: 'talk' })}>
            Guess now
          </button>
          <button type="button" className="secondary tap" disabled={cardOpen} onClick={() => setPhase({ name: 'talk' })}>
            Back
          </button>
        </div>
      </main>
    );
  }

  if (phase.name === 'peek-pick' || phase.name === 'early-pick') {
    const early = phase.name === 'early-pick';
    return (
      <main className="screen imposter">
        <section className="imp-card">
          <h1 className="display imp-title">{early ? 'Who is guessing early?' : 'Who forgot their word?'}</h1>
          <p className="imp-sub">
            {early
              ? 'An imposter can stop the game and guess the word once. Right wins, wrong loses (rule I11). Tap your own name, then only you look at the phone.'
              : 'Only that player should look at the phone.'}
          </p>
          <PlayerGrid
            name={name}
            players={round.players}
            disabled={early ? caught : []}
            onPick={(p) => setPhase(early ? { name: 'early-check', player: p, seen: false } : { name: 'pass', player: p, seen: false, peek: true })}
          />
          <button type="button" className="more-link dark" onClick={() => setPhase({ name: 'talk' })}>
            Back
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
          {quit}
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
          <PlayerGrid players={round.players} disabled={caught} onPick={accuse} name={name} />
          {!phase.tie ? (
            <button type="button" className="more-link dark" onClick={() => setPhase({ name: 'vote', tie: true })}>
              It's a tie
            </button>
          ) : (
            <button type="button" className="more-link dark" onClick={() => finish(true, 'The vote was still tied after the tie-break.')}>
              Still tied after the revote
            </button>
          )}
          {!second && (
            <button type="button" className="more-link dark" onClick={() => setPhase({ name: 'talk' })}>
              Back to the clues
            </button>
          )}
          {quit}
        </section>
      </main>
    );
  }

  if (phase.name === 'guess') {
    return (
      <main className="screen imposter">
        <section className="imp-card">
          <span className="imp-kicker">{phase.early ? 'Early guess' : 'Caught!'}</span>
          <h1 className="display imp-title">
            <bdi>{name(phase.player)}</bdi> is an imposter
          </h1>
          <p className="imp-sub">
            <bdi>{name(phase.player)}</bdi>, say your one guess at the word out loud. Everyone else knows the word: was it right? The same thing in another language counts; a broader word does not.
          </p>
          {/* The word is never shown here: with two imposters, the other one is still playing. It shows on the result. */}
          <div className="imp-two">
            <button type="button" className="primary tap" onClick={() => guessed(true, phase.player, phase.early)}>
              Guessed right
            </button>
            <button type="button" className="secondary tap dark-outline" onClick={() => guessed(false, phase.player, phase.early)}>
              Guessed wrong
            </button>
          </div>
        </section>
      </main>
    );
  }

  // Result
  const result = phase as Extract<Phase, { name: 'result' }>;
  const shareText = `Playref Imposter: ${result.imposterWin ? 'the imposter won' : 'the group won'}! ${round.imposters.length > 1 ? 'Imposters' : 'Imposter'}: ${list(round.imposters)}. The word was ${round.word}. ${window.location.origin}/#/imposter`;
  return (
    <main className="screen imposter">
      <div className="card-stage">
        <section className="verdict-card flip" aria-label="Result">
          <div className="verdict-inner" style={{ background: result.imposterWin ? '#1A1A1A' : '#FFD100', color: result.imposterWin ? '#FFD100' : '#1A1A1A' }}>
            <div className="verdict-label">{round.imposters.length > 1 ? 'THE IMPOSTERS WERE' : 'THE IMPOSTER WAS'}</div>
            <div className="verdict-word imp-result-name">{list(round.imposters)}</div>
            <div className="verdict-line">
              The word was <strong>{round.word}</strong> ({round.category}). {result.imposterWin ? 'Imposter wins!' : 'The group wins!'}
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
                if (navigator.share) {
                  await navigator.share({ title: 'Playref Imposter', text: shareText });
                  return;
                }
              } catch (e) {
                // The person closed the share sheet: nothing to say.
                if ((e as Error)?.name === 'AbortError') return;
              }
              try {
                await navigator.clipboard.writeText(shareText);
                setShareNote('Copied. Paste it in your group chat.');
              } catch {
                setShareNote('Could not share. Try a screenshot.');
              }
            }}
          >
            Share result
          </button>
        </div>
        {shareNote && (
          <p className="imp-reason" role="status">
            {shareNote}
          </p>
        )}
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

function PlayerGrid({ players, disabled = [], onPick, name }: { players: number; disabled?: number[]; onPick: (p: number) => void; name: (i: number) => string }) {
  return (
    <div className="player-grid">
      {Array.from({ length: players }, (_, i) => (
        <button key={i} type="button" className="player-btn tap" disabled={disabled.includes(i)} onClick={() => onPick(i)}>
          <bdi>{name(i)}</bdi>
        </button>
      ))}
    </div>
  );
}

/**
 * Rule I4: hold to see, release to hide. Every card has the same size and layout,
 * and there is no sound or vibration, so nothing gives the imposter away.
 * A plain click (screen readers send one) opens it for 3 seconds.
 */
function HoldCard({ card, onOpenChange }: { card: { title: string; main: string; note: string }; onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const held = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const set = (v: boolean) => {
    window.clearTimeout(timer.current);
    setOpen(v);
    onOpenChange(v);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = () => {
    held.current = true;
    set(true);
  };
  const hide = () => {
    held.current = false;
    set(false);
  };
  const keyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) show();
    }
  };
  return (
    <button
      type="button"
      className={`hold-card${open ? ' open' : ''}`}
      aria-label={open ? `${card.title} ${card.main}. ${card.note}.` : 'Hold to see your card'}
      onPointerDown={show}
      onPointerUp={hide}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onClick={(e) => {
        // Pointer users already saw it while holding. A click with no pointer press (screen reader) opens it briefly.
        if (e.detail === 0 && !held.current) {
          set(true);
          timer.current = window.setTimeout(() => set(false), 3000);
        }
      }}
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
            <span className="hold-cat">{card.note}</span>
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
