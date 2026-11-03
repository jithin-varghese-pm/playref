import { clientIdFrom } from '../../server/client';
import { addressKey, readJsonBody } from '../../server/http';
import { D1Store, type D1Like } from '../../server/store';
import { countEvent, isAllowedEvent } from '../../server/usage';

interface Env {
  DB: D1Database;
  ID_SALT?: string;
}

/** Per person per hour. Normal play is far below this; it only stops scripts flooding the database. */
const EVENTS_PER_HOUR = 200;

/** Counts one in-app action (fight tap, share, page, vote, game). Unknown events are ignored. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const read = await readJsonBody(request);
  if (!read.ok) return new Response(null, { status: read.status });
  const { event, key } = read.body;
  if (!isAllowedEvent(event, key)) return new Response(null, { status: 204 });
  try {
    const store = new D1Store(env.DB as unknown as D1Like);
    const id = await clientIdFrom(addressKey(request.headers.get('CF-Connecting-IP') ?? 'unknown'), env.ID_SALT ?? 'playref');
    const now = Date.now();
    if (await store.claim(`ev:${id}`, EVENTS_PER_HOUR, 3_600_000, now)) await countEvent(store, event, key as string, now);
  } catch {
    // Counting is best effort.
  }
  return new Response(null, { status: 204 });
};

/** Only POST is supported. Other methods get JSON 405 instead of the app page. */
export const onRequestGet: PagesFunction = async () => Response.json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
