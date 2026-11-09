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
  const fold = bet?.foldShare ?? 0;
  const called = bet?.winWhenCalled ?? null;
  const multi = g.basis.opponents > 1;
  const whenCalled = called === null ? "" : multi ? `, and against whoever calls you win ${pct(called)}` : `, and when called you win ${pct(called)}`;
  if (need !== null && kind !== "aggressive") {
    const n = pct(need);
    if (kind === "fold" && equity < need) return `You win ${eq} of the time, but calling needs ${n}: fold.`;
    if (kind === "fold") return `You win ${eq}, about the ${n} a call needs, but ${them} keeps betting on later cards, so calling costs more than it wins: fold.`;
    if (equity >= need) return `You win ${eq} of the time and calling needs only ${n}: call.`;
    if (g.street === "river") return `You are a little short of the ${n} a call needs (you win ${eq}), so calling and folding are about even.`;
    return `You are a little short of the ${n} a call needs (you win ${eq}), but when you hit you can win extra bets later: call.`;
  }
  if (kind === "aggressive" && bet) {
    const move = describe(bet.action);
    if (called !== null && called < BLUFF_BELOW && bet.foldNeeded !== undefined && bet.risk !== undefined && bet.potWithBet !== undefined) {
      return `${called < 0.005 ? "You never win if called" : `You rarely win if called (${pct(called)})`}, so this is a bluff. Risking ${money(bet.risk)} to win the ${money(g.pot)} pot pays off if ${them} folds more than ${money(bet.risk)} ÷ ${money(bet.potWithBet)} (your bet plus the pot) = ${pct(bet.foldNeeded)} of the time. ${capital(them)} folds ${pct(fold)}: ${move}.`;
    }
    if (fold < 0.3 && (called ?? equity) >= 0.5)
      return `${capital(move)}: ${them} ${fold < 0.005 ? "never folds" : `rarely folds (${pct(fold)})`} but calls with worse hands, and when called you win ${pct(called ?? equity)}.`;
    if (g.basis.opponents > 1 && equity > g.fairShare && fold < 0.3)
      return `${capital(move)}: with ${g.basis.opponents} opponents an even share of the pot is ${pct(g.fairShare)}, and you win ${pct(equity)}. You win more than your share, so the more money goes in, the more you make.`;
    const stronger = called !== null && called < equity - 0.05 ? " (the hands that call are stronger than the ones that fold)" : "";
    return `${capital(move)}: ${them} folds ${pct(fold)} of the time${whenCalled}${stronger}.`;
  }
  if (called === null) return `Your chance to win is ${eq}: check.`;
  if (equity >= 0.5) return `You are ahead (${eq}), but a bet mostly makes weaker hands fold: check and let them stay in.`;
  if (bet && bet.foldNeeded !== undefined && bet.risk !== undefined && bet.potWithBet !== undefined && called < 0.5 && fold > 0.005) {
    const needs = `${capital(describe(bet.action))} needs ${them} to fold more than ${money(bet.risk)} ÷ ${money(bet.potWithBet)} (your bet plus the pot) = ${pct(bet.foldNeeded)} of the time.`;
    if (fold <= bet.foldNeeded) return `${needs} ${capital(them)} folds only ${pct(fold)}, and when called you win just ${pct(called)}: check.`;
    // Enough folds on paper, yet checking is worth more: their raises and calls cost more than the folds win.
    return `${needs} ${capital(them)} folds ${pct(fold)}, but when ${them} does not fold they often raise or have you beaten, so over all their answers a bet earns less than checking (each option's value is under "How this was worked out"): check.`;
  }
  return `A bet ${fold < 0.005 ? `never makes ${them} fold` : `makes ${them} fold ${fold < 0.4 ? "only " : ""}${pct(fold)} of the time`}, and when called you win just ${pct(called)}${called < equity - 0.03 ? ", because mostly better hands call" : ""}: check.`;
}

