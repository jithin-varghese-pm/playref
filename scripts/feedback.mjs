// Reads bug reports and ideas sent from the in-app form.
//   npm run feedback              new messages
//   npm run feedback -- --all     every message
//   npm run feedback -- --done 3  mark message 3 as handled
// Needs `npx wrangler login` on Jithin's personal Cloudflare account.
import { execSync } from 'node:child_process';

function d1(sql) {
  const out = execSync(`npx wrangler d1 execute playref --remote --json --command "${sql}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out)[0]?.results ?? [];
}

const args = process.argv.slice(2);
const doneAt = args.indexOf('--done');
if (doneAt >= 0) {
  const id = Number.parseInt(args[doneAt + 1], 10);
  if (!Number.isInteger(id) || id < 1) {
    console.error('Usage: npm run feedback -- --done <id>');
    process.exit(1);
  }
  d1(`UPDATE reports SET status = 'done' WHERE id = ${id}`);
  console.log(`Marked message ${id} as handled.`);
  process.exit(0);
}

const all = args.includes('--all');
const rows = d1(`SELECT id, at, type, message, contact, context, page, device, status FROM reports ${all ? '' : "WHERE status = 'new'"} ORDER BY at DESC LIMIT 100`);
const LABEL = { bug: 'BUG', idea: 'IDEA', other: 'OTHER' };

if (!rows.length) {
  console.log(all ? 'No feedback yet.' : 'No new feedback. (Use --all to see handled messages.)');
} else {
  console.log(`${rows.length} ${all ? '' : 'new '}message(s), newest first:\n`);
  for (const r of rows) {
    const when = new Date(r.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    console.log(`#${r.id}  ${LABEL[r.type] ?? r.type}  ${when} IST  (${r.device}, from ${r.page})${r.status === 'done' ? '  [handled]' : ''}`);
    console.log(`    ${r.message.replace(/\n/g, '\n    ')}`);
    if (r.context) console.log(`    About: ${r.context}`);
    if (r.contact) console.log(`    Reply to: ${r.contact}`);
    console.log('');
  }
  if (!all) console.log('Mark one as handled with: npm run feedback -- --done <id>');
}
