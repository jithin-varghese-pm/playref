import { askQuestion, type AiRunner } from '../../server/ask';
import { clientIdFrom } from '../../server/client';
import { D1Store, type D1Like } from '../../server/store';

interface Env {
  AI: Ai;
  DB: D1Database;
  AI_MODEL: string;
  /** Secret: lets the eval runner skip the rate limit and saved answers. */
  EVAL_TOKEN?: string;
  /** Secret: salt for hashing IP addresses. */
  ID_SALT?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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

  const result = await askQuestion(
    { question, clientId: await clientIdFrom(ip, env.ID_SALT ?? 'playref'), now: Date.now(), evalMode },
    { ai, store: new D1Store(env.DB as unknown as D1Like), model: env.AI_MODEL },
  );
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
};
