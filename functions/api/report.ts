import { clientIdFrom } from '../../server/client';
import { submitReport } from '../../server/report';
import { D1Store, type D1Like } from '../../server/store';

interface Env {
  DB: D1Database;
  ID_SALT?: string;
}

/** Saves a bug report or idea from the in-app form. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const result = await submitReport(body, await clientIdFrom(ip, env.ID_SALT ?? 'playref'), Date.now(), new D1Store(env.DB as unknown as D1Like));
  return Response.json(result, { status: result.ok ? 200 : 400 });
};
