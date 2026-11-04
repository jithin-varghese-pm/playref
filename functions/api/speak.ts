import type { AiRunner } from '../../server/ask';
import { clientIdFrom } from '../../server/client';
import { addressKey, readJsonBody } from '../../server/http';
import { D1Store, type D1Like } from '../../server/store';
import { speak } from '../../server/voice';

interface Env {
  AI: Ai;
  DB: D1Database;
  ID_SALT?: string;
}

const STATUS = { refused: 400, rate_limited: 429, ai_off: 503, error: 503 } as const;

/** Read-aloud fallback for browsers with no voice of their own. Answer text in, audio out. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const read = await readJsonBody(request);
  if (!read.ok) return Response.json({ status: 'error' }, { status: read.status });

  const ai: AiRunner = { run: (model, input) => env.AI.run(model as Parameters<Ai['run']>[0], input as never) };
  const store = new D1Store(env.DB as unknown as D1Like);
  const clientId = await clientIdFrom(addressKey(request.headers.get('CF-Connecting-IP') ?? 'unknown'), env.ID_SALT ?? 'playref');

  let result;
  try {
    result = await speak({ text: read.body.text, clientId, now: Date.now() }, { ai, store });
  } catch {
    result = { status: 'error' as const };
  }
  if (result.status !== 'ok') return Response.json({ status: result.status }, { status: STATUS[result.status] });
  return new Response(result.audio, { headers: { 'Content-Type': result.type, 'Cache-Control': 'no-store' } });
};

export const onRequestGet: PagesFunction = async () => Response.json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
