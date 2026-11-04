import { defineConfig } from 'vitest/config';

// Runs the clip maker with the same TypeScript the app uses (npm run voice). Not part of npm test.
export default defineConfig({ test: { include: ['scripts/voice/make-clips.ts'], environment: 'node', testTimeout: 3_600_000 } });
