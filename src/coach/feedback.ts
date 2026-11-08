import { prettyClass } from "../cards/card";
import type { Opponents } from "../bots/opponents";
import type { PlayerAction } from "../engine/types";
import type { MixShare } from "../grading/rangeMix";
import type { Grade, Graded, Verdict, Win } from "../grading/types";
import type { Concept } from "../learn/concepts";
import { dollars, money, seatName, signedMoney } from "./words";

export interface Feedback {
  readonly tone: Verdict | "ungraded";
  /** Which decision this is about, since play may have moved on. */
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
  readonly skill: string | null;
  readonly details: readonly string[];
  readonly caveats: readonly string[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const aggressive = (a: PlayerAction) => a.type === "bet" || a.type === "raise";

export function describeAction(a: PlayerAction, bigBlind: number): string {
  if (a.type === "bet") return `bet ${money(a.to, bigBlind)}`;
  if (a.type === "raise") return `raise to ${money(a.to, bigBlind)}`;
  return a.type;
}

const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function headline(g: Graded, bigBlind: number): string {
  const best = capital(describeAction(g.best, bigBlind));
  switch (g.verdict) {
    case "good": return `Good ${g.action.type}`;
    case "small": return aggressive(g.action) && aggressive(g.best) ? `Right idea. ${best} was better` : `Close. ${best} was slightly better`;
    case "mistake": return `Mistake. ${best} was better`;
    case "blunder": return `Big mistake. ${best} was much better`;
  }
}

const winLabel = (w: Win) => w.against === 0 ? "Chance to win vs a random hand" : `Chance to win vs ${w.against} player${w.against > 1 ? "s" : ""}`;

type Kind = "fold" | "passive" | "aggressive";
const kindOf = (a: PlayerAction): Kind => (a.type === "fold" ? "fold" : aggressive(a) ? "aggressive" : "passive");

/** Why one kind of play is right here, in the spot's own numbers. */
function why(g: Graded, kind: Kind): string {
  if (g.basis.kind !== "ev") return "";
  const { equity, potOddsNeeded: need, foldToBet: fold, equityWhenCalled: called, opponents } = g.basis;
  const eq = pct(equity);
  const against = opponents > 1 ? `the ${opponents} players still in` : "the hands they bet with";
  const folds = fold === null ? "they rarely fold" : opponents > 1 ? `everyone folds ${pct(fold)} of the time` : `they fold ${pct(fold)} of the time`;
  const rarely = fold !== null && fold < 0.05;
  const keepPlaying = called === null ? "" : `, and against the hands that keep playing you still win ${pct(called)} of the time`;
  if (need !== null) {
    const n = pct(need);
    if (kind === "fold" && eq === n) return `Calling needed a ${n} chance to win and you had exactly that, while they keep betting on later cards. Calling loses in the end, so fold.`;
    if (kind === "fold" && equity >= need) return `You had a ${eq} chance, above the ${n} needed, but they keep betting on later cards, so calling now costs more than it wins. Fold.`;
    if (kind === "fold") return `Calling needed a ${n} chance to win. You had ${eq} against ${against}, so folding saves money.`;
    if (kind === "passive" && equity < need && eq !== n)
      return `You had a ${eq} chance, below the ${n} needed, but calling still pays once the next betting round is counted: you can win more later, either when your hand improves or when they stop betting and you take the pot.`;
    if (kind === "passive") return `Calling needed a ${n} chance to win and you had ${eq}, so calling makes money over time.`;
    return rarely ? `Raising earns most even though they rarely fold${keepPlaying}.` : `Raising earns most: ${folds} to a raise${keepPlaying}.`;
  }
  if (kind === "aggressive") return rarely ? `Betting earns most even though they rarely fold${keepPlaying}, so weaker hands pay you.` : `Betting works: ${folds}${keepPlaying}.`;
  if (called === null || fold === null) return `Checking is better here. Your chance to win is ${eq}.`;
  if (equity >= 0.5)
    return `Checking is better. You are ahead with a ${eq} chance to win, and a bet would make ${pct(fold)} of their hands fold, mostly hands you already beat. Checking keeps them in so they can bet or call later.`;
  if (rarely) return `Checking is better. They almost never fold to a bet here, and against the hands that keep playing you win just ${pct(called)}.`;
  return `Checking is better. A bet makes only ${pct(fold)} of their hands fold, and against the ones that keep playing you win just ${pct(called)}.`;
}

function evKeyPoint(g: Graded, bigBlind: number): string {
  const chosen = kindOf(g.action);
  const best = kindOf(g.best);
  if (g.verdict === "good") return why(g, chosen);
  if (chosen === "aggressive" && best === "aggressive" && "to" in g.action && "to" in g.best) {
    const bigger = g.best.to > g.action.to ? "A bigger" : "A smaller";
    return `Right idea, wrong size. ${bigger} amount, ${describeAction(g.best, bigBlind)}, earns about ${dollars(g.evLossBB!)} more on average. ${why(g, "aggressive")}`;
  }
  return why(g, best);
}

const MOVE_WORD = { raise: "a raise", call: "a call", fold: "a fold" } as const;

function chartKeyPoint(g: Graded, opponents: Opponents): string {
  if (g.basis.kind !== "chart") return "";
  const { spot, position, opener, bestMove, raiseShare, callShare, continueShare, borderline } = g.basis;
  const hand = prettyClass(g.basis.handClass);
  const verdict = g.verdict === "good" ? `${hand} is ${MOVE_WORD[bestMove]} here`
    : borderline && spot === "vs-limp" ? `${hand} is just outside, so this is close. It is a standard raise when nobody has called yet`
    : borderline ? `${hand} is just outside, so this is close. It becomes a raise from a later seat`
    : `${hand} should be ${MOVE_WORD[bestMove]} here`;
  const fold = position === "BB" && spot === "vs-limp" ? "check" : "fold";
  const raiser = g.basis.openerSeat !== null ? opponents[g.basis.openerSeat]?.name : undefined;
  const from = opener ? `${raiser ? `${raiser}, in ` : ""}the ${seatName(opener)} seat` : "an earlier seat";
  switch (spot) {
    case "rfi":
      return `When everyone before you folds and you sit in the ${seatName(position)} seat, raise about ${pct(raiseShare)} of hands and fold the rest. ${verdict}.`;
    case "vs-limp":
      return `When players have only called the big blind, raise about ${pct(raiseShare)} of hands to take the pot from them and ${fold} the rest. Just calling along lets them see cheap cards. ${verdict}.`;
    case "vs-open":
      return `Facing a raise from ${from}, re-raise about ${pct(raiseShare)} of hands${callShare > 0 ? `, call about ${pct(callShare)}` : ""}, and fold the rest. ${verdict}.`;
    case "vs-3bet":
      return `When your raise gets re-raised, raise again with about ${pct(raiseShare)} of hands, call about ${pct(callShare)}, and fold the rest. ${verdict}.`;
    case "vs-4bet":
      return `After a raise and a re-raise, only the best ${pct(continueShare)} of hands keep playing. ${verdict}.`;
  }
}

/** Explains folding a hand that is ahead of one random hand: the players behind are not random. */
function aheadButFold(g: Graded): string {
  if (g.basis.kind !== "chart" || g.basis.bestMove !== "fold" || g.win.chance < 0.5 || g.basis.behind === 0) return "";
  const k = g.basis.behind;
  return ` Being ahead of one random hand is not enough: ${k} player${k > 1 ? "s" : ""} still act${k > 1 ? "" : "s"} after you, and they only keep playing with good hands.`;
}

function drawLine(g: Graded): string | null {
  const d = g.draw;
  if (!d) return null;
  const by = d.multiplier === 4 ? "by the river" : "on the river";
  return `You have a ${d.name}: ${d.outs} cards help you. Quick rule: ${d.outs} × ${d.multiplier} ≈ ${pct(d.estimate)} to hit ${by}.`;
}

export function feedback(g: Grade, concepts: readonly Concept[], opponents: Opponents, bigBlind: number): Feedback {
  const skill = concepts[0]?.title ?? null;
  const context = `Your ${g.street} decision: ${describeAction(g.action, bigBlind)}`;
  if (!g.graded) {
    return { tone: "ungraded", context, headline: "Not graded", summary: g.reason, stats: [], mix: null, keyPoint: g.reason, draw: null, read: null, skill, details: [], caveats: [] };
  }
  const win = { label: winLabel(g.win), value: pct(g.win.chance) };
  const cost = g.verdict !== "good" && g.evLossBB !== null ? [{ label: "Cost on average", value: `−${dollars(g.evLossBB)}` }] : [];
  if (g.basis.kind === "chart") {
    return {
      tone: g.verdict, context, headline: headline(g, bigBlind), mix: null, read: null, skill, draw: null,
      summary: `${capital(prettyClass(g.basis.handClass))} is ${MOVE_WORD[g.basis.bestMove]} from the ${seatName(g.basis.position)} seat.`,
      stats: [{ label: "Your hand", value: prettyClass(g.basis.handClass) }, win, { label: "Hands that keep playing here", value: pct(g.basis.continueShare) }],
      keyPoint: chartKeyPoint(g, opponents) + aheadButFold(g), details: [g.basis.source], caveats: [],
    };
  }
  const b = g.basis;
  const second = b.potOddsNeeded !== null
    ? { label: "Needed to call", value: pct(b.potOddsNeeded) }
    : { label: "They fold to a bet", value: b.foldToBet === null ? "rarely" : pct(b.foldToBet) };
  const opp = opponents[b.villain];
  return {
    tone: g.verdict, context, headline: headline(g, bigBlind), mix: b.mix, skill, draw: drawLine(g),
    summary: b.potOddsNeeded !== null
      ? `You had a ${pct(g.win.chance)} chance to win and needed ${pct(b.potOddsNeeded)} to call.`
      : `You had a ${pct(g.win.chance)} chance to win. ${b.foldToBet === null || b.foldToBet < 0.05 ? "They almost never fold to a bet." : `They fold to a bet ${pct(b.foldToBet)} of the time.`}`,
    stats: [win, second, ...cost],
    keyPoint: evKeyPoint(g, bigBlind),
    read: opp ? `${opp.name} plays like a ${opp.style.name.toLowerCase()}. ${opp.style.leak}` : null,
    details: [
      `Their actions narrow them to about ${b.rangeSize} likely hands.`,
      ...b.values.map((v) => `${capital(describeAction(v.action, bigBlind))}: ${signedMoney(v.evBB * bigBlind, bigBlind)} on average`),
    ],
    caveats: b.approximations,
  };
}

export const feedbackText = (f: Feedback) =>
  [f.context, f.headline, f.summary, ...f.stats.map((s) => `${s.label} ${s.value}`), f.keyPoint, f.draw ?? "", f.read ?? "", ...f.details, ...f.caveats].join(" ");
