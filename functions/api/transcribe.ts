import type { AiRunner } from '../../server/ask';
import { clientIdFrom } from '../../server/client';
import { addressKey, readAudioBody } from '../../server/http';
import { D1Store, type D1Like } from '../../server/store';
import { countEvent } from '../../server/usage';
import { MAX_AUDIO_BYTES, transcribe } from '../../server/voice';

interface Env {
  AI: Ai;
  DB: D1Database;
  ID_SALT?: string;
}

/**
 * Voice question: audio in, text out. The text goes back to the player to check before asking,
 * so a recording never skips the normal guardrails. The audio is not stored anywhere.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const read = await readAudioBody(request, MAX_AUDIO_BYTES);
  if (!read.ok) return Response.json({ status: 'error', message: read.status === 413 ? 'That was too long. Keep it under 20 seconds.' : read.error }, { status: read.status });

  const ai: AiRunner = { run: (model, input) => env.AI.run(model as Parameters<Ai['run']>[0], input as never) };
  const store = new D1Store(env.DB as unknown as D1Like);
  const now = Date.now();
  const clientId = await clientIdFrom(addressKey(request.headers.get('CF-Connecting-IP') ?? 'unknown'), env.ID_SALT ?? 'playref');

  let result;
  try {
    result = await transcribe({ audio: read.audio, clientId, now }, { ai, store });
  } catch {
    result = { status: 'error' as const, message: "Couldn't hear that. Try again, or type it." };
  }
  // Usage counter: how voice questions went (daily totals only, never who or what was said).
  waitUntil(countEvent(store, 'voice', result.status, now).catch(() => {}));
  return Response.json(result, { status: result.status === 'error' ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
};

export const onRequestGet: PagesFunction = async () => Response.json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
