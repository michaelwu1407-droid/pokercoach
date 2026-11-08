import { prettyClass } from "../cards/card";
import type { Opponents } from "../bots/opponents";
import type { PlayerAction, Street } from "../engine/types";
import type { MixShare } from "../grading/rangeMix";
import { aggressive, type Grade, type Graded, type Verdict, type Win } from "../grading/types";
import { chartKeyPoint, drawLine, evKeyPoint, pct, quotedBet } from "./reasons";
import { allInLabel, dollars, money, seatName, signedMoney } from "./words";

export interface Feedback {
  readonly tone: Verdict | "ungraded";
  /** What you did and what you faced, since play may have moved on. */
  readonly context: string;
  readonly headline: string;
  /** One short line with the number that decided it. Everything else sits behind "More detail". */
  readonly summary: string;
  /** At most three numbers, the ones the decision turned on. Chance to win comes first. */
  readonly stats: readonly { readonly label: string; readonly value: string }[];
  readonly mix: readonly MixShare[] | null;
  /** The one thing to remember, specific to this spot. */
  readonly keyPoint: string;
  /** The quick in-your-head estimate for a draw: outs times 4 on the flop, times 2 on the turn. */
  readonly draw: string | null;
  /** Who you were up against. Reveals the style the table hides. */
  readonly read: string | null;
  readonly details: readonly string[];
  readonly caveats: readonly string[];
}

const STREET: Record<Street, string> = {
  preflop: "Before the flop", flop: "On the flop", turn: "On the turn (the fourth card)", river: "On the river (the last card)",
};

const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** "raise to $7.50", "bet $4", "call", or "all-in $100" when the amount is your whole stack. */
export function describeAction(a: PlayerAction, bigBlind: number, allInTo?: number): string {
  if ((a.type === "bet" || a.type === "raise") && a.to === allInTo) return allInLabel(a.to, bigBlind).toLowerCase();
  if (a.type === "bet") return `bet ${money(a.to, bigBlind)}`;
  if (a.type === "raise") return `raise to ${money(a.to, bigBlind)}`;
  return a.type;
}

/** "Before the flop, you called Hana's raise to $4.50." */
function context(g: Graded, opponents: Opponents, bb: number): string {
  const f = g.facing;
  const faced = !f ? "" : f.by === null ? `the ${money(f.to, bb)} big blind`
    : `${opponents[f.by]?.name ?? "their"}'s ${g.street === "preflop" ? "raise to" : "bet of"} ${money(f.to, bb)}`;
  const a = g.action;
  const did = a.type === "fold" ? `you folded${faced ? ` to ${faced}` : ""}`
    : a.type === "check" ? "you checked"
    : a.type === "call" ? `you called ${faced || "the bet"}`
    : a.to === g.allInTo ? `you went all-in for ${money(a.to, bb)}`
    : a.type === "bet" ? `you bet ${money(a.to, bb)}`
    : `you raised to ${money(a.to, bb)}${faced ? ` over ${faced}` : ""}`;
  return `${STREET[g.street]}, ${did}.`;
}

function headline(g: Graded, bb: number): string {
  const best = capital(describeAction(g.best, bb, g.allInTo));
  switch (g.verdict) {
    case "good": return `Good ${g.action.type === "bet" || g.action.type === "raise" ? (g.action.to === g.allInTo ? "all-in" : g.action.type) : g.action.type}`;
    case "small": return aggressive(g.action) && aggressive(g.best) ? `Right idea. ${best} was better` : `Close. ${best} was slightly better`;
    case "mistake": return `Mistake. ${best} was better`;
    case "blunder": return `Big mistake. ${best} was much better`;
  }
}

function winLabel(w: Win, opponents: Opponents): string {
  if (w.against.length === 0) return "Chance to win vs a random hand";
  if (w.against.length === 1) return `Chance to win vs ${opponents[w.against[0]!]?.name ?? "1 player"}`;
  return `Chance to win vs ${w.against.length} players`;
}

export function feedback(g: Grade, opponents: Opponents, bb: number): Feedback {
  if (!g.graded) {
    const ctx = `${STREET[g.street]}, you chose ${describeAction(g.action, bb)}.`;
    return { tone: "ungraded", context: ctx, headline: "Not graded", summary: g.reason, stats: [], mix: null, keyPoint: g.reason, draw: null, read: null, details: [], caveats: [] };
  }
  const describe = (a: PlayerAction) => describeAction(a, bb, g.allInTo);
  const win = { label: winLabel(g.win, opponents), value: pct(g.win.chance) };
  const cost = g.verdict !== "good" && g.evLossBB !== null ? [{ label: "Cost on average", value: `−${dollars(g.evLossBB)}` }] : [];
  const base = { tone: g.verdict, context: context(g, opponents, bb), headline: headline(g, bb) };
  if (g.basis.kind === "chart") {
    const hand = prettyClass(g.basis.handClass);
    return {
      ...base, mix: null, read: null, draw: null, details: [g.basis.source], caveats: [],
      summary: `${capital(hand)} is ${g.basis.bestMove === "raise" ? "a raise" : g.basis.bestMove === "call" ? "a call" : "a fold"} from the ${seatName(g.basis.position)} seat, where about ${pct(g.basis.continueShare)} of hands keep playing.`,
      stats: [{ label: "Your hand", value: hand }, win, { label: "Hands that keep playing here", value: pct(g.basis.continueShare) }],
      keyPoint: chartKeyPoint(g, opponents, describe),
    };
  }
  const b = g.basis;
  const bet = quotedBet(g);
  const fold = bet?.foldShare ?? null;
  const foldLine = fold === null || fold < 0.05 ? "They almost never fold to a bet." : `They fold to ${describe(bet!.action)} ${pct(fold)} of the time.`;
  const second = b.potOddsNeeded !== null
    ? { label: "Needed to call", value: pct(b.potOddsNeeded) }
    : { label: "They fold to a bet", value: fold === null || fold < 0.05 ? "rarely" : pct(fold) };
  const opp = opponents[b.villain];
  return {
    ...base, mix: b.mix, draw: drawLine(g),
    summary: b.potOddsNeeded !== null
      ? `You had a ${pct(g.win.chance)} chance to win and needed ${pct(b.potOddsNeeded)} to call.`
      : `You had a ${pct(g.win.chance)} chance to win. ${foldLine}`,
    stats: [win, second, ...cost],
    keyPoint: evKeyPoint(g, describe),
    read: opp ? `${opp.name} plays like a ${opp.style.name.toLowerCase()}. ${opp.style.leak}` : null,
    details: [
      `Their actions narrow them to about ${b.rangeSize} likely hands.`,
      ...b.values.map((v) => `${capital(describe(v.action))}: ${signedMoney(v.evBB * bb, bb)} on average`),
    ],
    caveats: b.approximations,
  };
}

export const feedbackText = (f: Feedback) =>
  [f.context, f.headline, f.summary, ...f.stats.map((s) => `${s.label} ${s.value}`), f.keyPoint, f.draw ?? "", f.read ?? "", ...f.details, ...f.caveats].join(" ");
