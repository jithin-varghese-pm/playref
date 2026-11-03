import { clientIdFrom } from '../../server/client';
import { addressKey, readJsonBody } from '../../server/http';
import { submitReport } from '../../server/report';
import { D1Store, type D1Like } from '../../server/store';

interface Env {
  DB: D1Database;
  ID_SALT?: string;
}

/** Saves a bug report or idea from the in-app form. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const read = await readJsonBody(request);
  if (!read.ok) return Response.json({ ok: false, error: read.error }, { status: read.status });
  try {
    const id = await clientIdFrom(addressKey(request.headers.get('CF-Connecting-IP') ?? 'unknown'), env.ID_SALT ?? 'playref');
    const result = await submitReport(read.body, id, Date.now(), new D1Store(env.DB as unknown as D1Like));
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return Response.json({ ok: false, error: 'Could not save right now. Try again in a moment.' }, { status: 503 });
  }
};

/** Only POST is supported. Other methods get JSON 405 instead of the app page. */
export const onRequestGet: PagesFunction = async () => Response.json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
