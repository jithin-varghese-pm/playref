import type { AiRunner } from './ask';

/** Cloudflare's safety model. Classifies a message as safe, or unsafe with a category code (S1 to S14). */
export const GUARD_MODEL = '@cf/meta/llama-guard-3-8b';

export type GuardResult = { safe: true } | { safe: false; categories: string[] };

/** Reads Llama Guard's reply, which comes back as text ("safe" / "unsafe\nS10") or as an object. */
export function parseGuard(raw: unknown): GuardResult | null {
  const body = raw && typeof raw === 'object' && 'response' in raw ? (raw as { response: unknown }).response : raw;
  if (body && typeof body === 'object' && 'safe' in body) {
    const b = body as { safe: unknown; categories?: unknown };
    return b.safe === false ? { safe: false, categories: Array.isArray(b.categories) ? b.categories.map(String) : [] } : { safe: true };
  }
  if (typeof body !== 'string') return null;
  const t = body.trim().toLowerCase();
  if (t.startsWith('unsafe')) return { safe: false, categories: (body.match(/S\d+/g) ?? []).map(String) };
  if (t.startsWith('safe')) return { safe: true };
  return null;
}

/**
 * Asks the safety model about a question before the main AI sees it.
 * Returns null when the check could not run (we then rely on the other guardrails),
 * and rethrows the daily-limit error so the app can show "AI off for the day".
 */
export async function checkWithGuard(ai: AiRunner, question: string): Promise<GuardResult | null> {
  try {
    const raw = await ai.run(GUARD_MODEL, { messages: [{ role: 'user', content: question }], max_tokens: 20, temperature: 0 });
    return parseGuard(raw);
  } catch (e) {
    if (/3036|daily free allocation/i.test(String(e instanceof Error ? e.message : e))) throw e;
    return null;
  }
}
