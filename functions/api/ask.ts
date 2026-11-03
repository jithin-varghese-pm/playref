import { askQuestion, type AiRunner } from '../../server/ask';
import { clientIdFrom } from '../../server/client';
import { gapOutcome, scrub } from '../../server/gaps';
import { addressKey, readJsonBody } from '../../server/http';
import { D1Store, type D1Like } from '../../server/store';
import { askOutcome, countEvent } from '../../server/usage';
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

/** Per person per hour, for the usage counter and gap log. Answers are never blocked by this. */
const LOG_WRITES_PER_HOUR = 60;

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const read = await readJsonBody(request);
  if (!read.ok) return Response.json({ status: 'error', message: read.error }, { status: read.status });
  const question = typeof read.body.question === 'string' ? read.body.question : '';

  const evalHeader = request.headers.get('x-playref-eval');
  const evalMode = Boolean(env.EVAL_TOKEN) && evalHeader === env.EVAL_TOKEN;

  const ai: AiRunner = {
    // The model name comes from config, so the generated model union type does not apply here.
    run: (model, input) => env.AI.run(model as Parameters<Ai['run']>[0], input as never),
  };

  const store = new D1Store(env.DB as unknown as D1Like);
  const now = Date.now();
  const clientId = await clientIdFrom(addressKey(request.headers.get('CF-Connecting-IP') ?? 'unknown'), env.ID_SALT ?? 'playref');

  let result;
  try {
    result = await askQuestion({ question, clientId, now, evalMode }, { ai, store, model: env.AI_MODEL, guard: true });
  } catch {
    // Should not happen (the pipeline handles its own failures), but never send a crash to the player.
    return Response.json({ status: 'error', message: 'Something went wrong. Try again in a moment.' }, { status: 503 });
  }

  if (!evalMode) {
    waitUntil(
      (async () => {
        // A per-person cap stops scripts from flooding the database through the logs.
        if (!(await store.claim(`log:${clientId}`, LOG_WRITES_PER_HOUR, 3_600_000, now))) return;
        // Usage counter: how typed questions were handled.
        await countEvent(store, 'ask', askOutcome(result), now);
        // Gap finder: keep the text of questions Playref could not answer (scrubbed, nothing about the person).
        // Uses the answer's copy of the question, which already has any swearing removed.
        const gap = gapOutcome(result);
        if (gap && result.status === 'ok') await store.addUnanswered(scrub(result.answer.question), gap, RULES_VERSION, now);
      })().catch(() => {}),
    );
  }
  // Bad input (empty, too long, not text) is a 400; a failure on our side is a 503.
  const status = result.status !== 'error' ? 200 : /went wrong/.test(result.message) ? 503 : 400;
  return Response.json(result, { status, headers: { 'Cache-Control': 'no-store' } });
};

/** Only POST is supported. Other methods get JSON 405 instead of the app page. */
export const onRequestGet: PagesFunction = async () => Response.json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
