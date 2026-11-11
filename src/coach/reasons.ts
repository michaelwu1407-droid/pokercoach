import type { PlayerAction } from "../engine/types";
import { aggressive, type ActionValue, BLUFF_GUIDE, CALL_GUIDE, type Graded } from "../grading/types";
import { dollars } from "./words";

export const pct = (x: number) => `${Math.round(x * 100)}%`;

const sameAction = (a: PlayerAction, b: PlayerAction) => a.type === b.type && ("to" in a ? a.to : 0) === ("to" in b ? b.to : 0);

/** How they answer a particular bet: the one being discussed, not always the smallest. */
export function betStats(g: Graded, a: PlayerAction): ActionValue | null {
  if (g.basis.kind !== "ev" || !aggressive(a)) return null;
  return g.basis.values.find((v) => sameAction(v.action, a)) ?? null;
}

/** The bet whose numbers the card quotes: yours when it was good, else the recommended one, else the smallest offered. */
export function quotedBet(g: Graded): ActionValue | null {
  if (g.basis.kind !== "ev") return null;
  const first = g.verdict === "good" ? [g.action, g.best] : [g.best, g.action];
  return betStats(g, first[0]!) ?? betStats(g, first[1]!) ?? g.basis.values.find((v) => aggressive(v.action)) ?? null;
}

type Kind = "fold" | "passive" | "aggressive";
const kindOf = (a: PlayerAction): Kind => (a.type === "fold" ? "fold" : aggressive(a) ? "aggressive" : "passive");
/** Below this chance to win when called, a bet is a bluff: it works only through folds. */
const BLUFF_BELOW = 0.15;

/** Who answers a bet: their name heads-up, "everyone" in a bigger pot. */
const who = (g: Graded, name: string | undefined) => (g.basis.kind === "ev" && g.basis.opponents > 1 ? "everyone" : name ?? "they");

/** The one reason for a kind of play, in this spot's numbers, ending in the move. */
type Money = (chips: number) => string;

function reason(g: Graded, kind: Kind, bet: ActionValue | null, name: string | undefined, describe: (a: PlayerAction) => string, money: Money): string {
  if (g.basis.kind !== "ev") return "";
  const { equity, potOddsNeeded: need } = g.basis;
  const eq = pct(equity);
  const them = who(g, name);
  const They = capital(them);
  const fold = bet?.foldShare ?? 0;
  const called = bet?.winWhenCalled ?? null;
  if (need !== null && kind !== "aggressive") {
    const n = pct(need);
    if (kind === "fold" && equity < need) return `${equity < 0.005 ? "You can't win here" : `You win ${eq}`}. A call needs ${n}. Fold.`;
    if (kind === "fold") return `You win ${eq}, about what a call needs. But ${them} will keep betting. Fold.`;
    if (equity >= need) return `You win ${eq}. A call needs only ${n}. Call.`;
    if (g.street === "river") return `You win ${eq}. A call needs ${n}. Call and fold are about even.`;
    return `You win ${eq}, a bit under the ${n} a call needs. But if you hit, you can win more later. Call.`;
  }
  if (kind === "aggressive" && bet) {
    const move = capital(describe(bet.action));
    if (called !== null && called < BLUFF_BELOW && bet.foldNeeded !== undefined && bet.risk !== undefined && bet.potWithBet !== undefined) {
      const start = `${called < 0.005 ? "You can't win if called" : "You rarely win if called"}, so this is a bluff. It needs ${them} to fold ${pct(bet.foldNeeded)} of the time.`;
      return fold >= bet.foldNeeded ? `${start} ${They} folds ${pct(fold)}. ${move}.` : `${start} ${They} folds ${pct(fold)}, close enough. ${move}.`;
    }
    if (fold < 0.3 && (called ?? equity) >= 0.5)
      return `${They} ${fold < 0.005 ? "never folds" : "rarely folds"}, but calls with worse hands. You win ${pct(called ?? equity)} when called. ${move}.`;
    if (g.basis.opponents > 1 && equity > g.fairShare && fold < 0.3)
      return `With ${g.basis.opponents} opponents, a fair share is ${pct(g.fairShare)}. You win ${pct(equity)}, more than that. ${move}.`;
    return `${They} folds ${pct(fold)} of the time.${called === null ? "" : ` You win ${pct(called)} when called.`} ${move}.`;
  }
  if (called === null) return `You win ${eq}. Check.`;
  if (equity >= 0.5) return `You are ahead (${eq}). A bet scares off weaker hands. Check and keep them in.`;
  if (bet && bet.foldNeeded !== undefined && called < 0.5 && fold > 0.005) {
    const needs = `A bet needs ${them} to fold ${pct(bet.foldNeeded)} of the time.`;
    if (fold <= bet.foldNeeded) return `${needs} ${They} folds only ${pct(fold)}. Check.`;
    return `${needs} ${They} folds ${pct(fold)}, but often raises or beats you when staying in. Check.`;
  }
  return `A bet ${fold < 0.005 ? `never makes ${them} fold` : `makes ${them} fold only ${pct(fold)} of the time`}. You win just ${pct(called)} when called. Check.`;
}

