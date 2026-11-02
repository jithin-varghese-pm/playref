// Playref eval runner. Sends the 50 test questions to a running Playref
// (local `npm run preview:cf` or the live site) and scores the answers.
//
//   EVAL_BASE_URL=https://playref.pages.dev EVAL_TOKEN=... npm run eval
//
// Always writes evals/last-run.json. Updates public/accuracy.json (what the
// Accuracy page shows) only when the score is not lower than the last
// published one; a lower score exits with code 1 so a release can stop.
// Pass --force to publish a lower score on purpose.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedText, scoreOne } from './score.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.EVAL_BASE_URL ?? 'http://localhost:8788';
const token = process.env.EVAL_TOKEN ?? '';
const force = process.argv.includes('--force');
const { questions } = JSON.parse(readFileSync(join(root, 'evals/questions.json'), 'utf8'));
const generated = readFileSync(join(root, 'shared/generated/rules-data.ts'), 'utf8');
const rulesVersion = /RULES_VERSION = "([0-9a-f]+)"/.exec(generated)?.[1] ?? 'unknown';
const model = /AI_MODEL = "([^"]+)"/.exec(readFileSync(join(root, 'wrangler.toml'), 'utf8'))?.[1] ?? 'unknown';

if (!token) console.warn('Warning: EVAL_TOKEN is not set, so the rate limit will stop the run after 10 questions.');

/** Retries network errors (some networks reset connections to pages.dev at random). */
async function askWithRetry(question, tries = 6) {
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(`${base}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-playref-eval': token },
        body: JSON.stringify({ question }),
      });
      return await r.json();
    } catch (e) {
      if (t >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * t));
    }
  }
}

const misses = [];
let correct = 0;
for (const [i, item] of questions.entries()) {
  const res = await askWithRetry(item.q);

  if (res.status === 'ai_off') {
    console.error(`Stopped at question ${i + 1}: the free daily AI is used up. Try again after 00:00 UTC.`);
    process.exit(2);
  }
  const answer = res.status === 'ok' ? res.answer : null;
  const reason = answer ? scoreOne(item, answer) : `status ${res.status}`;
  if (reason) {
    misses.push({ question: item.q, expected: expectedText(item), got: answer ? `${answer.label ?? answer.verdict} (${reason})` : reason });
  } else correct++;
  console.log(`${reason ? 'MISS' : 'ok  '} ${String(i + 1).padStart(2)} [${answer?.source ?? '-'}] ${item.q}${reason ? `  -> ${reason}` : ''}`);
}

const report = { ranAt: new Date().toISOString(), model, rulesVersion, total: questions.length, correct, misses };
writeFileSync(join(root, 'evals/last-run.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`\nScore: ${correct} of ${questions.length}`);

const publishedPath = join(root, 'public/accuracy.json');
const previous = existsSync(publishedPath) ? JSON.parse(readFileSync(publishedPath, 'utf8')) : null;
if (previous && previous.total === report.total && correct < previous.correct && !force) {
  console.error(`Score dropped from ${previous.correct} to ${correct}. Not publishing. Fix the misses, or pass --force.`);
  process.exit(1);
}
writeFileSync(publishedPath, JSON.stringify(report, null, 2) + '\n');
console.log('Published to public/accuracy.json');
