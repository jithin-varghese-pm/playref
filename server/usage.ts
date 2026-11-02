import { buttonFights } from '../shared/rules';
import type { AskResponse } from '../shared/types';
import type { Store } from './store';

/**
 * Usage counter: daily totals per action, never who did it.
 * Only the events and keys listed here are accepted, so nobody can write junk.
 */
const ALLOWED: Record<string, Set<string>> = {
  tap: new Set(buttonFights.map((f) => f.id)),
  share: new Set(['shared', 'copied', 'failed']),
  page: new Set(['about', 'accuracy']),
  vote: new Set(['yes', 'no']),
};

export function isAllowedEvent(event: unknown, key: unknown): event is string {
  return typeof event === 'string' && typeof key === 'string' && Boolean(ALLOWED[event]?.has(key));
}

/** Days are counted in India time, where Playref's first users are. */
export function istDay(now: number): string {
  return new Date(now + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/** How a typed question was handled: fight, saved, ai, scope, not_sure, ai_off, rate_limited or error. */
export function askOutcome(r: AskResponse): string {
  if (r.status !== 'ok') return r.status;
  if (r.answer.verdict === 'NOT SURE' && r.answer.source !== 'scope') return 'not_sure';
  return r.answer.source;
}

export async function countEvent(store: Store, event: string, key: string, now: number): Promise<void> {
  await store.bump(istDay(now), event, key);
}
