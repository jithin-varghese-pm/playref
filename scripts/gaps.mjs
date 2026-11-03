// Lists questions Playref could not answer, grouped, most asked first.
//   npm run gaps            last 14 days
//   npm run gaps -- 30      last 30 days
// Turn the common ones into new known fights in rules/uno-classic-fights.json.
import { execSync } from 'node:child_process';

const days = Math.max(1, Number(process.argv[2]) || 14);
const since = Date.now() - days * 86_400_000;
const sql = `SELECT question, outcome, at FROM unanswered WHERE at >= ${since} ORDER BY at DESC LIMIT 500`;
const out = execSync(`npx wrangler d1 execute playref --remote --json --command "${sql}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const rows = JSON.parse(out)[0]?.results ?? [];

const LABEL = { not_sure: 'AI was NOT SURE', classic_only: 'Other UNO version', uno_only: 'Not UNO (other game or topic)' };
const key = (q) => q.toLowerCase().replace(/[^a-z0-9+ ]+/g, ' ').replace(/\s+/g, ' ').trim();

console.log(`Questions Playref could not answer, last ${days} day(s): ${rows.length}\n`);
for (const outcome of ['not_sure', 'classic_only', 'uno_only']) {
  const groups = new Map();
  for (const r of rows.filter((r) => r.outcome === outcome)) {
    const k = key(r.question);
    const g = groups.get(k) ?? { text: r.question, n: 0 };
    g.n += 1;
    groups.set(k, g);
  }
  if (!groups.size) continue;
  console.log(`${LABEL[outcome]} (${[...groups.values()].reduce((a, g) => a + g.n, 0)})`);
  for (const g of [...groups.values()].sort((a, b) => b.n - a.n)) console.log(`  ${String(g.n).padStart(3)}x  ${g.text}`);
  console.log('');
}
if (!rows.length) console.log('Nothing yet. Questions are kept from 3 Nov 2026 onward.');
