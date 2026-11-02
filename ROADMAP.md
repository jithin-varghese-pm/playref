# Playref roadmap

Last updated: 2 Nov 2026. Decisions and their reasons live in `PROJECT-NOTES.md`.

## Now: make the UNO referee worth sharing

Goal: real people use it, and we measure it honestly.

1. **Safe to share**
   - Swap the UNO-style colours for Playref's own palette (trademark rule).
   - Jithin reads all 18 rule cards against Mattel's Classic sheet (GDJ85).
   - India trademark search for "playref" (IP India, needs Jithin's OTP login).
   - ~~Visitor stats~~ Done 2 Nov 2026: Cloudflare Web Analytics (visitors) + Playref usage counter (`npm run usage`).
   - Cloudflare token in GitHub, so every push deploys on its own.
2. **Real users**
   - 20 to 30 people: road-trip friend groups, one MBM story, LinkedIn.
3. **Honest score**
   - A second test set built from real users' questions, published next to the current one ("my questions" vs "real questions").
   - Add the two current misses (customizable cards, one round) as known fights.

**Decision point after "Now":** if people use it and ask about other games, start "Next". If not, stop building and add a "what I learned" section to the case study.

## Next: "What should we play?" picker + card-game referee

Decided 2 Nov 2026, parked until "Now" is done.

- **Picker:** 3 taps (how many people, where you are, what you have: nothing, a phone, a deck of cards) gives the top 3 games, each with a 60-second "how to play". Rules-based, no AI.
  - No-prop games for the car and campfire: Mafia, Imposter, antakshari, 20 Questions, Would You Rather, I Spy, Two Truths and a Lie, Contact.
  - Card games for groups with a deck, plus UNO for groups that brought it.
- **Referee grows from UNO to 3 card games** where fights are common and rules are clear:
  - Poker hand rankings
  - 13-card Indian Rummy
  - Donkey (Kazhutha)
- **Rules source:** our own words, checked against a respected reference (Pagat.com), written as "standard rules plus common variants". Eval questions only cover rules everyone agrees on.
- **Guardrail:** rules only, never betting. Show "for fun, no betting" on Poker and Teen Patti.

## Later: based on what users ask for

- More card games: Teen Patti, 28, Bluff.
- A referee for party games, using published "Playref standard rules".

## Not doing

- Board games like Monopoly or Snakes and Ladders: they need a board, so they aren't road-trip games, and Monopoly is a trademark.
- Accounts, a native app, ads or paid features.
