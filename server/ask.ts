import { RULES_VERSION } from '../shared/generated/rules-data';
import { matchFight } from '../shared/match';
import { normalize } from '../shared/normalize';
import { fightToAnswer } from '../shared/rules';
import type { Answer, AskResponse } from '../shared/types';
import { buildAiInput } from './prompt';
import { classifyScope, type Scope } from './scope';
import type { Store } from './store';
import { notSure, validateAiReply } from './validate';

export const RATE_LIMIT_PER_HOUR = 10;
export const MAX_QUESTION_LENGTH = 300;
const HOUR = 3_600_000;

export interface AiRunner {
  run(model: string, input: unknown): Promise<unknown>;
}

export interface AskInput {
  question: string;
  /** A hashed id for the person asking; never the raw IP address. */
  clientId: string;
  now: number;
  /** The eval runner: no rate limit, no saved answers, so every run measures the real path. */
  evalMode: boolean;
}

export interface AskDeps {
  ai: AiRunner;
  store: Store;
  model: string;
}

const SCOPE_ANSWERS: Record<Exclude<Scope, 'in'>, Omit<Answer, 'question'>> = {
  'other-version': {
    verdict: 'NOT SURE',
    label: 'CLASSIC ONLY',
    line: 'Playref covers Classic UNO only for now.',
    rules: 'Other versions like No Mercy and Flip have their own cards and rules. Check the rules sheet in that box.',
    house: 'None common.',
    cards: [],
    source: 'scope',
  },
  'not-uno': {
    verdict: 'NOT SURE',
    label: 'UNO ONLY',
    line: 'I only referee the UNO card game for now. More road-trip games are coming.',
    rules: 'Ask me anything about Classic UNO.',
    house: 'None common.',
    cards: [],
    source: 'scope',
  },
  abuse: {
    verdict: 'NOT SURE',
    label: 'FOUL!',
    line: "Let's keep it friendly. I only referee card-game rules.",
    rules: 'Ask me about a rule, like "Can I stack +2 on +2?" or "Can I play a +4 when I have the colour?"',
    house: 'None common.',
    cards: [],
    source: 'scope',
  },
  chitchat: {
    verdict: 'NOT SURE',
    label: 'HELLO!',
    line: "Hi! I'm Playref, an unofficial rules referee for UNO, built by Jithin Varghese.",
    rules: 'Describe a rule fight from your game, like "Can I stack +2 on +2?", and I will tell you what the Classic rules say.',
    house: 'None common.',
    cards: [],
    source: 'scope',
  },
};

function scopeAnswer(question: string, kind: Exclude<Scope, 'in'>): Answer {
  return { question, ...SCOPE_ANSWERS[kind] };
}

function isDailyLimit(e: unknown): boolean {
  return /3036|daily free allocation/i.test(String(e instanceof Error ? e.message : e));
}

function isJsonModeFailure(e: unknown): boolean {
  return /JSON Mode couldn.t be met/i.test(String(e instanceof Error ? e.message : e));
}

/** The whole typed-question path: limit, scope, known fight, saved answer, then AI. */
export async function askQuestion(input: AskInput, deps: AskDeps): Promise<AskResponse> {
  const question = input.question.trim();
  if (!question) return { status: 'error', message: 'Type a question first.' };
  if (question.length > MAX_QUESTION_LENGTH) return { status: 'error', message: 'Keep it under 300 characters.' };

  if (!input.evalMode) {
    const recent = await deps.store.countHits(input.clientId, input.now - HOUR);
    if (recent >= RATE_LIMIT_PER_HOUR) return { status: 'rate_limited' };
    await deps.store.addHit(input.clientId, input.now);
  }

  const scope = classifyScope(question);
  if (scope !== 'in') return { status: 'ok', answer: scopeAnswer(question, scope), feedbackKey: null };

  // Step 1: a known fight, no AI.
  const fight = matchFight(question);
  if (fight) return { status: 'ok', answer: fightToAnswer(fight, question), feedbackKey: null };

  // Step 2: a saved answer for the same question under the current rules, no AI.
  const key = normalize(question);
  if (!input.evalMode) {
    const saved = await deps.store.getSaved(key, RULES_VERSION);
    if (saved) return { status: 'ok', answer: { ...saved, question, source: 'saved' }, feedbackKey: key };
  }

  // Step 3: the AI, with the whole rules file.
  let answer: Answer;
  try {
    const raw = await deps.ai.run(deps.model, buildAiInput(question));
    answer = validateAiReply(raw, question);
  } catch (e) {
    if (isDailyLimit(e)) return { status: 'ai_off' };
    if (isJsonModeFailure(e)) answer = notSure(question);
    else return { status: 'error', message: 'Something went wrong. Try again in a moment.' };
  }

  if (answer.verdict !== 'NOT SURE' && !input.evalMode) {
    await deps.store.saveAnswer(key, RULES_VERSION, answer, input.now);
  }
  return { status: 'ok', answer, feedbackKey: answer.verdict === 'NOT SURE' ? null : key };
}
