# What the app requires

## Goal

The owner learns to play winning No-Limit Hold'em by playing. Teaching happens inside play, at the moments a decision is made. Success means the owner's decisions lose less EV over time against a fixed benchmark. Knowing the rules or reciting a book does not count.

## How people actually learn a skill like poker

Each finding below changes a design rule. Sources are named so they can be checked.

| Finding | Source | Design rule |
|---|---|---|
| Skill grows through deliberate practice. That means targeted weaknesses, immediate feedback, and repetition just past current ability. | Ericsson, Krampe, Tesch-Römer (1993) | The coach picks which spots you see, aimed at your measured leaks. Random play alone is not practice. |
| Retrieval practice and spaced practice are the two highest-utility study techniques. Rereading and summarising are low utility. | Dunlosky et al. (2013), *Psychological Science in the Public Interest* | Concepts come back as decisions to make, on a spacing schedule. The app never shows a summary page as the main teaching act. |
| Interleaving mixed problem types beats blocked practice for transfer. | Rohrer & Taylor (2007); Bjork's "desirable difficulties" | Drills mix spot types. The learner must first recognise which concept applies, which is the real in-game skill. |
| Predicting before seeing the answer improves retention, even when the prediction is wrong. | Pretesting and generation effect literature (Richland, Kornell, Bjork) | At teaching spots, ask "what's your read and why?" before showing the answer. |
| Novices learn faster from worked examples, then fade the support. | Sweller, cognitive load theory; the expertise reversal effect | Early on, show the reasoning steps. As mastery rises, show less and ask more. |
| Explaining your own reasoning deepens understanding. | Chi et al., self-explanation effect | Optional one-line "why" from the learner, which the coach critiques. |
| One-to-one mastery tutoring is the largest known effect in education. | Bloom (1984), "2 Sigma Problem" | A per-learner skill model gates progression. Move on only after a concept is shown in play. |
| Poker outcomes are noisy. Judging a decision by its result ("resulting") teaches the wrong lesson. | Annie Duke, *Thinking in Bets* | Grade by EV loss only. Show the outcome separately and say so when a good decision lost. |
| Too much feedback during a task harms learning and flow. | Guidance hypothesis, motor learning (Salmoni, Schmidt) | Interrupt only on big mistakes or spots the learner is studying. Everything else goes in the post-hand review. |

## The systems

Seven parts. The first two are deterministic code. The LLM lives only in parts 3 and 5.

1. **Game engine.** Deals, enforces legal actions, computes pots and side pots, runs showdown. A hand is an event log reduced to state.
2. **Evaluator (ground truth).** Hand ranking, equity vs a range, pot odds, and the best action with its EV for a given spot. Starts with precomputed preflop ranges and equity math. Postflop grows into a solver. This is what makes feedback correct.
3. **Knowledge base.** Turns the owner's textbooks into concepts. Each concept has a name, a plain statement, prerequisites, the situations where it applies, and cited source chunks.
4. **Learner model.** Per-concept mastery estimate, review schedule, and a leak list built from graded decisions.
5. **Coach.** Policy that decides when to interrupt, what to ask, and what to drill next. Uses the LLM to explain the evaluator's result in the language of the cited concept.
6. **Opponents.** Bots with named, stable styles (tight-passive, loose-aggressive, calling station). They let a spot recur on purpose and make exploits teachable.
7. **Measurement.** EV loss per decision, per concept, over time. This is the north-star metric.

## Core data shapes

Named first, per pstack's Foundational Thinking and Model the Domain.

- `HandEvent`. Discriminated union of `Deal | Post | Fold | Check | Call | Bet | Raise | Reveal | Award`. The hand is `HandEvent[]`.
- `Spot`. A decision point derived from the log: position, stacks, pot, board, action history, hero cards. Pure data, hashable.
- `Grade`. `{ spot, action, bestAction, evLossBB, conceptIds }`. Produced only by the evaluator.
- `Concept`. `{ id, statement, prerequisites, appliesWhen: SpotPredicate, sources: ChunkRef[] }`. `appliesWhen` is code, so the coach can find matching spots by query.
- `Mastery`. `{ conceptId, estimate, lastSeen, nextDue }`. Updated from `Grade`s.
- `CoachTurn`. State machine. `Idle → Predict → Reveal → Explain → Idle`, plus `Review` after the hand.

## The core loop

1. The coach picks the next table setup, weighted toward due and weak concepts.
2. The owner plays. At a spot tagged with a studied concept, play pauses at Predict.
3. The owner acts, and optionally gives a one-line reason.
4. The evaluator grades it. Big EV loss or a studied concept triggers Reveal and Explain, with the cited source. Otherwise play continues.
5. After the hand, a short review lists the graded spots. Outcome is shown apart from grade.
6. Mastery updates. Missed concepts return later as drills, mixed with other spot types.

## What the textbook pipeline must do

- Ingest PDF or EPUB that the owner provides. Split into chunks that keep chapter and page.
- Extract candidate concepts with the LLM. Each must quote its chunk.
- A human (the owner, or a review pass) approves concepts before they teach. Wrong teaching is worse than none.
- Link each concept to a `SpotPredicate` and to the evaluator check that proves it. A concept with no checkable claim stays explanation-only and never grades.
- Where two books disagree, keep both and let the evaluator decide which applies.

## Risks

- **LLM poker math is unreliable.** Mitigated by invariant 1. Tested by asserting no number in a coach message is absent from the evaluator output.
- **Postflop solving is expensive.** Start with preflop and simple flop spots. Precompute common spots offline.
- **Solver licences.** The main open-source solvers are AGPL. Decide before linking one in.
- **Copyright.** Books stay local and are never redistributed.
- **Bot quality.** Weak bots teach exploiting weak bots. Styles must be named and their leaks known.
- **Scope.** Six-max cash NLHE only until the loop is proven. No tournaments, no other variants.

## Build order

Each phase ends in a check that runs, per pstack's Sequence Work into Verifiable Units.

1. **Engine.** Exit when a property test plays 100k random hands with chip conservation and legal-action invariants holding.
2. **Evaluator, preflop.** Exit when equity matches a reference calculator within 0.5% on a fixed test set, and preflop grades match the chosen range charts.
3. **Playable table with bots.** Exit when the owner plays a full session in the browser, driven end to end by a UI test.
4. **Grading and review.** Exit when every decision in a session gets a `Grade` and the review screen shows them.
5. **Knowledge base from one book.** Exit when 20 approved concepts each link to a predicate and a passing evaluator check.
6. **Coach loop.** Exit when Predict, Reveal, Explain fires on tagged spots, cites a source, and passes the "no invented numbers" test.
7. **Learner model and spaced drills.** Exit when a missed concept reappears on schedule and mastery moves on correct play.
8. **Measure impact.** Exit when a fixed benchmark spot set shows EV loss per decision trending over four weeks of use.

## Product calls defaulted (change any)

- Game: No-Limit Hold'em, six-max cash, 100bb.
- Platform: web, desktop-first.
- Books: owner supplies them. First book to ingest is the owner's choice.
- Interruptions: only on EV loss above 2bb or on studied concepts.
