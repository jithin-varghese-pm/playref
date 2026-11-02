import { D1Store, type D1Like } from '../../server/store';
import { countEvent, isAllowedEvent } from '../../server/usage';

interface Env {
  DB: D1Database;
}

/** Counts one in-app action (fight tap, share, page, vote). Unknown events are ignored. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // fall through: ignored below
  }
  if (!isAllowedEvent(body.event, body.key)) return new Response(null, { status: 204 });
  await countEvent(new D1Store(env.DB as unknown as D1Like), body.event, body.key as string, Date.now());
  return new Response(null, { status: 204 });
};
