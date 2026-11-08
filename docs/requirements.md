# What the app requires

## Goal

The owner learns to play winning No-Limit Hold'em by playing. Teaching happens right after each decision, using the numbers that decision turned on. Success means the owner's decisions lose less EV over time. Knowing the rules or reciting a book does not count.

The app needs no LLM. Every number comes from code, and every lesson is a template filled with those numbers.

## How people actually learn a skill like poker

Each finding changes a design rule. Sources are named so they can be checked.

| Finding | Source | Design rule |
|---|---|---|
| Skill grows through deliberate practice: targeted weaknesses, immediate feedback, repetition just past current ability. | Ericsson, Krampe, Tesch-Römer (1993) | Mistakes come back as drills. Progress shows the biggest leaks. |
| Retrieval and spaced practice beat rereading and summaries. | Dunlosky et al. (2013) | Concepts return as decisions to make, on a spacing schedule. No reading pages. |
| Interleaving mixed problem types beats blocked practice. | Rohrer & Taylor (2007); Bjork | Drills mix concepts, so the learner must spot which idea applies. |
| Committing to an answer before seeing it improves retention. | Pretesting and generation effect (Richland, Kornell, Bjork) | You always decide first. Feedback comes only after. |
| Novices need worked reasoning with low extraneous load. | Sweller, cognitive load theory | One feedback card: verdict, at most three numbers, one takeaway. Details are one tap away. |
| Judging decisions by results teaches the wrong lesson. | Annie Duke, *Thinking in Bets* | Grades ignore the outcome. The hand result is shown apart, with a reminder. |
| Too much interruption harms learning and flow. | Guidance hypothesis (Salmoni, Schmidt) | Every decision gets a card, but only costly mistakes stop play. |
| Reads must be learned, not given. | Standard poker coaching practice | Opponent styles are hidden at the table. Feedback reveals them after you act. |

## The systems

All deterministic code.

1. **Game engine.** Deals, enforces legal actions, computes side pots, runs showdown. A hand is an event log reduced to state.
2. **Evaluator.** Hand ranking, equity against a range, pot odds, and preflop charts for opening, facing limpers, a raise, a re-raise and a 4-bet.
3. **Opponents.** Four styles (nit, regular, maniac, calling station). Each table seats five random styles, each player with their own thresholds. The table changes every 25 hands.
4. **Grader.** Infers the opponent's range from their known strategy, prices every option you could have clicked, and grades your choice by EV lost.
5. **Coach.** Turns a grade into one feedback card, and decides whether to pause play.
6. **Learner model.** Mastery per concept, spaced review, saved mistakes for drills.
7. **Measurement.** EV lost per decision by week, and a record per skill, weakest first.

## Core data shapes

- `HandEvent`. `Start | Fold | Check | Call | Bet | Raise`. `Start` carries the table and the shuffled deck, so blinds, deals and payouts are derived. The hand is `HandEvent[]`.
- `Opponents`. Seat to `{ name, style }`. Stored on each hand, so drills replay against the same players.
- `Grade`. Graded with a chart or EV basis, or ungraded with a reason. The EV basis carries equity, pot odds, fold share, equity when called, and the opponent's range mix.
- `Feedback`. Context, headline, up to three stats, range mix, key point, opponent read, details.
- `CoachState`. `idle | feedback(paused?)`.
- `Mastery` and `SavedSpot` for spaced drills.

## The core loop

1. You play a hand at a table of five unknown players.
2. You decide. Nothing hints at the answer first.
3. A feedback card appears for that decision. Play pauses only if it cost 2bb or more or broke a preflop chart, and at most once per hand.
4. The card shows what they likely had, the numbers that decided it, one takeaway, and who the opponent really is.
5. After the hand, a short review lists your graded decisions. The result is shown apart from the grades.
6. Mistakes return as practice a few minutes later, mixed with other concepts.

## Risks

- **Grades are exact against these bots, approximate for poker in general.** The lookahead treats later streets as checked down. Each card says so under "How this was worked out".
- **Bot quality.** Weak bots teach exploiting weak bots. Styles have named leaks, and the grader exposed one already (decision 4).
- **Scope.** Six-max cash only until the loop is proven.

## Status (2026-11-08)

| Part | State | Evidence |
|---|---|---|
| Engine | Done | 100k random hands conserve chips and replay identically. |
| Evaluator | Done | All 2,598,960 five-card hands match the known counts. Equity matches outs counting. |
| Opponents | Done | Random styles per table, individual thresholds, verified by test. |
| Grader | Done | Every decision is graded: preflop by situation chart, postflop by EV against one or several opponents. Grades proven independent of undealt cards. Recommendations are always a button on screen. |
| Coach | Done | Every card in a 150-hand session passes the number-grounding check and has a key point. |
| Drills | Done | Browser test fast-forwards 5 minutes and drills come due. |
| Measurement | Needs four weeks of play | Progress tab shows EV lost per decision by week and the biggest leaks. |

Known approximations, each shown on its card: later streets are treated as checked down, and against several opponents each one answers a bet as if deciding alone.

## Defaults (change any)

- No-Limit Hold'em, six-max cash, 100bb.
- Web, desktop and phone.
- Play pauses on losses of 2bb or more.
- Preflop charts are approximate defaults written for this app.
- Keyboard: F fold, C check or call, R and 2 to 3 for sizes, Space to continue.
