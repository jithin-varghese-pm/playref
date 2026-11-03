import { askQuestion, type AiRunner } from '../../server/ask';
import { clientIdFrom } from '../../server/client';
import { D1Store, type D1Like } from '../../server/store';
import { askOutcome, countEvent } from '../../server/usage';
import { gapOutcome, scrub } from '../../server/gaps';
import { RULES_VERSION } from '../../shared/generated/rules-data';

interface Env {
  AI: Ai;
  DB: D1Database;
  AI_MODEL: string;
  /** Secret: lets the eval runner skip the rate limit and saved answers. */
  EVAL_TOKEN?: string;
  /** Secret: salt for hashing IP addresses. */
  ID_SALT?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  let question = '';
  try {
    const body = (await request.json()) as { question?: unknown };
    if (typeof body.question === 'string') question = body.question;
  } catch {
    return Response.json({ status: 'error', message: 'Bad request.' }, { status: 400 });
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const evalHeader = request.headers.get('x-playref-eval');
  const evalMode = Boolean(env.EVAL_TOKEN) && evalHeader === env.EVAL_TOKEN;

  const ai: AiRunner = {
    // The model name comes from config, so the generated model union type does not apply here.
    run: (model, input) => env.AI.run(model as Parameters<Ai['run']>[0], input as never),
  };

  const store = new D1Store(env.DB as unknown as D1Like);
  const now = Date.now();
  const result = await askQuestion(
    { question, clientId: await clientIdFrom(ip, env.ID_SALT ?? 'playref'), now, evalMode },
    { ai, store, model: env.AI_MODEL, guard: true },
  );
  // Usage counter: how typed questions were handled. Test runs are not counted.
  if (!evalMode) waitUntil(countEvent(store, 'ask', askOutcome(result), now).catch(() => {}));
  // Gap finder: keep the text of questions Playref could not answer (scrubbed, nothing about the person).
  const gap = gapOutcome(result);
  // Uses the answer's copy of the question, which already has any swearing removed.
  if (!evalMode && gap && result.status === 'ok') waitUntil(store.addUnanswered(scrub(result.answer.question), gap, RULES_VERSION, now).catch(() => {}));
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
};
