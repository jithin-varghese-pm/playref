// Prints Playref's usage summary from the live database.
//   npm run usage            last 7 days
//   npm run usage -- 30      last 30 days
// Needs `npx wrangler login` on Jithin's personal Cloudflare account.
import { execSync } from 'node:child_process';

const days = Math.max(1, Number(process.argv[2]) || 7);
const since = new Date(Date.now() + 5.5 * 3_600_000 - (days - 1) * 86_400_000).toISOString().slice(0, 10);
const sql = `SELECT day, event, key, n FROM daily_counts WHERE day >= '${since}' ORDER BY day`;
const out = execSync(`npx wrangler d1 execute playref --remote --json --command "${sql}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const rows = JSON.parse(out)[0]?.results ?? [];

const ASK_LABELS = {
  fight: 'matched a known fight (no AI)',
  saved: 'reused a saved answer (no AI)',
  ai: 'answered by AI',
  not_sure: 'AI said NOT SURE',
  scope: 'other version or other game',
  ai_off: 'hit "AI off for the day"',
  rate_limited: 'hit the 10-an-hour limit',
  error: 'error',
};

const byDay = new Map();
for (const r of rows) {
  if (!byDay.has(r.day)) byDay.set(r.day, []);
  byDay.get(r.day).push(r);
}

const sum = (list, event) => list.filter((r) => r.event === event).reduce((a, r) => a + r.n, 0);

function report(title, list) {
  console.log(`\n${title}`);
  const taps = sum(list, 'tap');
  const asks = sum(list, 'ask');
  const noAi = list.filter((r) => r.event === 'ask' && ['fight', 'saved', 'scope'].includes(r.key)).reduce((a, r) => a + r.n, 0);
  console.log(`  Fight button taps: ${taps}`);
  for (const r of list.filter((r) => r.event === 'tap').sort((a, b) => b.n - a.n)) console.log(`    ${String(r.n).padStart(4)}  ${r.key}`);
  console.log(`  Typed questions: ${asks}${asks ? ` (${Math.round((noAi / asks) * 100)}% answered without AI)` : ''}`);
  for (const r of list.filter((r) => r.event === 'ask').sort((a, b) => b.n - a.n)) console.log(`    ${String(r.n).padStart(4)}  ${ASK_LABELS[r.key] ?? r.key}`);
  console.log(`  Shares: ${sum(list, 'share')}   Votes: ${list.filter((r) => r.event === 'vote' && r.key === 'yes').reduce((a, r) => a + r.n, 0)} right / ${list.filter((r) => r.event === 'vote' && r.key === 'no').reduce((a, r) => a + r.n, 0)} wrong`);
  console.log(`  Opened About: ${list.filter((r) => r.event === 'page' && r.key === 'about').reduce((a, r) => a + r.n, 0)}   Opened Accuracy: ${list.filter((r) => r.event === 'page' && r.key === 'accuracy').reduce((a, r) => a + r.n, 0)}`);
}

console.log(`Playref usage, last ${days} day(s), India dates from ${since}. Visitor numbers are in Cloudflare Web Analytics.`);
if (!rows.length) console.log('\nNo usage recorded yet.');
else {
  for (const [day, list] of byDay) report(day, list);
  if (byDay.size > 1) {
    // Add up the same action across days, so the total lists each one once.
    const merged = new Map();
    for (const r of rows) {
      const k = `${r.event}|${r.key}`;
      merged.set(k, { event: r.event, key: r.key, n: (merged.get(k)?.n ?? 0) + r.n });
    }
    report(`TOTAL (${byDay.size} days)`, [...merged.values()]);
  }
}
