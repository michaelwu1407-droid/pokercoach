# Decisions

Each entry names the decision, why, and what would change it.

## 1. A hand is `[Start, ...actions]`

Blinds, deals, street changes and payouts are derived by `reduce`, never stored. One source of truth, and any hand replays from its log. A drill is just a saved log prefix. Changes if hands ever need events that are not player actions, such as a time bank.

## 2. Bots play a known mixed strategy

Every bot decision is a probability over fold, passive and aggressive (`src/bots/policy.ts`). Because the strategy is code, the grader computes a bot's range exactly by Bayesian inference over its actions (`src/grading/villainRange.ts`). That makes "play against their range" checkable, not a slogan. The cost is that grades are exact against these bots, not against humans. Changes if the app adds human opponents or a solver.

## 3. What is graded, and how

- Preflop, every decision, by the chart for its situation (decision 9). An oversized raise is a mistake even with a chart hand.
- Heads-up after the flop, by the EV of each option, looking one betting round ahead (decision 13).
- Several opponents after the flop, by sampling (decision 10).
- A decision the grader cannot price is marked ungraded, with the reason shown.

Grading never reads the outcome or undealt cards. A test proves it by reordering the undealt deck.

## 4. Bots had to respect bet size

The first grading run showed a regular-style hero losing 12bb per decision. The cause was a bot that called 100bb shoves with second pair, which made "shove" look best everywhere. Bots now need a stronger hand as the bet grows relative to the pot. The same run now shows 3.5bb per decision. The diagnostic is `scripts/grade-mix.ts`.

## 5. No LLM

Every number comes from code, and every lesson is a template filled with grader numbers. `ungroundedNumbers` rejects any number the grader did not produce, and a test runs it on every feedback card in a simulated session. An earlier version used an LLM to pull concepts from books. It was removed: it added a key, a cost, and a failure mode, and the teaching does not need it.

## 6. Opponents are random and hidden

Each table seats five random styles, repeats allowed, and each player gets their own thresholds within 15% of their style. New players arrive only with a new game (decision 22). Styles are hidden at the table and revealed in feedback after you act against them, so reads are learned from evidence.

## 7. Feedback after every decision, and no pauses

You always commit first. The card then appears beside the table while the others act. Play never pauses: on your next turn the card folds to a one-line recap so nothing hints at the new answer, and at the end of the hand every decision is listed and each one can be reopened. This replaced pausing on costly mistakes, which broke the flow of play.

## 8. Recommendations are always buttons, and deep shoves are never recommended

The grader prices exactly the sizes the action bar offers (`src/grading/sizes.ts`). At the decision, an all-in for more than twice the pot is priced but never recommended, because a one-round lookahead undervalues bets that keep later streets to play. Inside the lookahead every size is priced, so the value of a bet does not jump when a size crosses that line.

## 9. Every preflop decision is graded by situation

`src/evaluator/responseCharts.ts` classifies each preflop decision as opening, facing limpers, facing a raise, facing a re-raise, or facing a 4-bet, and picks the chart by your seat and the raiser's. A hand listed as both raise and call is a raise, enforced in the chart builder. Raising a calling hand, or calling a raising hand, is "close". Playing a folding hand is a mistake.

## 10. Multiway pots are graded by sampling

Each opponent's range is inferred exactly, as in heads-up. Their hands and the runout are then sampled together 600 times. A bet is answered by each opponent independently, and re-raises count as calls. The card names these simplifications.

## 11. Grading runs off the main thread

An exact heads-up grade takes about 0.6 seconds on the flop and 0.3 on the turn. It runs in a Web Worker (`src/ui/grader.ts`), so the table never freezes. The card shows "Looking at your decision…" until it is ready.

## 12. Beginner aids

The guide opens on the first visit with hand rankings and every word the coach uses. The table always says what you hold in plain words. Keyboard shortcuts keep folds fast.

## 13. Heads-up flop and turn decisions look one betting round ahead

`src/grading/lookahead.ts` plays out the next betting round over every possible next card, not a sample, so the same spot always gets the same grade. The opponent follows their strategy. You pick your best option against the range that reaches each point, since you cannot see their cards. Each path keeps its own range, so a range that called your bet is stronger on the next card. After that round the hand is checked down. River decisions are exact. The heaviest combos covering 99.5% of the range are played out; the tail keeps its checked-down value. Showdown shares are cached per card, which keeps it fast enough for decision 11.

## 14. Plain words, enforced by tests

A beginner tester hit "T" for ten and "bb" for big blind on the first screen. Every learner-facing string now goes through `src/coach/words.ts`: dollars at $0.50 and $1 blinds, seat names (Early, Middle, Late, Dealer, Small blind, Big blind), "10-3 offsuit" for hand codes, "chance to win" for equity. The `JARGON` pattern fails a unit test over every fixed label and 150+ simulated coach cards, and the browser test scans the whole screen at every step.

