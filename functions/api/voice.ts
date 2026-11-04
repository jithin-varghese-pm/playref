import { clientIdFrom } from '../../server/client';
import { addressKey, readJsonBody } from '../../server/http';
import { D1Store, type D1Like } from '../../server/store';
import { voiceForSaved } from '../../server/voice';

interface Env {
  DB: D1Database;
  ID_SALT?: string;
  /** Secret: Google AI Studio key (personal account, project "Playref") for the Playref voice. */
  GEMINI_API_KEY?: string;
}

/**
 * The Playref voice for a saved AI answer. Sends the recording when it exists. Otherwise answers
 * 202 at once (the phone's voice reads it this time) and records it in the background for next time.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const read = await readJsonBody(request);
  if (!read.ok) return Response.json({ status: 'error' }, { status: read.status });
  try {
    const store = new D1Store(env.DB as unknown as D1Like);
    const clientId = await clientIdFrom(addressKey(request.headers.get('CF-Connecting-IP') ?? 'unknown'), env.ID_SALT ?? 'playref');
    const result = await voiceForSaved({ key: read.body.key, clientId, now: Date.now(), apiKey: env.GEMINI_API_KEY }, { store });
    if (result.status === 'ok') {
      return new Response(result.audio, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=86400' } });
    }
    if (result.status === 'preparing' && result.make) waitUntil(result.make().catch(() => {}));
    return Response.json({ status: result.status }, { status: result.status === 'unknown' ? 404 : 202 });
  } catch {
    return Response.json({ status: 'error' }, { status: 503 });
  }
};

export const onRequestGet: PagesFunction = async () => Response.json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
