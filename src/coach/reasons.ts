import { prettyClass } from "../cards/card";
import type { Opponents } from "../bots/opponents";
import type { PlayerAction } from "../engine/types";
import { aggressive, type ActionValue, type Graded } from "../grading/types";
import { handWords, rowEmpty, rowLine } from "./chartWords";
import { breakdown, features, inMainGroup, liveCheck, typeOf } from "./handTypes";
import { dollars, seatName } from "./words";

export const pct = (x: number) => `${Math.round(x * 100)}%`;

const sameAction = (a: PlayerAction, b: PlayerAction) => a.type === b.type && ("to" in a ? a.to : 0) === ("to" in b ? b.to : 0);

/** How they answer a particular bet: the one being discussed, not always the smallest. */
export function betStats(g: Graded, a: PlayerAction): ActionValue | null {
  if (g.basis.kind !== "ev" || !aggressive(a)) return null;
  return g.basis.values.find((v) => sameAction(v.action, a)) ?? null;
}

/** The bet whose numbers the card quotes: the recommended one, else yours, else the smallest offered. */
export function quotedBet(g: Graded): ActionValue | null {
  if (g.basis.kind !== "ev") return null;
  return betStats(g, g.best) ?? betStats(g, g.action) ?? g.basis.values.find((v) => aggressive(v.action)) ?? null;
}

type Kind = "fold" | "passive" | "aggressive";
const kindOf = (a: PlayerAction): Kind => (a.type === "fold" ? "fold" : aggressive(a) ? "aggressive" : "passive");

/** Why one kind of play is right here, in the numbers of the bet being discussed. */
function why(g: Graded, kind: Kind, bet: ActionValue | null): string {
  if (g.basis.kind !== "ev") return "";
  const { equity, potOddsNeeded: need, opponents } = g.basis;
  const eq = pct(equity);
  const fold = bet?.foldShare ?? null;
  const called = bet?.winWhenCalled ?? null;
  const against = opponents > 1 ? `the ${opponents} players still in` : "the hands they bet with";
  const folds = fold === null || fold < 0.05 ? null : opponents > 1 ? `everyone folds ${pct(fold)} of the time` : `they fold ${pct(fold)} of the time`;
  const keepPlaying = called === null ? "" : `, and against the hands that keep playing you win ${pct(called)} of the time`;
  if (need !== null) {
    const n = pct(need);
    if (kind === "fold" && equity >= need) return `You had a ${eq} chance, about the ${n} needed, but they keep betting on later cards, so calling costs more than it wins.`;
    if (kind === "fold") return `Calling needed a ${n} chance to win. You had ${eq} against ${against}, so folding saves money.`;
    if (kind === "passive" && equity < need && opponents === 1)
      return `You had a ${eq} chance, below the ${n} needed, but calling still pays once the next betting round is counted: you can win more later, when your hand improves or when they stop betting.`;
    if (kind === "passive") return `Calling needed a ${n} chance to win and you had ${eq}, so calling makes money over time.`;
    return folds ? `Raising earns most: ${folds}${keepPlaying}.` : `Raising earns most even though they rarely fold${keepPlaying}.`;
  }
  if (kind === "aggressive") return folds ? `Betting works: ${folds}${keepPlaying}.` : `Betting earns most even though they rarely fold${keepPlaying}, so weaker hands pay you.`;
  if (called === null) return `Checking is better here. Your chance to win is ${eq}.`;
  if (equity >= 0.5) return `You are ahead with a ${eq} chance to win, but a bet mostly makes the hands you beat fold. Checking keeps them in.`;
  return `A bet ${folds ? `makes ${pct(fold ?? 0)} of their hands fold` : "rarely makes them fold"}, and against the ones that keep playing you win just ${pct(called)}. Check.`;
}

/** Why your raise was not the best play, in that raise's own numbers. */
function whyNotRaise(g: Graded): string {
  const mine = betStats(g, g.action);
  const fold = mine?.foldShare ?? 0;
  const called = mine?.winWhenCalled;
  return `Your ${g.action.type} makes only ${pct(fold)} of their hands fold${called === undefined || called === null ? "" : `, and against the hands that keep playing you win just ${pct(called)}`}.`;
}

export function evKeyPoint(g: Graded, describe: (a: PlayerAction) => string): string {
  const chosen = kindOf(g.action);
  const best = kindOf(g.best);
  if (g.verdict === "good" && chosen !== best) return `Close call: ${describe(g.best)} earns about the same. ${why(g, chosen, betStats(g, g.action) ?? quotedBet(g))}`;
  if (g.verdict === "good") return why(g, chosen, betStats(g, g.action) ?? quotedBet(g));
  if (chosen === "aggressive" && best === "aggressive")
    return `Right idea, wrong size. ${describe(g.best)} earns about ${dollars(g.evLossBB!)} more on average. ${why(g, "aggressive", betStats(g, g.best))}`;
  if (chosen === "aggressive") return `${whyNotRaise(g)} ${why(g, best, quotedBet(g))}`;
  return why(g, best, quotedBet(g));
}

const MOVE_WORD = { raise: "a raise", call: "a call", fold: "a fold" } as const;

