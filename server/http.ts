/**
 * Shared request checks for every Playref endpoint.
 * - Only JSON, only from Playref's own pages (other websites cannot post on their visitors' behalf).
 * - Small bodies only, checked before reading.
 * - The body must be a JSON object.
 */
export const MAX_BODY_BYTES = 16 * 1024;

const ALLOWED_ORIGINS = [/^https:\/\/([a-z0-9-]+\.)?playref\.pages\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

export type ReadResult = { ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string };

export async function readJsonBody(request: Request): Promise<ReadResult> {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.some((re) => re.test(origin))) return { ok: false, status: 403, error: 'Not allowed.' };

  const type = request.headers.get('Content-Type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) return { ok: false, status: 415, error: 'Send JSON.' };

  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return { ok: false, status: 413, error: 'Too big.' };

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: 'Bad request.' };
  }
  if (text.length > MAX_BODY_BYTES) return { ok: false, status: 413, error: 'Too big.' };

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: 'Bad request.' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, status: 400, error: 'Bad request.' };
  return { ok: true, body: body as Record<string, unknown> };
}

export type AudioReadResult = { ok: true; audio: Uint8Array } | { ok: false; status: number; error: string };

/**
 * Reads a recorded voice question: raw audio bytes (not JSON), only from Playref's own pages,
 * with an audio Content-Type and a size cap checked before and after reading.
 */
export async function readAudioBody(request: Request, maxBytes: number): Promise<AudioReadResult> {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.some((re) => re.test(origin))) return { ok: false, status: 403, error: 'Not allowed.' };

  const type = (request.headers.get('Content-Type') ?? '').toLowerCase();
  if (!type.startsWith('audio/') && !type.startsWith('video/webm')) return { ok: false, status: 415, error: 'Send audio.' };

  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > maxBytes) return { ok: false, status: 413, error: 'Too big.' };

  let buf: ArrayBuffer;
  try {
    buf = await request.arrayBuffer();
  } catch {
    return { ok: false, status: 400, error: 'Bad request.' };
  }
  if (buf.byteLength > maxBytes) return { ok: false, status: 413, error: 'Too big.' };
  return { ok: true, audio: new Uint8Array(buf) };
}

/**
 * The part of the caller's address used for limits. IPv6 homes get a whole /64 block,
 * so it is grouped by its first four parts; otherwise one home would have endless fresh limits.
 */
export function addressKey(ip: string): string {
  if (!ip.includes(':')) return ip;
  const parts = ip.split(':');
  return parts.slice(0, 4).join(':') + '::/64';
}

/** Removes control characters and invisible direction marks; keeps line breaks when asked. */
export function cleanText(input: string, keepNewlines = false): string {
  const pattern = keepNewlines
    ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g
    : /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g;
  return input.replace(pattern, keepNewlines ? '' : ' ');
}
