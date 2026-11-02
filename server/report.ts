/** In-app "Report a bug or suggest an idea" form. */

export const REPORT_TYPES = ['bug', 'idea', 'other'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export const REPORTS_PER_HOUR = 5;

export interface ReportInput {
  type: ReportType;
  message: string;
  contact: string | null;
  context: string | null;
  page: string;
  device: 'phone' | 'laptop';
}

export interface ReportRow extends ReportInput {
  at: number;
  clientId: string;
}

export interface ReportStore {
  countReports(clientId: string, since: number): Promise<number>;
  addReport(row: ReportRow): Promise<void>;
}

const PAGES = new Set(['home', 'verdict', 'about', 'accuracy']);

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** Returns the cleaned report, or an error message for the person filling the form. */
export function parseReport(body: Record<string, unknown>): ReportInput | { error: string } {
  // Honeypot: a hidden field people never see. Bots fill it in.
  if (typeof body.website === 'string' && body.website.trim()) return { error: 'spam' };
  const type = body.type as ReportType;
  if (!REPORT_TYPES.includes(type)) return { error: 'Pick bug, idea or other.' };
  const message = clean(body.message, 2000);
  if (!message || message.length < 5) return { error: 'Tell us a little more (at least 5 characters).' };
  return {
    type,
    message,
    contact: clean(body.contact, 200),
    context: clean(body.context, 1000),
    page: typeof body.page === 'string' && PAGES.has(body.page) ? body.page : 'home',
    device: body.device === 'laptop' ? 'laptop' : 'phone',
  };
}

export async function submitReport(
  body: Record<string, unknown>,
  clientId: string,
  now: number,
  store: ReportStore,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseReport(body);
  // Pretend success to bots so they do not retry.
  if ('error' in parsed) return parsed.error === 'spam' ? { ok: true } : { ok: false, error: parsed.error };
  if ((await store.countReports(clientId, now - 3_600_000)) >= REPORTS_PER_HOUR) {
    return { ok: false, error: 'Thanks, we have your messages. Please try again in a little while.' };
  }
  await store.addReport({ ...parsed, at: now, clientId });
  return { ok: true };
}
