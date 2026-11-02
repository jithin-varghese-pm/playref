# Playref v1: Design

| | |
|---|---|
| Date | 2 Nov 2026 |
| Owner | Jithin Varghese |
| Status | Design approved in chat, waiting for review of this document |
| Mockups | https://claude.ai/artifact/DQe1CEy3G8B1EE8uvH6acz (Option A, board A3 is the motion prototype) |
| Notes and research | `PROJECT-NOTES.md` |

## 1. Outcome

Playref is an unofficial rules referee for games people play on road trips and camping trips. Version 1 covers one game: Classic UNO.

A group in the middle of a fight opens Playref on a phone, taps the fight (or types it), and gets a clear verdict in a few seconds: **YES**, **NO**, **HOUSE RULE** or **NOT SURE**, with the reason and what the official rules say.

It is a free fan project, made to show both AI product skills (answers tied to a rulebook, a public accuracy score) and build skills (a polished, live app).

**Version 1 is done when:**

1. The 6 fight buttons give checked answers.
2. Typed questions get AI verdicts, including "NOT SURE", "Classic only for now" and "I only referee UNO for now".
3. Verdict screens have "Share verdict" and "Was this answer right? Yes / No".
4. The "AI off for the day" state works.
5. The Accuracy page shows the live score from the 50-question test set.
6. It is live at playref.pages.dev.

**Out of scope for version 1:** other UNO versions (No Mercy, Flip and others), other games, accounts or logins, ads, paid features, native phone apps.

## 2. Rules

1. **Fan project rules.** The name and web address never contain "UNO". No UNO logo, card art or photos of real cards. Never say "official". Every page carries the footer: "Unofficial fan project. UNO is a trademark of Mattel. Not affiliated with or endorsed by Mattel." No ads, no paid features.
2. **No copied rulebook text.** Rules are written in our own words. Short quotes only when needed, with a link to Mattel's rules sheet.
3. **One source of truth.** Button answers and AI answers both come from the same rules file. They must never disagree.
4. **Honest over confident.** When the AI cannot back its answer with a real rule card, the user sees NOT SURE, not a guess.
5. **Free stays free.** No paid plan, no card on file. When a free limit is reached, the feature rests until the next day.
5a. **AI is the last step, not the first.** A typed question reaches the AI only when it matches no known fight and has no saved answer. Mattel's rules sheet may be downloaded and kept locally as a private reference for checking rule cards, but its text is never shipped in the app.
6. **Colours.** MBM black, yellow and cream (since 2 Nov 2026). No UNO colour scheme.
7. **Personal identity.** The repo lives on the personal GitHub account `jithin-varghese-pm`, with the personal git name and email set for this repo only. Never the work account.

## 3. Interface

Phone first. Look: Option A "Red table", with motion. Screens, in the order a user meets them:

1. **Home**
   - "Playref", with "by MBM" under it, and "Unofficial rules referee".
   - Game card: "UNO card game. Classic rules. More road-trip games soon."
   - "What's the fight?" with 6 buttons:
     1. Can I stack +2 on +2?
     2. Do I keep drawing until I can play?
     3. Can I play +4 when I have the colour?
     4. Can I finish on a power card?
     5. Someone forgot to say UNO. Now what?
     6. Is swapping hands on a 7 a real rule?
   - "Or type your own" text box with an Ask button.
   - Footer disclaimer.
