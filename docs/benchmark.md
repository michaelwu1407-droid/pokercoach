# Benchmark: apps that teach poker (November 2026)

Sources are web search results, many from affiliate or competitor blogs. The vendors' own sites could not be opened from the build environment, so treat prices and features as secondhand. Links are in the session reply that produced this file.

## The field

| App | What it is | How it teaches | Price |
|---|---|---|---|
| GTO Wizard | Solver library, trainer, hand analyzer. Browser first. | Drills a spot street by street. After each action it shows the solver's play and the EV you gained or lost. Analyzer finds leaks in imported hand histories. | Free tier grades 10 hands a day. Starter about $39 to $49 a month. Ultra about $229 to $289 a month. |
| PokerSnowie | AI opponent and analyzer. Desktop, plus an iPhone app. | Play hands against the AI. Each decision is labelled an error or a blunder by its EV cost. Optional live advice shows how often the AI takes each option. | About $23 to $30 a month after a 10-day trial. |
| DTO Poker | Phone GTO trainer, separate cash and MTT apps. | Preflop and postflop spot drills against solver solutions. Paid levels and an OpenAI-powered "Virtual Coach" in the MTT app. | Free base. Paid from about $9.99 a month. |
| Poker Skill | Beginner app. | Short lessons, a daily puzzle, practice games against AI with a coach reviewing each move. | Free lessons and puzzle, one AI game a day free. |
| WSOP Academy | Beginner app from WSOP. iPhone. | Learning path of quick lessons, a "Poker IQ" score, XP and rankings, "Challengers". | Free core. WSOP+ $9.99 or $49.99 a month. |
| POKER Q'z | Quiz app. | GTO-based quizzes on real hands with explanations. | Free basics, paid premium. |
| pokercoach | This app. Browser, desktop and phone. | Full 6-max hands against hidden random opponent styles. A card after every decision: verdict, up to three numbers, what they likely held, one takeaway, who they are. Mistakes come back as spaced drills. | Free. No account, no key. |

## Scorecard

✓ has it. ~ partly. ✗ does not. ? not confirmed by any source found.

| Capability | GTO Wizard | Snowie | DTO | Poker Skill | WSOP Acad. | pokercoach |
|---|---|---|---|---|---|---|
| Learn by playing full hands | ~ (trainer spots, PokerArena heads-up) | ✓ | ✗ | ✓ | ~ | ✓ |
| Feedback after every decision | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Grades by EV cost, not outcome | ✓ | ✓ | ✓ | ? | ? | ✓ |
| Accuracy of the "right answer" | Solver, exact | Neural net, strong | Solver | ? | ? | Charts preflop, one betting round ahead heads-up postflop |
| Explains why in plain words | ~ | ~ | ~ (AI coach) | ✓ | ✓ | ✓ |
| Shows what the opponent likely holds | ✓ (ranges) | ~ | ✓ | ? | ? | ✓ (hand-type bar) |
| Teaches exploiting player types | ✗ (GTO) | ✗ (GTO) | ✗ (GTO) | ? | ✓ (reading opponents) | ✓ (hidden styles, revealed) |
| Your own mistakes come back, spaced | ? | ✗ | ? | ? | ? | ✓ |
| Leak report by skill | ✓ | ✓ | ~ | ? | ~ | ✓ |
| Beginner path and lessons | ~ (courses) | ✗ | ~ | ✓ | ✓ | ~ (one guide) |
| Daily habit: streaks, puzzle, XP | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Import your real hands | ✓ | ✓ | ? | ✗ | ✗ | ✗ |
| Native phone app | ✓ (PokerArena) | ✓ | ✓ | ✓ | ✓ | ✗ (works in the phone browser) |
| Free with no limits | ✗ | ✗ | ✗ | ~ | ~ | ✓ |

## Where pokercoach leads

1. **It teaches reads.** Every serious trainer grades against GTO. pokercoach grades against the actual opponent's strategy, hides it, and reveals it after you act. That is the skill that wins at low stakes.
2. **It shows what they had, as hand types.** "Two pair or better 16%, top pair 27%, draws 26%" is closer to how a player thinks than a 169-cell range grid.
3. **Mistakes come back.** No competitor was confirmed to schedule your own errors for spaced replay.
4. **No paywall, no account, no daily cap.**

## Where pokercoach trails, in order of impact

1. **Accuracy after the flop.** Solvers and Snowie value the whole hand tree. pokercoach looks one step ahead and treats later streets as checked down. A serious player will find answers to argue with. This is the biggest credibility gap.
2. **No beginner path.** Poker Skill and WSOP Academy sequence lessons from rules to strategy. pokercoach drops a beginner into full 6-max hands with one guide.
3. **No daily habit loop.** Streaks, a daily puzzle and XP keep people coming back in the beginner apps. pokercoach has none.
4. **No installable phone app.** It runs in a phone browser but cannot be added to the home screen.
5. **No real-hand import.** Not needed for learning by play, so lowest priority.

## Recommended next steps

1. **Done (decision 13).** Heads-up flop and turn decisions now play out one more betting round.
2. **Stages.** Start new players on preflop-only hands (fold or play, then the hand runs out), unlock flop play after preflop accuracy holds above a bar, then full hands. Closes gap 2 using what exists.
3. **Daily set.** Ten drills a day built from your own mistakes, with a streak counter. Closes gap 3, and reuses the drill queue.
4. **Installable web app** (manifest and offline cache). Closes gap 4 cheaply.
5. Keep "decide first". Snowie's live advice is the opposite of how retention works, so it is not a gap worth closing.
