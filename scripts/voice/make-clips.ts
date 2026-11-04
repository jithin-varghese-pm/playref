/**
 * Makes the Playref-voice (Gemini, Aoede) clips for every fixed answer: the UNO and Imposter
 * fights and the cards for blocked questions. Run with `npm run voice`.
 *
 * - Needs GEMINI_API_KEY (from .dev.vars or the environment). Google's free tier allows 3 a
 *   minute and 10 a day, so it waits 21 seconds between clips and stops when Google says the day's
 *   quota is used up. Run it again the next day; it only makes the clips that are missing.
 * - Clips whose words changed (a fight was edited) get a new name; old ones are deleted.
 * - Writes public/voice/<key>.mp3 and the list in shared/voiceClips.ts. Commit both.
 * - VOICE_DRY=1 only reports what is missing.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { IMPOSTER_FIGHTS } from '../../shared/generated/imposter-data';
import { FIGHTS } from '../../shared/generated/rules-data';
import { fightToAnswer } from '../../shared/rules';
import { spokenText, VOICE_NAME, VOICE_STYLE, voiceKey } from '../../shared/spoken';
import { SCOPE_ANSWERS } from '../../server/ask';
import { GeminiError, geminiSpeech } from '../../server/voice';

const DIR = 'public/voice';
const LIST = 'shared/voiceClips.ts';
const KEEP = new Set(['silence.mp3']);

function apiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const line = existsSync('.dev.vars') ? readFileSync('.dev.vars', 'utf8').split(/\r?\n/).find((l) => l.startsWith('GEMINI_API_KEY=')) : undefined;
  return line?.slice('GEMINI_API_KEY='.length).trim() ?? '';
}

/** Every fixed text, most-used first: home-screen fights, then blocked-question cards, then the rest. */
export function fixedTexts(): { name: string; text: string }[] {
  const all = [
    ...FIGHTS.filter((f) => f.button).map((f) => ({ name: `uno:${f.id}`, text: spokenText(fightToAnswer(f)) })),
    ...IMPOSTER_FIGHTS.filter((f) => f.button).map((f) => ({ name: `imposter:${f.id}`, text: spokenText(fightToAnswer(f)) })),
    ...Object.entries(SCOPE_ANSWERS).map(([k, a]) => ({ name: `card:${k}`, text: spokenText(a) })),
    ...FIGHTS.filter((f) => !f.button).map((f) => ({ name: `uno:${f.id}`, text: spokenText(fightToAnswer(f)) })),
    ...IMPOSTER_FIGHTS.filter((f) => !f.button).map((f) => ({ name: `imposter:${f.id}`, text: spokenText(fightToAnswer(f)) })),
  ];
  const seen = new Set<string>();
  return all.filter((t) => !seen.has(voiceKey(t.text)) && seen.add(voiceKey(t.text)));
}

function toMp3(wav: Uint8Array, out: string) {
  const tmp = mkdtempSync(join(tmpdir(), 'playref-voice-'));
  try {
    writeFileSync(join(tmp, 'in.wav'), wav);
    const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(tmp, 'in.wav'), '-ac', '1', '-b:a', '48k', out]);
    if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.toString() || r.error}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function writeList(keys: string[]) {
  writeFileSync(
    LIST,
    `// WRITTEN by \`npm run voice\` (scripts/voice). Do not edit by hand.\n// Keys of the Playref-voice clips in public/voice/<key>.mp3, one per fixed answer.\nexport const VOICE_CLIPS: string[] = ${JSON.stringify(keys.sort(), null, 2)};\n`,
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

it('makes the missing Playref-voice clips', async () => {
  const texts = fixedTexts();
  const wanted = new Map(texts.map((t) => [voiceKey(t.text), t]));
  const have = () => new Set(readdirSync(DIR).filter((f) => f.endsWith('.mp3') && !KEEP.has(f)).map((f) => f.replace(/\.mp3$/, '')));

  // Clips whose words no longer match any answer.
  for (const k of have()) if (!wanted.has(k)) {
    unlinkSync(join(DIR, `${k}.mp3`));
    console.log(`removed old clip ${k}`);
  }
  const missing = texts.filter((t) => !have().has(voiceKey(t.text)));
  console.log(`Playref voice: ${texts.length - missing.length} of ${texts.length} clips ready, ${missing.length} to make.`);

  if (!process.env.VOICE_DRY && missing.length) {
    const key = apiKey();
    if (!key) throw new Error('Set GEMINI_API_KEY in .dev.vars');
    for (const [i, t] of missing.entries()) {
      if (i > 0) await wait(21_000); // 3 a minute
      try {
        const wav = await geminiSpeech(t.text, key, { style: VOICE_STYLE, voice: VOICE_NAME });
        toMp3(wav, join(DIR, `${voiceKey(t.text)}.mp3`));
        console.log(`made ${t.name}`);
      } catch (e) {
        if (e instanceof GeminiError && e.status === 429) {
          console.log(`Google's free quota is used up (${e.message.slice(0, 80)}...). Run npm run voice again tomorrow.`);
          break;
        }
        console.log(`could not make ${t.name}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  const ready = [...have()].filter((k) => wanted.has(k));
  writeList(ready);
  console.log(`Done: ${ready.length} of ${texts.length} clips ready. Commit public/voice and ${LIST}.`);
});
