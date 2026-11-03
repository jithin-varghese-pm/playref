import { clientIdFrom } from '../../server/client';
import { recordFeedback } from '../../server/feedback';
import { addressKey, readJsonBody } from '../../server/http';
import { D1Store, type D1Like } from '../../server/store';

interface Env {
  DB: D1Database;
  ID_SALT?: string;
}

/** Per person per hour. A real player votes a few times at most. */
const VOTES_PER_HOUR = 30;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const read = await readJsonBody(request);
  if (!read.ok) return Response.json({ ok: false }, { status: read.status });
  const { feedbackKey, question, correct } = read.body;
  if (typeof feedbackKey !== 'string' || feedbackKey.length < 1 || feedbackKey.length > 300 || typeof question !== 'string' || typeof correct !== 'boolean') {
    return Response.json({ ok: false }, { status: 400 });
  }
  try {
    const store = new D1Store(env.DB as unknown as D1Like);
    const id = await clientIdFrom(addressKey(request.headers.get('CF-Connecting-IP') ?? 'unknown'), env.ID_SALT ?? 'playref');
    const now = Date.now();
    if (!(await store.claim(`fb:${id}`, VOTES_PER_HOUR, 3_600_000, now))) return Response.json({ ok: true, counted: false });
    const { counted } = await recordFeedback({ key: feedbackKey, question, correct, clientId: id, now }, store);
    return Response.json({ ok: true, counted });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
};

/** Only POST is supported. Other methods get JSON 405 instead of the app page. */
export const onRequestGet: PagesFunction = async () => Response.json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
