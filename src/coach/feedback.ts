import type { Opponents } from "../bots/opponents";
import type { PlayerAction, Street } from "../engine/types";
import type { MixShare } from "../grading/rangeMix";
import { aggressive, type Grade, type Graded, type Verdict, type Win } from "../grading/types";
import { preflopStats, preflopText, preflopWhy } from "./preflop";
import { drawLine, evRule, evSummary, pct, quotedBet } from "./reasons";
import { allInLabel, dollars, money, seatName, signedMoney } from "./words";

/** A number, a short name for it, and one line on what it is made of: "28%  Needed to call  $29 ÷ $102". */
export interface Stat {
  readonly value: string;
  readonly label: string;
  readonly detail: string;
}

export interface Feedback {
  readonly tone: Verdict | "ungraded";
  /** What you did and what you faced, since play may have moved on. */
  readonly context: string;
  readonly headline: string;
  /** Before the flop: the rule for this spot, shown above the summary. */
  readonly lead: string | null;
  /** One short line with the reason that decided it. Everything else sits behind "More detail". */
  readonly summary: string;
  /** At most three numbers, the ones the decision turned on. Chance to win comes first. */
  readonly stats: readonly Stat[];
  readonly mix: readonly MixShare[] | null;
  /** The one thing to remember, with its tag: "Why so few", "Quick check" or "Rule". */
  readonly keyLabel: string;
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
    : `${opponents[f.by]?.name ?? "their"}'s ${g.street === "preflop" || g.committed > 0 ? "raise to" : "bet of"} ${money(f.to, bb)}`;
  const a = g.action;
  const did = a.type === "fold" ? `you folded${faced ? ` to ${faced}` : ""}`
    : a.type === "check" ? "you checked"
    : a.type === "call" ? `you called ${faced || "the bet"}${f && g.committed > 0 ? `, adding ${money(f.call, bb)}` : ""}`
    : a.to === g.allInTo ? `you went all-in for ${money(a.to, bb)}${faced ? ` over ${faced}` : ""}`
    : a.type === "bet" ? `you bet ${money(a.to, bb)}`
    : `you raised to ${money(a.to, bb)}${faced ? ` over ${faced}` : ""}`;
  return `${STREET[g.street]}, ${did}.`;
}

const kindOf = (a: PlayerAction) => (a.type === "fold" ? "fold" : aggressive(a) ? "aggressive" : "passive");

function headline(g: Graded, bb: number): string {
  const best = capital(describeAction(g.best, bb, g.allInTo));
  switch (g.verdict) {
    case "good":
      if (g.action.type === "call" && g.basis.kind === "ev" && g.basis.potOddsNeeded !== null && g.basis.equity < g.basis.potOddsNeeded) return "Close. Call is fine";
      if (kindOf(g.action) !== kindOf(g.best)) return `Close call. ${capital(g.action.type)} and ${g.best.type} are about even`;
      return `Good ${g.action.type === "bet" || g.action.type === "raise" ? (g.action.to === g.allInTo ? "all-in" : g.action.type) : g.action.type}`;
    case "small": return aggressive(g.action) && aggressive(g.best) ? `Right idea. ${best} was better` : `Close. ${best} was slightly better`;
    case "mistake": return aggressive(g.action) && aggressive(g.best) ? `Right idea, wrong size. ${best} was better` : `Mistake. ${best} was better`;
    case "blunder": return `Big mistake. ${best} was much better`;
  }
}

/** The style's description without its advice, which can disagree with this spot's grade. */
const firstSentence = (s: string) => s.slice(0, s.indexOf(".") + 1);

export function feedback(g: Grade, opponents: Opponents, bb: number): Feedback {
  if (!g.graded) {
    const ctx = `${STREET[g.street]}, you chose ${describeAction(g.action, bb)}.`;
    return { tone: "ungraded", context: ctx, headline: "Not graded", lead: null, summary: g.reason, stats: [], mix: null, keyLabel: "Why", keyPoint: g.reason, draw: null, read: null, details: [], caveats: [] };
  }
  const describe = (a: PlayerAction) => describeAction(a, bb, g.allInTo);
  // After the flop: measured against the hands their play points to, shown in "What they likely have".
  const names = g.win.against.map((seat) => opponents[seat]?.name ?? "a player");
  const who = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const win: Stat = {
    value: pct(g.win.chance),
    label: `Your chance vs ${who}`,
    detail: `${g.street === "river" ? "Right now" : "Once all the cards are out"}, against ${names.length === 1 ? "their" : "each one's"} likely hands (below).`,
  };
  const cost: Stat[] = g.verdict !== "good" && g.evLossBB !== null
    ? [{ value: `−${dollars(g.evLossBB)}`, label: "Cost of this choice", detail: "On average, compared with the best play." }]
    : [];
  const base = { tone: g.verdict, context: context(g, opponents, bb), headline: headline(g, bb) };
  if (g.basis.kind === "chart") {
    const text = preflopText(g, opponents, describe);
    const why = preflopWhy(g, opponents);
    return {
      ...base, mix: null, read: null, draw: null, details: [g.basis.source], caveats: [],
      lead: text.lead, summary: text.summary, stats: preflopStats(g, opponents), keyLabel: why.label, keyPoint: why.text,
    };
  }
  const b = g.basis;
  const bet = quotedBet(g);
  const fold = bet?.foldShare ?? null;
  const price = g.facing;
  const opp = opponents[b.villain];
  const them = b.opponents > 1 ? "everyone" : opp?.name ?? "they";
  const second: Stat = b.potOddsNeeded !== null && price && !(aggressive(g.action) && aggressive(g.best))
    ? { value: pct(b.potOddsNeeded), label: "Needed to call", detail: `${money(price.call, bb)} ÷ ${money(price.potAfter, bb)} (your call ÷ the pot after you call).` }
    : { value: fold === null ? "–" : pct(fold), label: bet && "to" in bet.action ? `${capital(them)} folds to ${bet.action.type === "bet" ? `a ${money(bet.action.to, bb)} bet` : `a raise to ${money(bet.action.to, bb)}`}` : "They fold to a bet", detail: "You win the pot at once." };
  const rule = evRule(g);
  return {
    ...base, mix: b.mix, draw: drawLine(g),
    summary: evSummary(g, opp?.name, describe, (chips) => money(chips, bb)),
    lead: null, stats: [win, second, ...cost], keyLabel: rule.label, keyPoint: rule.text,
    read: opp ? `${opp.name} plays like a ${opp.style.name.toLowerCase()}: ${firstSentence(opp.style.leak).toLowerCase()}${opp.style.id === "lag" && g.best.type === "fold" ? " Even so, your hand beats few of the hands their bets point to this time (see above)." : ""}` : null,
    details: [
      `Their actions narrow them to about ${b.rangeSize} likely hands.`,
      ...b.values.map((v) => `${capital(describe(v.action))}: ${signedMoney(v.evBB * bb, bb)} on average`),
    ],
    caveats: b.approximations,
  };
}

export const feedbackText = (f: Feedback) =>
  [f.context, f.headline, f.summary, f.lead ?? "", ...f.stats.map((s) => `${s.value} ${s.label} ${s.detail}`), f.keyPoint, f.draw ?? "", f.read ?? "", ...f.details, ...f.caveats].join(" ");
