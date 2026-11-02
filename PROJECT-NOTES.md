# Playref (by MBM): Project Notes

Unofficial rules referee for road-trip and camping games. Game 1: the UNO card game.

Started: 2 Nov 2026
Type: Personal side project, made by a fan of UNO. Not a commercial product.

## The idea

A web app where players ask rules questions and get a clear answer based on the official UNO rules. Its main job is to settle table arguments, and to say plainly when something is a house rule and not an official rule.

## Does something similar exist? (checked 2 Nov 2026)

| What exists | What it does | The gap |
|---|---|---|
| General board game rules AIs: Board Law, Ludus Judge AI, RuleBot, BoardGameBot, Geek AI | Answer rules questions for many games, often from a rulebook PDF you upload | Wide, not deep. None is built for UNO and its house-rule fights |
| "uno" chat persona on shapes.inc | Community chat bot with tips and rules | Not tied to the rulebook, so it can make things up |
| Official UNO! mobile app | Lets you play, and set house rules | Not a rules helper |
| Rules articles (officialgamerules.org, blogs) | Explain official vs house rules | Static pages, no way to ask about your exact situation |

**Conclusion:** General rules AIs exist. A focused, UNO-only helper that answers from the rulebook and gives "official or house rule" verdicts does not seem to exist. That is the gap.

## How this project stands out

1. **UNO only, done deeply.** It knows the common house rules (stacking, 7-0, jump-in, draw until you can play) and labels each one.
2. **"Settle the fight" mode.** Describe the exact moment at the table, get a ruling and the reason.
3. **Public test score.** A set of tricky questions with known answers, and the app's accuracy shown on the page.

## Fan project rules (trademark and copyright)

UNO is a trademark of Mattel, and Mattel actively protects it. I did not find a public Mattel fan-site policy, so these rules follow what other game publishers ask of fans. This is general practice, not legal advice.

- The app name and web address do **not** contain "UNO". Use "UNO" only in normal sentences, for example "a rules helper for the UNO card game".
- No UNO logo, no red oval, no card art, no copied colour scheme, no photos of real cards.
- Never say "official". Always say "unofficial fan project".
- Footer on every page: "UNO is a trademark of Mattel. This is an unofficial fan project and is not affiliated with or endorsed by Mattel."
- Do not copy the rulebook word for word. Explain rules in my own words, quote only short lines when needed, and link to Mattel's own rules sheet.
- No ads, no paid features, no selling. Keep it a free fan project.

## Decisions

- 2 Nov 2026: The project shows off **both** AI PM skills and build skills. Ship a small first version first (rulebook answers), then add the public test score.

- 2 Nov 2026: Main moment of use is **on a phone, during a game, to settle a fight**. Phone-first, fast, short verdict first.

- 2 Nov 2026: Version 1 covers **Classic UNO only**, plus the common house rules. Questions about other versions get "Classic only for now".

- 2 Nov 2026: People ask by **tapping one of 6 to 8 common fights, or typing their own question** in a text box below.

- 2 Nov 2026: **Button answers are written and checked by hand.** Typed questions go to the AI, which answers only from the Classic rules text.
- 2 Nov 2026: The AI is **Cloudflare Workers AI** on the free plan, which also hosts the site. The free daily limit is the cap. When it runs out, typed questions show "back tomorrow", and the buttons keep working. Measure the real number of questions a day before building.

- 2 Nov 2026: **Scope widened.** The app is a rules referee for games played on road trips and camping trips. UNO (Classic) is game 1. Each game = its own rules text + its own set of common-fight buttons, so adding a game is mostly writing. Version 1 still ships UNO only.
- 2 Nov 2026: **Own brand, with the subtitle "by MBM".** Not part of the MBM feed or MBM hours. MBM may mention it in a reel now and then.
- 2 Nov 2026: No name close to "UNO" (look-alike or sound-alike names carry the same trademark risk).

- 2 Nov 2026: **Name: Playref**, subtitle "by MBM". Checked 2 Nov 2026: no app or product found with this name. playref.com is already registered (NameBright name servers). playref.app, playref.in and playref.io had no DNS records, so they look free, but confirm at a registrar. Free start: playref.pages.dev on Cloudflare. Instagram handle not checked yet.
  - Official trademark check, 2 Nov 2026: **USPTO**: "playref" and "playref*" gave no results (live or dead). **WIPO Global Brand Database**: "playref" gave no results. **IP India**: not checked, the search now needs an OTP login. Run it by hand. Nearby US marks: HEY-REF and SOCIAL REF (live, class 41, sports refereeing and leagues); PARTY REF (dead, games, classes 16 and 28). None blocks Playref for a free fan app, in my view (not legal advice).

- 2 Nov 2026: **Look: Option A "Red table"**, with motion: buttons lift and press, the verdict card flips in, cards shuffle while the AI thinks. Motion turns off for people who set "reduce motion" on their phone. Mockups: https://claude.ai/artifact/DQe1CEy3G8B1EE8uvH6acz (board A3). UNO-style colours are for exploring only; swap to Playref's own colours before launch.

- 2 Nov 2026: **Answers and accuracy (Part 2) approved:** one rules file with numbered rule cards, fixed button answers, the AI gets the whole rules file, the server checks replies, a fourth verdict NOT SURE, 10 typed questions an hour per person, feedback becomes tests, public accuracy score.
- 2 Nov 2026: **Build and ship (Part 3) approved:** React + TypeScript + Vite, **Cloudflare** (chosen over Vercel: free AI in the same account, daily reset, no 30-day lock-out), D1 for storage (not KV), repo `jithin-varghese-pm/playref`, auto-deploy to playref.pages.dev.
- Full design: `docs/superpowers/specs/2026-11-02-playref-v1-design.md`.

- 2 Nov 2026: Tried MBM black, yellow and cream; **reverted to the red table look** the same day (Jithin: "too boring"). The UNO-style colour item is open again before a wide public share.
- 2 Nov 2026: **Colour item closed: red table kept, four-colour set removed.** Dots are yellow, shuffle cards and the preview's back card are black, white and yellow. Red plus yellow alone does not read as UNO. Verdict colours (green YES, light blue THE RULE) stay, as they carry meaning.

- 2 Nov 2026: **Share link for LinkedIn: https://jithin-varghese-pm.github.io/playref/** (forwards to playref.pages.dev/?ref=li). LinkedIn's post editor showed "Cannot display preview" for every playref.pages.dev link even though Post Inspector rendered it; the github.io link worked first time. Use the github.io link for LinkedIn shares. Source: `portfolio-site/playref/` (update its og-image.jpg if the preview image changes).

## Open decisions

- Review of the design document.

## Sources

- https://huggingface.co/Apug98/boardgame-rag-qa
- https://ai.google.dev/competition/projects/board-law
- https://www.producthunt.com/products/ludus-judge-ai
- https://apps.apple.com/us/app/-/id6756893934
- https://hunted.space/product/boardgamebot
- https://shapes.inc/uno-ai
- https://officialgamerules.org/?p=8970
- https://service.mattel.com//instruction_sheets/24F_Games_HRL31-0971_DOM.pdf
- https://www.mealeys.com/mealeys/articles/2254765
- https://support.ingress.com/hc/en-us/articles/41140416541851-Brand-and-Fan-site-Guidelines
- https://www.zmangames.com/ip-policy/
