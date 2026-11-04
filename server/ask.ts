import { RULES_VERSION } from '../shared/generated/rules-data';
import { hasGameWords, matchFight } from '../shared/match';
import { containsAbuse, removeAbuse } from './abuse';
import { normalize } from '../shared/normalize';
import { fightToAnswer } from '../shared/rules';
import type { Answer, AskResponse } from '../shared/types';
import { checkWithGuard } from './guard';
import { buildAiInput } from './prompt';
import { classifyScope, type Scope } from './scope';
import type { Store } from './store';
import { notSure, validateAiReply } from './validate';
import { hasSavedVoice } from './voice';

export const RATE_LIMIT_PER_HOUR = 10;
export const MAX_QUESTION_LENGTH = 300;
/** Saved-answer keys shorter than this (letters and digits only) are never saved or reused. */
export const MIN_KEY_LENGTH = 4;
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
  /** Run Cloudflare's safety model (Llama Guard) before the main AI. On in production. */
  guard?: boolean;
}

type Blocked = Exclude<Scope, 'in'> | 'unsafe';

/** The fixed cards for blocked questions. Exported so their read-aloud clips can be made in advance. */
export const SCOPE_ANSWERS: Record<Blocked, Omit<Answer, 'question'>> = {
  unsafe: {
    verdict: 'NOT SURE',
    label: 'NOT HERE',
    line: "That's not something I can help with. I only referee card-game rules.",
    rules: 'Ask me about a rule from your game, like "Can I stack +2 on +2?"',
    house: 'None common.',
    cards: [],
    source: 'scope',
  },
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

function scopeAnswer(question: string, kind: Blocked): Answer {
  if (kind === 'abuse' || kind === 'unsafe') {
    // Never repeat swearing or unsafe text back: the card can be shared under the Playref name.
    const cleaned = removeAbuse(question);
    question = cleaned && !containsAbuse(cleaned) && kind === 'abuse' ? cleaned : '(removed)';
  }
  return { question, ...SCOPE_ANSWERS[kind] };
}

function isDailyLimit(e: unknown): boolean {
  return /3036|daily free allocation/i.test(String(e instanceof Error ? e.message : e));
}

function isJsonModeFailure(e: unknown): boolean {
  return /JSON Mode couldn.t be met/i.test(String(e instanceof Error ? e.message : e));
}

export const COOL_DOWN_NOTE = "Easy there 😄 Here's the ruling.";

/**
 * The whole typed-question path. A real game question that comes with swearing is still
 * answered (with the swearing removed and a friendly note); swearing with no game question
 * gets a FOUL! card.
 */
export async function askQuestion(input: AskInput, deps: AskDeps): Promise<AskResponse> {
  const question = input.question.trim();
  if (!question) return { status: 'error', message: 'Type a question first.' };
  if (question.length > MAX_QUESTION_LENGTH) return { status: 'error', message: 'Keep it under 300 characters.' };
  // Emoji, punctuation or invisible characters only: nothing to answer, and no AI spent on it.
  if (!normalize(question)) return { status: 'error', message: 'Type a question first.' };

  if (containsAbuse(question)) {
    const cleaned = removeAbuse(question);
    // The FOUL! card never repeats the swearing back (it could be shared under the Playref name).
    if (!cleaned || !hasGameWords(cleaned)) return { status: 'ok', answer: scopeAnswer(cleaned || '(removed)', 'abuse'), feedbackKey: null };
    const res = await answerQuestion(cleaned, input, deps);
    // The friendly note only goes on real answers, never on blocked or off-topic cards.
    return res.status === 'ok' && !res.answer.label && res.answer.source !== 'scope' ? { ...res, answer: { ...res.answer, note: COOL_DOWN_NOTE } } : res;
  }
  return answerQuestion(question, input, deps);
}

/** Scope, known fight, saved answer, then (within the hourly limit) AI. */
async function answerQuestion(question: string, input: AskInput, deps: AskDeps): Promise<AskResponse> {
  const scope = classifyScope(question);
  if (scope !== 'in') return { status: 'ok', answer: scopeAnswer(question, scope), feedbackKey: null };

  // Step 1: a known fight, no AI.
  const fight = matchFight(question);
  if (fight) return { status: 'ok', answer: fightToAnswer(fight, question), feedbackKey: null };

  // Step 2: a saved answer for the same question under the current rules, no AI.
  // The key keeps letters of every script, so different questions never share an answer.
  // Very short keys (emoji, punctuation, one letter) are never saved or reused.
  const key = normalize(question);
  const cacheable = key.replace(/ /g, '').length >= MIN_KEY_LENGTH;
  if (!input.evalMode && cacheable) {
    try {
      const saved = await deps.store.getSaved(key, RULES_VERSION);
      if (saved) return { status: 'ok', answer: { ...saved, question, source: 'saved' }, feedbackKey: key, voice: await hasSavedVoice(saved, deps.store) };
    } catch {
      // Database trouble: carry on without saved answers.
    }
  }

  // The hourly limit only counts questions that are about to use AI.
  // Known fights, saved answers and blocked messages cost nothing, so they never use it up.
  if (!input.evalMode) {
    let allowed = true;
    try {
      allowed = await deps.store.claim(`ai:${input.clientId}`, RATE_LIMIT_PER_HOUR, HOUR, input.now);
    } catch {
      allowed = false; // If the limit cannot be checked, do not spend AI.
    }
    if (!allowed) return { status: 'rate_limited' };
  }

  // Step 3: the AI, with the whole rules file.
  let answer: Answer;
  try {
    // Safety model first: anything it flags never reaches the main AI.
    if (deps.guard) {
      const verdict = await checkWithGuard(deps.ai, question);
      if (verdict && !verdict.safe) return { status: 'ok', answer: scopeAnswer(question, 'unsafe'), feedbackKey: null };
    }
    const raw = await deps.ai.run(deps.model, buildAiInput(question));
    answer = validateAiReply(raw, question);
  } catch (e) {
    if (isDailyLimit(e)) return { status: 'ai_off' };
    if (isJsonModeFailure(e)) answer = notSure(question);
    else return { status: 'error', message: 'Something went wrong. Try again in a moment.' };
  }

  if (answer.verdict !== 'NOT SURE' && !input.evalMode && cacheable) {
    try {
      await deps.store.saveAnswer(key, RULES_VERSION, answer, input.now);
    } catch {
      // Saving is a bonus; the player still gets the answer.
    }
  }
  return { status: 'ok', answer, feedbackKey: answer.verdict === 'NOT SURE' || !cacheable ? null : key };
}
