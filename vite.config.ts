import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { askQuestion } from './server/ask';
import { recordFeedback } from './server/feedback';
import { submitReport } from './server/report';
import { MemoryStore } from './server/store';

const LOCAL_AI_MESSAGE =
  "Local mode: the AI isn't connected yet, so new questions can't be answered here. Known fights work. New questions will work once Playref is on Cloudflare.";

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * `npm run dev` only: serves /api/ask and /api/feedback from the same server
 * code Cloudflare runs, with in-memory storage and no AI. Never part of the build.
 */
function localApi(): Plugin {
  const store = new MemoryStore();
  const ai = { run: async () => { throw new Error('LOCAL_NO_AI'); } };
  return {
    name: 'playref-local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/ask', async (req, res) => {
        const body = await readJson(req);
        const question = typeof body.question === 'string' ? body.question : '';
        let result = await askQuestion({ question, clientId: 'local', now: Date.now(), evalMode: false }, { ai, store, model: 'local' });
        if (result.status === 'error' && result.message.startsWith('Something went wrong')) result = { status: 'error', message: LOCAL_AI_MESSAGE };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      });
      // Voice needs Workers AI, which the local server does not have.
      server.middlewares.use('/api/transcribe', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: 'Local mode: voice needs Cloudflare. Run npm run preview:cf to try it.' }));
      });
      server.middlewares.use('/api/speak', (_req, res) => {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end('{"status":"error"}');
      });
      // Usage counter is a no-op locally, so local testing never pollutes the real numbers.
      server.middlewares.use('/api/event', (_req, res) => {
        res.statusCode = 204;
        res.end();
      });
      // Feedback form: kept in memory and printed in the dev terminal, never sent to the real database.
      server.middlewares.use('/api/report', async (req, res) => {
        const result = await submitReport(await readJson(req), 'local', Date.now(), store);
        if (result.ok) console.log('[playref] feedback received locally:', store.reports.at(-1));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      });
      server.middlewares.use('/api/feedback', async (req, res) => {
        const b = await readJson(req);
        if (typeof b.feedbackKey === 'string' && typeof b.correct === 'boolean' && b.answer) {
          await recordFeedback({ key: b.feedbackKey, question: String(b.question ?? ''), answer: b.answer as never, correct: b.correct, clientId: 'local', now: Date.now() }, store);
        }
        res.setHeader('Content-Type', 'application/json');
        res.end('{"ok":true}');
      });
    },
  };
}

/** Files from public/ the offline worker saves on the first visit, next to the built code and styles. */
const OFFLINE_PUBLIC = ['/', '/favicon.svg', '/mbm-logo.png', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/fonts/inter-latin.woff2', '/fonts/barlow-condensed-800-italic-latin.woff2'];

/** Build only: writes sw.js with the exact files of this build, so the app opens with no signal. */
function offlineWorker(): Plugin {
  return {
    name: 'playref-offline-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => /\.(js|css|woff2?|png|svg)$/.test(f)).map((f) => '/' + f);
      const files = [...OFFLINE_PUBLIC, ...built.sort()];
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12);
      const source = readFileSync('scripts/sw.template.js', 'utf8').replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi(), offlineWorker()],
});
