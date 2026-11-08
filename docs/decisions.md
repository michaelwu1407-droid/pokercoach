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

## 5. The LLM never writes a number the learner sees

Explanations are templated from the grade. `ungroundedNumbers` rejects any number the grader did not produce, and a test runs it on every message in a simulated session. The LLM is used only offline, to propose concepts from books. A proposal survives only if its quote is in the source word for word and it names situation tests from a fixed table. The owner then approves each one.

## 6. Book concepts teach but never grade

A book claim like "open wider on the button" is shown with its quote when it applies. It never takes credit for a grade, because the grader does not measure it. Built-in concepts are the ones whose claims the grader computes.

## 7. Interruptions

Play pauses before a decision at most once per hand, and only for a concept still being learned. After a decision, the coach interrupts only on a loss of 2bb or more, or a chart mistake. Everything else goes to the post-hand review. This follows the guidance-hypothesis finding that constant feedback harms learning.
