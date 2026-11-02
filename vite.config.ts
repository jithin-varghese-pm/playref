import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';
import { askQuestion } from './server/ask';
import { recordFeedback } from './server/feedback';
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

export default defineConfig({
  plugins: [react(), localApi()],
});