## 15. Chance to win on every card, and the rule of 2 and 4

Every card leads with your chance to win: against everyone still in after the flop, against the players who put money in before it, or against one random hand when nobody has. A draw adds its exact out count and the in-your-head estimate (outs × 4 on the flop, × 2 on the turn). The guide's cheat sheet of break-even calls and common matchups is checked against the evaluator by a test.

## 16. A simple card first, detail on request

Each card shows the verdict and one line with the number that decided it. Everything else (stats, what they likely have, the takeaway, the draw rule, the opponent read, the working) sits under "More detail". Once opened it stays open, remembered in the browser.

## 17. Table mechanics match standard poker clients

See the table in `docs/benchmark.md`. Opponents act one at a time (`ACTION_DELAY_MS`), the grader still prices any amount you choose, and recommendations stay on the preset sizes.

## 18. Fewer elements

The default controls are Fold, Call and Raise; Raise opens three presets and a slider. Every "what next" control sits in one row under the table, so nothing moves. The coach column is always reserved, so the table never jumps when feedback appears. Opponents' seats show only their last action and blinds.

## 19. One list of bet sizes

`sizeOptions` in `src/grading/sizes.ts` is the only source of preset sizes, rounded to 50 cents. The sizer shows them and the grader prices them, so a recommended size is always a button.

## 20. Practice retires what you have learned

A mistake is saved once per spot, comes back after two minutes, and is retired when you answer it right. A wrong answer brings it back again. Saved progress is validated on load, so a damaged save never breaks the app.

## 21. Browser test is deterministic

The browser test seeds the app's random numbers, so a failure always reproduces. Unit tests cover the variety of hands.

## 22. Knockout game

Chips carry from hand to hand. An opponent who runs out of chips leaves the table, and seats are renumbered. The game ends when you run out (it restarts with five new players) or when everyone else has (you win). The hand-over line shows your result this game. Leaving a hand for practice drops that hand, so its chips stay where they were.

## 23. Numbers are read as sentences

Each number on a card sits beside one plain line saying what it means ("13%: of all starting hands are worth playing here, about 1 in 8"). Separate labels and explanation lists were removed: too much to read and still unclear. Preflop rules name real hands ("Queen-Jack suited or better") and give a short rule of thumb per situation.

## 24. Live odds beside your cards

The owner asked to see their chance to win as the hand unfolds, with a plain reason for each change, from the deal on. `src/coach/liveOdds.ts` recomputes it at the deal, at each fold and at each new card, against the players still in holding random cards (`src/evaluator/randomEquity.ts`, sampled with a fixed seed). It never uses the opponent read, so it does not reveal the graded answer (invariant 4, amended). The coach's own chance after a decision reads their bets too, and its detail line says so, because the two numbers can differ a lot.

## 25. A live trainer, built for poker rather than copied from chess

The owner asked for a switchable trainer like the coaches in chess apps. Chess coaches can name the best move as you play because the whole board is visible and one move is usually best. Poker differs in ways that change what a trainer should do:

- **Hidden cards.** The trainer never uses opponents' cards. Its checklist uses only what anyone at the table sees.
- **Several close options.** Instead of leading with a move, it gives the three checks a good player runs every time: position, price (the share of the pot a call needs), and the player (how often they have played and raised this game, counted by `src/learn/seen.ts`).
- **Opponent-dependent answers.** The player check reads each opponent from this game's counts, because the same hand can be a call against one player and a fold against another.
- **Results mislead.** It reminds you to judge the decision, not the result.

The hint (the spot's rule of thumb) and the best move stay hidden until asked. A move that would be a mistake pauses with "Think again", like a chess coach's warning, and can be taken back or played anyway. Any decision where the trainer showed the answer or warned you is logged as "assisted" and left out of progress. The trainer is off during practice, which tests spots you got wrong. Invariant 4 still holds with the trainer off; switching it on is the learner asking for help.

## 26. The table plays like a poker game

Compared with 247 Free Poker and PokerNow, the table felt like a form. Now the board and your cards are large, the pot is the biggest text on the felt, each player's last action is a speech bubble over their head, and the chips put in this round sit on the felt in front of each seat. At showdown the board cards the winner did not use are dimmed and every shown hand is named under its cards (`src/evaluator/bestFive.ts`), so the learner sees why the winner won. Your hand's name sits under your cards all hand. Everything the table draws comes from one pure view model (`src/ui/tableView.ts`). Motion is short and turned off for people who ask for reduced motion. Sounds are synthesized, start on, and can be muted from the top bar. The browser test fails when seats, bubbles, chips, tags or the board overlap.