2. **Thinking** (typed questions only): three cards shuffle, with "Checking the rules...".
3. **Verdict**
   - The question.
   - The verdict card flips in: verdict word, one line of reason.
   - Typed answers only: an "AI answer from the Classic rules" tag.
   - "What the rules say", in our own words, with a link to Mattel's rules sheet.
   - "Playing house rules?": how groups usually play it.
   - Typed answers only: "Was this answer right? Yes / No".
   - "Share verdict" (opens the phone's share sheet, with a short text and a link) and "Ask another".
4. **AI off for the day:** the type box is greyed out with "Typed questions are back tomorrow. Try the common fights above." Buttons still work.
5. **Accuracy page:** the latest score (for example "47 of 50 correct"), the date of the run, and the questions it got wrong, with the right answer.

**Motion:** buttons lift on hover and press in on tap. The verdict card flips in with a small bounce, under 1 second. The sections slide up after it. Cards shuffle while the AI thinks. All motion is off when the phone is set to "reduce motion".

**Verdict colours** (exploring set): YES green, NO red, HOUSE RULE yellow, NOT SURE white. The word is always written, so colour is never the only signal.

## 4. Behaviors

| # | When | Then | Src |
|---|---|---|---|
| B1 | A user taps a fight button | The fixed, checked answer shows at once. No AI call. | Jithin |
| B2 | A user types a question and taps Ask | The question goes to the Playref server. The browser never holds an AI key. | Derived |
| B2a | Step 1: the typed question matches a known fight | The server cleans up the wording (lower case, "draw 2" / "draw two" / "plus two" all become "+2", and the same for +4 and other card names) and checks it against the words listed for each known fight. A confident match returns that fight's checked answer. No AI call. A weak match goes on to step 2. | Jithin |
| B2b | Step 2: the same cleaned-up question has a saved answer | The saved answer is returned. No AI call. Only answers saved with the current rules file version are used. | Jithin |
| B2c | An AI answer comes back (step 3) | It is saved for reuse, with the rules file version. NOT SURE answers are not saved. | Derived |
| B2d | A saved answer gets 3 "No" taps | It is removed from the saved answers and added to the review list for the test set. | Derived |
| B2e | The rules file changes | All saved answers from the old version stop being used. | Derived |
| B3 | The question reaches step 3 | The server sends the AI the whole Classic rules file plus the question, and asks for a fixed reply: verdict, one line, rule card IDs used, house-rule note. | Derived |
| B4 | The AI reply cites a rule card that does not exist, or the reply is broken | The user sees NOT SURE with the closest matching rule card. | Derived |
| B5 | The question is about another UNO version | The verdict says "Classic only for now". | Jithin |
| B6 | The question is not about UNO | A polite "I only referee UNO for now". | Derived |
| B7 | One person has asked 10 typed questions in the last hour | Further typed questions wait, with a short message. Buttons still work. | Derived |
| B8 | The free daily AI limit is used up | The "AI off for the day" state shows until the reset at 00:00 UTC. | Jithin |
| B9 | A user taps "Was this answer right?" | The question, the answer and Yes or No are saved. Every No is reviewed and can become a test case. | Derived |
| B10 | Before every release | The 50-question test set runs. If the score drops below the last release, the release stops. | Jithin |
| B11 | A user taps Share verdict | The phone's share sheet opens with the verdict, the question and the Playref link. | Derived |

Src: **Jithin** = decided in chat. **Derived** = follows from a decision and was shown in the design parts he approved.

## 5. How it is built

**Stack**

- App: React with TypeScript, built with Vite.
- Hosting: Cloudflare Pages (free plan), with Pages Functions for the server.
- AI: Cloudflare Workers AI (free: 10,000 Neurons a day). The exact model is picked during build, after checking Cloudflare's current model list and measuring real questions a day per model.
- Storage: Cloudflare D1 (free: 100,000 rows written a day) for the per-person limit, the feedback and the saved answers. Not KV, because KV allows only 1,000 writes a day on free.
- Matching (B2a) is plain local word matching on the server. It uses no AI and no paid service.

**Files**

| Path | What it holds |
|---|---|
| `rules/uno-classic.md` | About 20 numbered rule cards (R1, R2, ...). Each card: the official rule in our words and the common house versions. |
| `rules/uno-classic-fights.json` | The known fights: the 6 home-screen buttons plus hidden fights (target about 30, grown from feedback). Each has its checked answer, its rule cards and the words used to match typed questions (B2a). |
| `rules/reference/` | Private local copy of Mattel's rules sheet, for checking rule cards. Not shipped in the app. |
| `app/` | The screens and motion. |
| `functions/ask` | The server for typed questions, in order: limit check, step 1 known-fight match, step 2 saved answer, step 3 AI call and reply check, then save. |
| `functions/feedback` | Saves "Was this right?" taps. |
| `evals/questions.json` | 50 tricky questions with the right verdict and rule cards. |
| `evals/run` | Script that scores the app against the 50 questions and writes the result for the Accuracy page. |

Adding a game later = adding its two `rules/` files. No new code.

**Shipping**

- Repo: `jithin-varghese-pm/playref` on GitHub.
- Every push to `main` deploys to playref.pages.dev.
- The test set runs before each release (B10).

## 6. Before a public launch

These are not needed to build, but must be done before telling people about Playref:

1. Swap Option A's UNO-style colours for Playref's own colours.
2. Run the India trademark search for "playref" (IP India needs an OTP login, so Jithin runs it).
3. Check every rule card against Mattel's rules sheet.
4. Check the Instagram handle @playref.

## 7. Open items

1. **Cloudflare account.** A free account on Jithin's personal email, created when the build reaches deploy.
2. **AI model.** Picked during build (see Stack).

## Changelog

| Date | Change |
|---|---|
| 2 Nov 2026 | First version, from the design chat. |
| 2 Nov 2026 | Added the two steps before any AI call: local known-fight matching (B2a) and saved answers (B2b to B2e). Rule 5a. Private local copy of Mattel's rules sheet. |
| 2 Nov 2026 | Build changes: fifth verdict **THE RULE** for "what happens / how does it work" questions (yes/no did not fit them). B5 and B6 show on the card as **CLASSIC ONLY** and **UNO ONLY**. Rules source is Mattel's Classic sheet GDJ85 (the first link was the "UNO House Rules" product). AI model: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, JSON mode, about 90 new questions a day on the free allocation. |