const RAISE_VERB = { "rfi": "raise", "vs-limp": "raise", "vs-open": "re-raise", "vs-3bet": "raise again", "vs-4bet": "raise again" } as const;

/** The chart's rule for hands like yours, then where your hand falls: concrete hands, not percentages. */
export function chartSummary(g: Graded, describe: (a: PlayerAction) => string): string {
  if (g.basis.kind !== "chart") return "";
  const { spot, position, bestMove, borderline, oversized, row } = g.basis;
  const hand = handWords(g.basis.handClass);
  if (oversized) return `Right idea, wrong size: ${describe(g.best)}, not ${describe(g.action)}. A raise that big only gets called by hands that beat you.`;
  const move = bestMove === "fold" && position === "BB" && spot === "vs-limp" ? "a check" : MOVE_WORD[bestMove];
  const verdict = g.verdict === "good" ? `${hand} is ${move} here.`
    : borderline && spot === "vs-limp" ? `${hand} is just outside, so this is close. It is a usual raise when nobody has called yet.`
    : borderline ? `${hand} is just outside, so this is close. It becomes a raise from a later seat.`
    : `${hand} should be ${move} here.`;
  // A hand outside every type in the live check needs no chart line: the check itself says fold.
  if (move === "a fold" && !borderline && !inMainGroup(g.basis.handClass, g.basis.groups)) {
    return `${hand}: ${features(g.basis.handClass)}. None of the hands worth playing here look like that, so fold.`;
  }
  // A hand on the list: say which type it is. The headline already gives the verdict.
  if (bestMove !== "fold" && !borderline) {
    const chose = g.action.type === "fold" || g.action.type === "check" ? "fold" : aggressive(g.action) ? "raise" : "call";
    if (chose !== "fold" && chose !== bestMove) return rowLine(row, RAISE_VERB[spot]);
    const why = inMainGroup(g.basis.handClass, g.basis.groups) ? typeOf(g.basis.handClass) : "not one of the main types, but still";
    return `${hand} is ${why}${why.endsWith("still") ? " on the list here" : ", so it makes the list here"}.`;
  }
  // Passes the quick check but is among the weakest of its type: the chart line shows where the cut is.
  if (move === "a fold" && !borderline) {
    const cut = rowEmpty(row) ? "" : ` ${rowLine(row, RAISE_VERB[spot])}`;
    return `${hand} is ${typeOf(g.basis.handClass)}, but one of the weakest, so it misses the list here.${cut}`;
  }
  return `${rowLine(row, RAISE_VERB[spot])} ${verdict}`;
}

/** A question to ask at the table, then why the list is so short. */
export function chartKeyPoint(g: Graded, opponents: Opponents): string {
  if (g.basis.kind !== "chart") return "";
  const { spot, behind, openerShare, ladder, groups } = g.basis;
  const raiser = g.basis.openerSeat !== null ? opponents[g.basis.openerSeat]?.name ?? "The raiser" : "The raiser";
  const check = `Quick check: ${liveCheck(groups)} If not, fold.`;
  switch (spot) {
    case "rfi": {
      const early = ladder[0]!, dealer = ladder.find((l) => l.position === "BTN")!;
      return `${check} Why so few: ${behind} player${behind === 1 ? "" : "s"} still act after you and any of them can hold a better hand. Fewer players behind, more hands: about ${early.roughPct}% from the Early seat, ${dealer.roughPct}% on the Dealer.`;
    }
    case "vs-limp":
      return `${check} Why: players who only call usually hold medium hands, so raise the hands that beat those.`;
    case "vs-open":
      return `${check} Why so few: ${raiser} raises with only ${openerShare !== null ? `about ${pct(openerShare)} of hands, their best` : "good hands"}. You want hands that are often ahead of theirs.`;
    case "vs-3bet":
      return `${check} Why so few: a re-raise usually means a very strong hand.`;
    case "vs-4bet":
      return `${check} Why so few: two raises before you mean the very best hands.`;
  }
}

const SITUATION = {
  "rfi": "raising when nobody has raised before you",
  "vs-limp": "raising after players only called",
  "vs-open": "playing against a raise",
  "vs-3bet": "playing after your raise is re-raised",
  "vs-4bet": "playing after a raise and a re-raise",
} as const;

/** What the percentage is made of: "of all 1,326 starting hands, 370 are worth raising after players only called. They are ...". */
export function chartMakeup(g: Graded): string {
  if (g.basis.kind !== "chart") return "";
  const { listSize, allHands, groups, otherCombos, spot } = g.basis;
  return `of all ${allHands.toLocaleString("en-US")} starting hands (${listSize}) are worth ${SITUATION[spot]}. They are ${breakdown(groups, otherCombos)}.`;
}

export function drawLine(g: Graded): string | null {
  const d = g.draw;
  if (!d) return null;
  const by = d.multiplier === 4 ? "by the river" : "on the river";
  return `You have a ${d.name}: ${d.outs} cards help you. Quick rule: ${d.outs} × ${d.multiplier} ≈ ${pct(d.estimate)} to hit ${by}.`;
}
