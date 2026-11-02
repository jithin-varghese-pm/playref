# Playref

**An unofficial rules referee for road-trip games.** Game 1: the UNO card game (Classic rules).

Mid-game fight? Tap it, or type it, and get a clear verdict in seconds: **YES**, **NO**, **HOUSE RULE**, **THE RULE** or **NOT SURE**, with what the rules say and how groups often play it.

> Unofficial fan project by MBM. UNO is a trademark of Mattel. Playref is not affiliated with or endorsed by Mattel.

## How an answer is made

Playref treats AI as the last step, not the first.

1. **Known fight (no AI).** The question is cleaned up ("draw two", "plus 2" and "+ 2" all become "+2") and matched against a list of known fights with hand-checked answers.
2. **Saved answer (no AI).** If the same question was answered before under the current rules, that answer is reused.
3. **AI, grounded in the rules.** Only a truly new question reaches the model (`llama-3.3-70b-instruct-fp8-fast` on Cloudflare Workers AI). It gets the whole rules file and must reply in a fixed JSON shape that cites rule cards. The server checks the reply. A made-up verdict or a rule card that does not exist becomes **NOT SURE**, never a guess.

Questions about other UNO versions (No Mercy, Flip...) or other games are caught before any AI call.

## How accurate is it?

`evals/questions.json` holds 50 tricky questions with known right answers, checked against Mattel's Classic rules sheet. `npm run eval` scores the live app and publishes the result to the in-app Accuracy page, including every miss. A release stops if the score drops. 42 of the 50 are answered correctly with no AI at all; the other 8 are scored against the live model.

Players can also mark AI answers right or wrong. Three "No" votes remove a saved answer and send it for review.

## Measuring use

Cloudflare Web Analytics counts visitors (no cookies). A small usage counter in D1 keeps daily totals of in-app actions (fight taps, how typed questions were answered, shares, votes), never who did them. `npm run usage` prints the summary.

## Stack

- React 18 + TypeScript + Vite
- Cloudflare Pages + Pages Functions, Workers AI (free daily allocation), D1
- Vitest (64 tests) and Testing Library

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
