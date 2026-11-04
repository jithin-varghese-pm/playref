# Playref

**An unofficial rules referee for road-trip games.** Game 1: the UNO card game (Classic rules). Game 2: Imposter, a one-phone word game with fair picking and Indian word packs.

Mid-game fight? Tap it, or type it, and get a clear verdict in seconds: **YES**, **NO**, **HOUSE RULE**, **THE RULE** or **NOT SURE**, with what the rules say and how groups often play it.

> Unofficial fan project by MBM. UNO is a trademark of Mattel. Playref is not affiliated with or endorsed by Mattel.

## How an answer is made

Playref treats AI as the last step, not the first.

1. **Known fight (no AI).** The question is cleaned up ("draw two", "plus 2" and "+ 2" all become "+2") and matched against a list of known fights with hand-checked answers.
2. **Saved answer (no AI).** If the same question was answered before under the current rules, that answer is reused.
3. **AI, grounded in the rules.** Only a truly new question reaches the model (`llama-3.3-70b-instruct-fp8-fast` on Cloudflare Workers AI). It gets the whole rules file and must reply in a fixed JSON shape that cites rule cards. The server checks the reply. A made-up verdict or a rule card that does not exist becomes **NOT SURE**, never a guess.

Questions about other UNO versions (No Mercy, Flip...) or other games are caught before any AI call.

## Voice

- **Ask by voice:** tap the mic, speak, tap stop (it stops by itself after 20 seconds). The browser's own recorder makes the clip, so it works in Chrome, Safari, Firefox, Edge, Samsung Internet and Brave. `/api/transcribe` sends it to Whisper (`@cf/openai/whisper-large-v3-turbo`) with a card-name hint and voice-activity filtering, and returns the words. They land in the question box for the player to check; nothing is asked until they tap Ask, so voice goes through exactly the same guardrails as typing. 20 voice questions per person per hour. No audio is stored.
- **Read it out:** a button on every verdict reads the verdict, the ruling and the rules. The phone's own voice comes first (no AI, works offline on most phones). If the browser has no working voice, `/api/speak` reads it with MeloTTS (`@cf/myshell-ai/melotts`), only for short answer text with no links, contact details or abuse.
- **Cost:** Whisper uses about 47 neurons per audio minute, so a 5-second question is about 4 of the 10,000 free daily neurons.

## Guardrails

Five layers, each measured by a red-team test set (22 attacks and look-alikes, scored on the Accuracy page):

1. **Before any AI call:** abuse (including spaced-out and stretched spellings) gets a FOUL! card, greetings get a friendly intro, and other UNO versions or other games are caught. Known fights only match questions that are clearly about a card game.
2. **Safety model:** Cloudflare's Llama Guard 3 checks every question that would reach the main AI. Anything unsafe gets NOT HERE.
3. **Prompt injection:** the player's text is fenced as data, and the model is told to ignore instructions inside it. The model also flags off-topic questions itself (UNO ONLY).
4. **Reply checks:** the model must reply in a fixed JSON shape and cite real rule cards. Its text is checked too: links are removed, and abuse, leaked instructions or markup turn the answer into NOT SURE.
5. **Limits and privacy:** 10 typed questions per person per hour, 300 characters per question, the free daily AI allocation as a hard cap, IP addresses only as one-way hashes, and usage counted as daily totals.

## How accurate is it?

`evals/questions.json` holds 50 tricky questions with known right answers, checked against Mattel's Classic rules sheet. `npm run eval` scores the live app and publishes the result to the in-app Accuracy page, including every miss. A release stops if the score drops. First live run (2 Nov 2026): 48 of 50, with 41 answered without any AI call.

Players can also mark AI answers right or wrong. Three "No" votes remove a saved answer and send it for review.

## Measuring use

Cloudflare Web Analytics counts visitors (no cookies). A small usage counter in D1 keeps daily totals of in-app actions (fight taps, how typed questions were answered, shares, votes), never who did them. `npm run usage` prints the summary. `npm run gaps` lists questions Playref could not answer (AI NOT SURE, other UNO versions, other games), with phone numbers and emails blanked and nothing about the person, so the common ones can become new checked answers. The app tells users this under the Ask button.

People can report a bug or suggest an idea from any screen (and flag a specific answer from the verdict screen). Messages land in D1; `npm run feedback` lists new ones and `npm run feedback -- --done <id>` marks one as handled. A hidden honeypot field and a 5-an-hour limit keep spam out.

## Stack

- React 18 + TypeScript + Vite
- Cloudflare Pages + Pages Functions, Workers AI (free daily allocation), D1
- Vitest (235 tests) and Testing Library

```
rules/            rule cards (source of truth) and known fights
scripts/          compiles rules/ into shared/generated/
shared/           types, question normalizer, fight matcher
server/           ask pipeline, AI prompt and reply checks, storage, feedback
functions/api/    Cloudflare Pages Functions (thin wrappers)
src/              the phone app
evals/            50-question test set and scorer
```

## Run it

```bash
npm install
npm test          # unit and app tests
npm run dev       # app at http://localhost:5173 (typed questions need the Cloudflare server)
npm run build
```

Full local stack with the server (needs a Cloudflare login for Workers AI):

```bash
npx wrangler d1 migrations apply playref --local
npm run preview:cf   # http://localhost:8788
```

## Design

Spec: `docs/superpowers/specs/2026-11-02-playref-v1-design.md`. Build plan: `docs/superpowers/plans/2026-11-02-playref-v1.md`.
