import { RULE_CARDS } from '../shared/generated/rules-data';
import { normalize } from '../shared/normalize';
import { VERDICTS, type Answer, type Verdict } from '../shared/types';

const MAX_TEXT = 400;
const STOP = new Set(
  'a an and are be but by can card cards do does for from have how i if in is it me my of on or so that the their them then there they this to was what when where who why will with you your'.split(' '),
);

function words(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** The rule card whose title and text share the most words with the question, or null. */
export function closestCard(question: string) {
  const q = new Set(words(question));
  let best = null as (typeof RULE_CARDS)[number] | null;
  let bestScore = 0;
  for (const c of RULE_CARDS) {
    const titleWords = words(c.title);
    const bodyWords = new Set(words(c.official));
    let score = 0;
    for (const w of q) {
      if (titleWords.includes(w)) score += 2;
      else if (bodyWords.has(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** The honest fallback when the rules (or the AI) cannot settle a question. */
export function notSure(question: string): Answer {
  const card = closestCard(question);
  return {
    question,
    verdict: 'NOT SURE',
    line: "I can't settle this one from the Classic rules.",
    rules: card ? `Closest rule (${card.title}): ${card.official}` : 'Try one of the common fights, or ask it another way.',
    house: card ? card.house : 'None common.',
    cards: card ? [card.id] : [],
    source: 'ai',
  };
}

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, MAX_TEXT) : null;
}

/**
 * Checks what the AI sent back. Anything malformed, any made-up verdict and any
 * rule card that does not exist becomes NOT SURE. Never trusts the model.
 */
export function validateAiReply(raw: unknown, question: string): Answer {
  let body: unknown = raw && typeof raw === 'object' && 'response' in raw ? (raw as { response: unknown }).response : raw;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return notSure(question);
    }
  }
  if (!body || typeof body !== 'object') return notSure(question);
  const r = body as Record<string, unknown>;

  const verdict = r.verdict as Verdict;
  if (!VERDICTS.includes(verdict)) return notSure(question);
  if (verdict === 'NOT SURE') return notSure(question);

  const line = text(r.line);
  const rules = text(r.rules);
  const house = text(r.house) ?? 'None common.';
  if (!line || !rules) return notSure(question);

  if (!Array.isArray(r.cards) || r.cards.length === 0) return notSure(question);
  const ids = new Set(RULE_CARDS.map((c) => c.id));
  const cards = r.cards.map((c) => String(c).trim().toUpperCase());
  if (!cards.every((c) => ids.has(c))) return notSure(question);

  return { question, verdict, line, rules, house, cards: [...new Set(cards)], source: 'ai' };
}
