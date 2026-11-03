import type { Answer } from '../shared/types';
import type { GapStore } from './gaps';
import type { ReportRow, ReportStore } from './report';

export interface FeedbackRow {
  key: string;
  version: string;
  clientId: string;
  question: string;
  answer: Answer;
  correct: boolean;
  at: number;
}

/** Everything the server keeps. D1 in production, memory in tests. */
export interface Store {
  countHits(clientId: string, since: number): Promise<number>;
  addHit(clientId: string, at: number): Promise<void>;
  getSaved(key: string, version: string): Promise<Answer | null>;
  saveAnswer(key: string, version: string, answer: Answer, at: number): Promise<void>;
  /** Returns false when this person already voted on this answer. */
  addFeedback(row: FeedbackRow): Promise<boolean>;
  /** Adds one "No" to a saved answer and returns the new count (0 if not saved). */
  addNo(key: string, version: string): Promise<number>;
  deleteSaved(key: string, version: string): Promise<void>;
  /** Adds one to the daily total for an action (usage counter). */
  bump(day: string, event: string, key: string): Promise<void>;
}

export class MemoryStore implements Store, ReportStore, GapStore {
  unanswered: { question: string; outcome: string }[] = [];
  async addUnanswered(question: string, outcome: string) {
    this.unanswered.push({ question, outcome });
  }
  reports: ReportRow[] = [];
  async countReports(clientId: string, since: number) {
    return this.reports.filter((r) => r.clientId === clientId && r.at > since).length;
  }
  async addReport(row: ReportRow) {
    this.reports.push(row);
  }

  hits: { clientId: string; at: number }[] = [];
  saved = new Map<string, { answer: Answer; no: number }>();
  feedback: FeedbackRow[] = [];

  async countHits(clientId: string, since: number) {
    return this.hits.filter((h) => h.clientId === clientId && h.at > since).length;
  }
  async addHit(clientId: string, at: number) {
    this.hits.push({ clientId, at });
  }
  async getSaved(key: string, version: string) {
    return this.saved.get(`${version}|${key}`)?.answer ?? null;
  }
  async saveAnswer(key: string, version: string, answer: Answer, _at: number) {
    this.saved.set(`${version}|${key}`, { answer, no: 0 });
  }
  async addFeedback(row: FeedbackRow) {
    const dup = this.feedback.some((f) => f.key === row.key && f.version === row.version && f.clientId === row.clientId);
    if (dup) return false;
    this.feedback.push(row);
    return true;
  }
  async addNo(key: string, version: string) {
    const s = this.saved.get(`${version}|${key}`);
    if (!s) return 0;
    s.no += 1;
    return s.no;
  }
  async deleteSaved(key: string, version: string) {
    this.saved.delete(`${version}|${key}`);
  }
  counts = new Map<string, number>();
  async bump(day: string, event: string, key: string) {
    const k = `${day}|${event}|${key}`;
    this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
  }
}

/** The small part of Cloudflare's D1 API this app uses. */
export interface D1Like {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<{ meta?: { changes?: number } }>;
    };
  };
}

export class D1Store implements Store, ReportStore, GapStore {
  constructor(private db: D1Like) {}

  async addUnanswered(question: string, outcome: string, version: string, at: number) {
    await this.db.prepare('INSERT INTO unanswered (at, question, outcome, rules_version) VALUES (?, ?, ?, ?)').bind(at, question, outcome, version).run();
  }

  async countReports(clientId: string, since: number) {
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM reports WHERE client_id = ? AND at > ?').bind(clientId, since).first<{ n: number }>();
    return row?.n ?? 0;
  }
  async addReport(r: ReportRow) {
    await this.db
      .prepare('INSERT INTO reports (at, type, message, contact, context, page, device, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(r.at, r.type, r.message, r.contact, r.context, r.page, r.device, r.clientId)
      .run();
  }

  async countHits(clientId: string, since: number) {
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM rate_hits WHERE client_id = ? AND at > ?').bind(clientId, since).first<{ n: number }>();
    return row?.n ?? 0;
  }
  async addHit(clientId: string, at: number) {
    await this.db.prepare('INSERT INTO rate_hits (client_id, at) VALUES (?, ?)').bind(clientId, at).run();
    // Keep the table small: hits older than two hours are never needed.
    await this.db.prepare('DELETE FROM rate_hits WHERE at < ?').bind(at - 2 * 3_600_000).run();
  }
  async getSaved(key: string, version: string) {
    const row = await this.db
      .prepare('SELECT answer_json FROM saved_answers WHERE q_key = ? AND rules_version = ?')
      .bind(key, version)
      .first<{ answer_json: string }>();
    return row ? (JSON.parse(row.answer_json) as Answer) : null;
  }
  async saveAnswer(key: string, version: string, answer: Answer, at: number) {
    await this.db
      .prepare('INSERT OR REPLACE INTO saved_answers (q_key, rules_version, answer_json, no_count, created_at) VALUES (?, ?, ?, 0, ?)')
      .bind(key, version, JSON.stringify(answer), at)
      .run();
  }
  async addFeedback(row: FeedbackRow) {
    const res = await this.db
      .prepare(
        'INSERT OR IGNORE INTO feedback (q_key, rules_version, client_id, question, answer_json, correct, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(row.key, row.version, row.clientId, row.question, JSON.stringify(row.answer), row.correct ? 1 : 0, row.at)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }
  async addNo(key: string, version: string) {
    await this.db.prepare('UPDATE saved_answers SET no_count = no_count + 1 WHERE q_key = ? AND rules_version = ?').bind(key, version).run();
    const row = await this.db
      .prepare('SELECT no_count FROM saved_answers WHERE q_key = ? AND rules_version = ?')
      .bind(key, version)
      .first<{ no_count: number }>();
    return row?.no_count ?? 0;
  }
  async deleteSaved(key: string, version: string) {
    await this.db.prepare('DELETE FROM saved_answers WHERE q_key = ? AND rules_version = ?').bind(key, version).run();
  }
  async bump(day: string, event: string, key: string) {
    await this.db
      .prepare('INSERT INTO daily_counts (day, event, key, n) VALUES (?, ?, ?, 1) ON CONFLICT (day, event, key) DO UPDATE SET n = n + 1')
      .bind(day, event, key)
      .run();
  }
}
