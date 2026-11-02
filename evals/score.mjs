// Scoring shared by the live eval runner (evals/run.mjs) and the offline test.

/** Returns null when the answer is right, or a short reason when it is wrong. */
export function scoreOne(item, answer) {
  if (!answer) return 'no answer';
  if (!item.verdicts.includes(answer.verdict)) return `verdict ${answer.verdict}`;
  if (item.label && answer.label !== item.label) return `label ${answer.label ?? 'none'}`;
  if (item.cards && !item.cards.some((c) => answer.cards.includes(c))) return `cards ${answer.cards.join(', ') || 'none'}`;
  return null;
}

export function expectedText(item) {
  const v = item.label ?? item.verdicts.join(' or ');
  return item.cards ? `${v} (rule ${item.cards.join('/')})` : v;
}
