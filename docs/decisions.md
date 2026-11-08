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
