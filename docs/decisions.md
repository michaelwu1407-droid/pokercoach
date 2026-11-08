# Decisions

Each entry names the decision, why, and what would change it.

## 1. A hand is `[Start, ...actions]`

Blinds, deals, street changes and payouts are derived by `reduce`, never stored. One source of truth, and any hand replays from its log. A drill is just a saved log prefix. Changes if hands ever need events that are not player actions, such as a time bank.

## 2. Bots play a known mixed strategy

Every bot decision is a probability over fold, passive and aggressive (`src/bots/policy.ts`). Because the strategy is code, the grader computes a bot's range exactly by Bayesian inference over its actions (`src/grading/villainRange.ts`). That makes "play against their range" checkable, not a slogan. The cost is that grades are exact against these bots, not against humans. Changes if the app adds human opponents or a solver.

## 3. What is graded, and how

- Preflop, raise-first-in only. Basis is an open-raise chart. Verdict is right or wrong, with no EV number, because a chart cannot price a deviation.
- Heads-up postflop. Basis is the EV of each option from a one-step lookahead. The bot responds by its strategy, and later streets are treated as checked down. The learner sees these simplifications under "What this number simplifies".
- Everything else returns a grade marked ungraded, with the reason shown.

Grading never reads the outcome or undealt cards. A test proves it by reordering the undealt deck.

## 4. Bots had to respect bet size

The first grading run showed a regular-style hero losing 12bb per decision. The cause was a bot that called 100bb shoves with second pair, which made "shove" look best everywhere. Bots now need a stronger hand as the bet grows relative to the pot. The same run now shows 3.5bb per decision. The diagnostic is `scripts/grade-mix.ts`.

## 5. No LLM

Every number comes from code, and every lesson is a template filled with grader numbers. `ungroundedNumbers` rejects any number the grader did not produce, and a test runs it on every feedback card in a simulated session. An earlier version used an LLM to pull concepts from books. It was removed: it added a key, a cost, and a failure mode, and the teaching does not need it.

## 6. Opponents are random and hidden

Each table seats five random styles, repeats allowed, and each player gets their own thresholds within 15% of their style. The table changes every 25 hands. Styles are hidden at the table and revealed in feedback after you act against them, so reads are learned from evidence.

## 7. Feedback after every decision, pauses only for costly ones

You always commit first. Then one card shows the verdict, at most three numbers, what they likely had, one takeaway, and who they are. Play pauses only on a loss of 2bb or more, or a chart mistake. The takeaway explains the play you made when it was good, and the better play when it was not, including "right idea, wrong size".

## 8. Recommendations are always buttons, and deep shoves are never recommended

The grader prices exactly the sizes the action bar offers (`src/grading/sizes.ts`). An all-in for more than twice the pot is priced but never recommended, because the one-step lookahead undervalues bets that keep later streets to play. Before this rule, deep shoves kept "winning" for that reason alone.

## 9. Every preflop decision is graded by situation

`src/evaluator/responseCharts.ts` classifies each preflop decision as opening, facing limpers, facing a raise, facing a re-raise, or facing a 4-bet, and picks the chart by your seat and the raiser's. A hand listed as both raise and call is a raise, enforced in the chart builder. Raising a calling hand, or calling a raising hand, is "close". Playing a folding hand is a mistake.

## 10. Multiway pots are graded by sampling

Each opponent's range is inferred exactly, as in heads-up. Their hands and the runout are then sampled together 600 times. A bet is answered by each opponent independently, and re-raises count as calls. The card names these simplifications.

## 11. One pause per hand

A loose beginner made a costly mistake in 58% of simulated hands. Pausing on each would turn play into a lecture, so play pauses at most once per hand. Later mistakes in the same hand still get a card.

## 12. Beginner aids

The guide opens on the first visit with hand rankings and every word the coach uses. The table always says what you hold in plain words. Keyboard shortcuts keep folds fast.

## 13. Heads-up flop and turn decisions look one betting round ahead

`src/grading/lookahead.ts` plays out the next betting round over 10 sampled next cards. The opponent follows their strategy. You pick your best option against the range that reaches each point, since you cannot see their cards. Each path keeps its own range, so a range that called your bet is stronger on the next card. After that round the hand is checked down. River decisions stay exact. The 250 heaviest combos (covering 99.5% of the range) are played out and the tail keeps its checked-down value.

What it changed, on a regular-style hero over 400 simulated hands: heads-up blunders fell from 23 to 10 and mistakes from 25 to 14, because a check or call now earns the value it leaves for later. A turn check with the nuts against a calling station is worth 2.34bb in a 2bb pot instead of exactly 2bb. Calls can now be right below the break-even equity (implied odds) and wrong above it (they keep betting), and the card says so. Grading takes 296ms at the 95th percentile and 428ms at most.

Multiway pots still look one action ahead.

## 14. Plain words, enforced by tests

A beginner tester hit "T" for ten and "bb" for big blind on the first screen. Every learner-facing string now goes through `src/coach/words.ts`: dollars at $0.50 and $1 blinds, seat names (Early, Middle, Late, Dealer, Small blind, Big blind), "10-3 offsuit" for hand codes, "chance to win" for equity. The `JARGON` pattern fails a unit test over every fixed label and 150+ simulated coach cards, and the browser test scans the whole screen at every step.

## 15. Chance to win on every card, and the rule of 2 and 4

Every card leads with your chance to win: against everyone still in after the flop, against the players who put money in before it, or against one random hand when nobody has. A draw adds its exact out count and the in-your-head estimate (outs × 4 on the flop, × 2 on the turn). The guide's cheat sheet of break-even calls and common matchups is checked against the evaluator by a test.

## 16. A simple card first, detail on request

Each card shows the verdict and one line with the number that decided it. Everything else (stats, what they likely have, the takeaway, the draw rule, the opponent read, the working) sits under "More detail". Once opened it stays open, remembered in the browser.

## 17. Table mechanics match standard poker clients

See the table in `docs/benchmark.md`. Opponents act one at a time (`ACTION_DELAY_MS`), the grader still prices any amount you choose, and recommendations stay on the preset sizes.

## 18. Fewer elements

Removed: the Play tab, the new-table banner, the waiting line, key hints on buttons, the typed amount box, opponents' seat labels (the takeaway names the raiser and their seat instead), the hand review list and its disclaimer. The default controls are Fold, Call and Raise; Raise opens three presets and a slider. Every "what next" button sits in the same place under the table. The table uses the full width until there is feedback to show.
