import { prettyClass } from "../cards/card";
import type { Opponents } from "../bots/opponents";
import type { PlayerAction } from "../engine/types";
import { aggressive, type ActionValue, type Graded } from "../grading/types";
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

export function chartKeyPoint(g: Graded, opponents: Opponents, describe: (a: PlayerAction) => string): string {
  if (g.basis.kind !== "chart") return "";
  const { spot, position, opener, bestMove, raiseShare, callShare, continueShare, borderline, oversized, behind } = g.basis;
  const hand = prettyClass(g.basis.handClass);
  if (oversized) return `Right idea, wrong size: ${describe(g.best)}, not ${describe(g.action)}. A raise that big only gets called by hands that beat you.`;
  const verdict = g.verdict === "good" ? `${hand} is ${MOVE_WORD[bestMove]} here`
    : borderline && spot === "vs-limp" ? `${hand} is just outside, so this is close. It is a usual raise when nobody has called yet`
    : borderline ? `${hand} is just outside, so this is close. It becomes a raise from a later seat`
    : `${hand} should be ${MOVE_WORD[bestMove]} here`;
  const fold = position === "BB" && spot === "vs-limp" ? "check" : "fold";
  const raiser = g.basis.openerSeat !== null ? opponents[g.basis.openerSeat]?.name : undefined;
  const from = opener ? `${raiser ? `${raiser}, in ` : ""}the ${seatName(opener)} seat` : "an earlier seat";
  const ahead = bestMove === "fold" && g.win.chance >= 0.5 && behind > 0
    ? ` Being ahead of one random hand is not enough: ${behind} player${behind > 1 ? "s" : ""} still act${behind > 1 ? "" : "s"} after you, and they only keep playing with good hands.`
    : "";
  switch (spot) {
    case "rfi": return `When everyone before you folds and you sit in the ${seatName(position)} seat, raise about ${pct(raiseShare)} of hands and fold the rest. ${verdict}.${ahead}`;
    case "vs-limp": return `When players have only called the big blind, raise about ${pct(raiseShare)} of hands to take the pot from them and ${fold} the rest. ${verdict}.${ahead}`;
    case "vs-open": return `Facing a raise from ${from}, re-raise about ${pct(raiseShare)} of hands${callShare > 0 ? `, call about ${pct(callShare)}` : ""}, and fold the rest. ${verdict}.${ahead}`;
    case "vs-3bet": return `When your raise gets re-raised, raise again with about ${pct(raiseShare)} of hands, call about ${pct(callShare)}, and fold the rest. ${verdict}.`;
    case "vs-4bet": return `After a raise and a re-raise, only the best ${pct(continueShare)} of hands keep playing. ${verdict}.`;
  }
}

export function drawLine(g: Graded): string | null {
  const d = g.draw;
  if (!d) return null;
  const by = d.multiplier === 4 ? "by the river" : "on the river";
  return `You have a ${d.name}: ${d.outs} cards help you. Quick rule: ${d.outs} × ${d.multiplier} ≈ ${pct(d.estimate)} to hit ${by}.`;
}