const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** The specific reason for this decision, in one or two sentences. Shown as the card's summary. */
export function evSummary(g: Graded, name: string | undefined, describe: (a: PlayerAction) => string, money: Money): string {
  const chosen = kindOf(g.action);
  const best = kindOf(g.best);
  const mine = betStats(g, g.action);
  if (g.verdict === "good" && chosen !== best) return reason(g, chosen, mine ?? quotedBet(g), name, describe, money);
  if (chosen === "passive" && best === "aggressive" && g.basis.kind === "ev" && g.basis.potOddsNeeded !== null && g.basis.equity >= g.basis.potOddsNeeded)
    return `Calling was fine (you win ${pct(g.basis.equity)}, a call needs ${pct(g.basis.potOddsNeeded)}), but raising wins more. ${reason(g, best, quotedBet(g), name, describe, money)}`;
  if (g.verdict === "good") return reason(g, chosen, mine ?? quotedBet(g), name, describe, money);
  if (chosen === "aggressive" && best === "aggressive") {
    const a = betStats(g, g.best), b = mine;
    const line = (v: ActionValue) => `${describe(v.action)} ${(v.foldShare ?? 0) < 0.005 ? "gets no folds" : `makes ${who(g, name)} fold ${pct(v.foldShare ?? 0)}`}${v.winWhenCalled === null ? "" : ` and wins ${pct(v.winWhenCalled)} when called`}`;
    const to = (v: ActionValue) => ("to" in v.action ? v.action.to : 0);
    const bigger = a && b && to(a) > to(b);
    const moreFolds = a && b && (a.foldShare ?? 0) > (b.foldShare ?? 0) + 0.05;
    const bluff = (a?.winWhenCalled ?? 1) < BLUFF_BELOW;
    const fewFold = a && b && (a.foldShare ?? 0) < 0.15 && (b.foldShare ?? 0) < 0.15;
    const lesson = !a || !b ? ""
      : bluff ? ` As a bluff, the ${bigger ? "bigger" : "smaller"} bet ${moreFolds ? "gets more folds" : "risks less for about the same folds"}.`
      : bigger ? ` ${fewFold ? "Few fold either way" : "They still call with worse hands"}, so the bigger bet wins more.`
      : " The smaller bet keeps more worse hands calling.";
    const both = a && b ? ` ${capital(line(a))}; ${line(b)}.${lesson}` : "";
    const share = g.basis.kind === "ev" && g.basis.opponents > 1 && g.basis.equity > g.fairShare && g.basis.equity < 0.5
      ? ` Why raise at all: with ${g.basis.opponents} opponents an even share of the pot is ${pct(g.fairShare)}, and you win ${pct(g.basis.equity)}, so the more money goes in, the more you make.`
      : "";
    return `${capital(describe(g.best))} earns about ${dollars(g.evLossBB!)} more on average than ${describe(g.action)}.${both}${share}`;
  }
  if (chosen === "aggressive" && mine && best === "passive" && g.basis.kind === "ev" && g.basis.equity >= 0.5) {
    return `You are ahead (${pct(g.basis.equity)}), but your ${describe(g.action)} makes ${who(g, name)} fold ${pct(mine.foldShare ?? 0)} of the time: the hands you beat fold, so you win less. ${g.best.type === "check" ? "Check" : "Call"} and let them stay in.`;
  }
  if (chosen === "aggressive" && mine) {
    const f = mine.foldShare ?? 0;
    const why = `Your ${describe(g.action)} ${f < 0.005 ? `never makes ${who(g, name)} fold` : `makes ${who(g, name)} fold ${f < 0.4 ? "only " : ""}${pct(f)} of the time`}${mine.winWhenCalled === null ? "" : `, and when called you win ${mine.winWhenCalled < 0.5 ? "just " : ""}${pct(mine.winWhenCalled)}`}.`;
    if (best === "passive" && g.best.type === "call" && g.facing && mine.risk !== undefined)
      return `${why} A call risks ${money(g.facing.call)} instead of ${money(mine.risk)} for about the same chance: call.`;
    if (best === "passive") return `${why} Check.`;
    if (best === "fold") return `${why} Fold.`;
    return `${why} ${reason(g, best, quotedBet(g), name, describe, money)}`;
  }
  return reason(g, best, quotedBet(g), name, describe, money);
}

/** A check to reuse at any table, matched to the kind of decision. Shown as the key point. */
export function evRule(g: Graded): string {
  if (g.basis.kind !== "ev") return "";
  const best = kindOf(g.best);
  const bet = quotedBet(g);
  if (g.basis.potOddsNeeded !== null && best !== "aggressive")
    return `Quick check when facing a bet: a half-pot bet needs ${pct(CALL_GUIDE.halfPot)} to call, a pot-size bet ${pct(CALL_GUIDE.fullPot)}. Call when your chance to win is bigger.`;
  if (best === "aggressive" && bet?.winWhenCalled !== null && bet?.winWhenCalled !== undefined && bet.winWhenCalled < BLUFF_BELOW)
    return `Quick check for a bluff: a half-pot bet must make them fold ${pct(BLUFF_GUIDE.halfPot)} of the time, a pot-size bet ${pct(BLUFF_GUIDE.fullPot)}. Bluff players who fold often.`;
  if (best !== "aggressive" && g.basis.equity >= 0.5)
    return "Rule: when you are well ahead and a bet makes them fold most of the time, check and let them catch up a little. Bet again when worse hands will call.";
  return "Rule: bet when worse hands will call or better hands will fold. If neither, check.";
}

export function drawLine(g: Graded): string | null {
  const d = g.draw;
  if (!d) return null;
  const by = d.multiplier === 4 ? "by the river" : "on the river";
  return `You have a ${d.name}: ${d.outs} cards help you. Quick rule: ${d.outs} × ${d.multiplier} ≈ ${pct(d.estimate)} to hit ${by}.`;
}
