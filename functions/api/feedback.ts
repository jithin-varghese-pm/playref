import { clientIdFrom } from '../../server/client';
import { recordFeedback } from '../../server/feedback';
import { D1Store, type D1Like } from '../../server/store';
import { VERDICTS, type Answer } from '../../shared/types';

interface Env {
  DB: D1Database;
  ID_SALT?: string;
}

function isAnswer(a: unknown): a is Answer {
  if (!a || typeof a !== 'object') return false;
  const r = a as Record<string, unknown>;
  return VERDICTS.includes(r.verdict as Answer['verdict']) && typeof r.line === 'string' && Array.isArray(r.cards);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const { feedbackKey, question, answer, correct } = body;
  if (typeof feedbackKey !== 'string' || feedbackKey.length > 300 || typeof question !== 'string' || typeof correct !== 'boolean' || !isAnswer(answer)) {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (JSON.stringify(answer).length > 4000) return Response.json({ ok: false }, { status: 413 });

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { counted } = await recordFeedback(
    { key: feedbackKey, question, answer, correct, clientId: await clientIdFrom(ip, env.ID_SALT ?? 'playref'), now: Date.now() },
    new D1Store(env.DB as unknown as D1Like),
  );
  return Response.json({ ok: true, counted });
};