const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** The specific reason for this decision, in short sentences. Shown as the card's summary. */
export function evSummary(g: Graded, name: string | undefined, describe: (a: PlayerAction) => string, money: Money): string {
  // The board is everyone's hand: the only question is whether a split is worth paying for.
  if (g.boardPlays) {
    const move = kindOf(g.best);
    const end = move === "fold" ? "Half the pot isn't worth the cost. Fold."
      : move === "aggressive" ? `A bet wins only if ${who(g, name)} folds. ${capital(describe(g.best))}.`
      : g.best.type === "call" ? "A call is cheap for half the pot. Call." : "Betting gains nothing. Check.";
    return `Everyone shares the board's hand. At best you split the pot. ${end}`;
  }
  return summaryText(g, name, describe, money);
}

function summaryText(g: Graded, name: string | undefined, describe: (a: PlayerAction) => string, money: Money): string {
  const chosen = kindOf(g.action);
  const best = kindOf(g.best);
  const mine = betStats(g, g.action);
  if (g.verdict === "good" && chosen !== best) return reason(g, chosen, mine ?? quotedBet(g), name, describe, money);
  if (chosen === "passive" && best === "aggressive" && g.basis.kind === "ev" && g.basis.potOddsNeeded !== null && g.basis.equity >= g.basis.potOddsNeeded)
    return `Calling was fine, but raising wins more. ${reason(g, best, quotedBet(g), name, describe, money)}`;
  if (g.verdict === "good") return reason(g, chosen, mine ?? quotedBet(g), name, describe, money);
  if (chosen === "aggressive" && best === "aggressive") {
    const a = betStats(g, g.best), b = mine;
    const to = (v: ActionValue) => ("to" in v.action ? v.action.to : 0);
    const bigger = a && b && to(a) > to(b);
    const moreFolds = a && b && (a.foldShare ?? 0) > (b.foldShare ?? 0) + 0.05;
    const bluff = (a?.winWhenCalled ?? 1) < BLUFF_BELOW;
    const why = !a || !b ? ""
      : bluff ? (moreFolds ? ` It gets more folds (${pct(a.foldShare ?? 0)} vs ${pct(b.foldShare ?? 0)}).` : " It gets about the same folds for less money.")
      : bigger ? " Worse hands still call the bigger bet." : " The smaller bet keeps worse hands calling.";
    return `${capital(describe(g.best))} earns about ${dollars(g.evLossBB!)} more on average than ${describe(g.action)}.${why}`;
  }
  if (chosen === "aggressive" && mine && best === "passive" && g.basis.kind === "ev" && g.basis.equity >= 0.5)
    return `You are ahead (${pct(g.basis.equity)}). Your bet scares off the hands you beat. ${g.best.type === "check" ? "Check" : "Call"} and keep them in.`;
  if (chosen === "aggressive" && mine) {
    const f = mine.foldShare ?? 0;
    const why = `Your ${describe(g.action)} ${f < 0.005 ? `never makes ${who(g, name)} fold` : `makes ${who(g, name)} fold only ${pct(f)} of the time`}.`;
    if (best === "passive" && g.best.type === "call" && g.facing && mine.risk !== undefined)
      return `${why} A call risks ${money(g.facing.call)}, not ${money(mine.risk)}, for about the same chance. Call.`;
    if (best === "passive") return `${why} Check.`;
    if (best === "fold") return `${why} Fold.`;
    return `${why} ${reason(g, best, quotedBet(g), name, describe, money)}`;
  }
  return reason(g, best, quotedBet(g), name, describe, money);
}

/** A check to reuse at any table, matched to the kind of decision, with its tag. Shown as the key point. */
export function evRule(g: Graded): { label: string; text: string } {
  if (g.basis.kind !== "ev") return { label: "", text: "" };
  const best = kindOf(g.best);
  const bet = quotedBet(g);
  if (g.basis.potOddsNeeded !== null && best !== "aggressive")
    return { label: "Quick check", text: `Facing a half-pot bet, you need ${pct(CALL_GUIDE.halfPot)} to call. Facing a pot-size bet, ${pct(CALL_GUIDE.fullPot)}.` };
  if (best === "aggressive" && bet?.winWhenCalled !== null && bet?.winWhenCalled !== undefined && bet.winWhenCalled < BLUFF_BELOW)
    return { label: "Quick check", text: `A half-pot bluff needs ${pct(BLUFF_GUIDE.halfPot)} folds. A pot-size bluff needs ${pct(BLUFF_GUIDE.fullPot)}. Bluff players who fold a lot.` };
  if (best !== "aggressive" && g.basis.equity >= 0.5)
    return { label: "Rule", text: "When you are far ahead, don't scare them off. Check, then bet when worse hands will call." };
  return { label: "Rule", text: "Bet when worse hands will call, or better hands will fold. Otherwise check." };
}

export function drawLine(g: Graded): string | null {
  const d = g.draw;
  if (!d) return null;
  const by = d.multiplier === 4 ? "by the river" : "on the river";
  return `You have a ${d.name}. ${d.outs} cards help you. Quick rule: ${d.outs} × ${d.multiplier} ≈ ${pct(d.estimate)} to hit ${by}.`;
}
