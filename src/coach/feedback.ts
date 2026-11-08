import type { Opponents } from "../bots/opponents";
import type { PlayerAction } from "../engine/types";
import type { MixShare } from "../grading/rangeMix";
import type { Grade, Verdict } from "../grading/types";
import type { Concept } from "../learn/concepts";

export interface Feedback {
  readonly tone: Verdict | "ungraded";
  /** Which decision this is about, since play may have moved on. */
  readonly context: string;
  readonly headline: string;
  /** At most three numbers. The ones the decision turned on. */
  readonly stats: readonly { readonly label: string; readonly value: string }[];
  readonly mix: readonly MixShare[] | null;
  /** The one thing to remember, specific to this spot. */
  readonly keyPoint: string;
  /** Who you were up against. Reveals the style the table hides. */
  readonly read: string | null;
  readonly skill: string | null;
  readonly details: readonly string[];
  readonly caveats: readonly string[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signedBB = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}bb`;
const NOUN = { fold: "fold", check: "check", call: "call", bet: "bet", raise: "raise" } as const;

export function describeAction(a: PlayerAction, bigBlind: number): string {
  if (a.type === "bet" || a.type === "raise") return `${a.type} ${(a.to / bigBlind).toFixed(1)}bb`;
  return a.type;
}

function headline(g: Graded, bigBlind: number): string {
  const best = describeAction(g.best, bigBlind);
  const cap = best[0]!.toUpperCase() + best.slice(1);
  switch (g.verdict) {
    case "good": return `Good ${NOUN[g.action.type]}`;
    case "small": return aggressive(g.action) && aggressive(g.best) ? `Right idea. ${cap} was better` : `Close. ${cap} was slightly better`;
    case "mistake": return `Mistake. ${cap} was better`;
    case "blunder": return `Big mistake. ${cap} was much better`;
  }
}

const aggressive = (a: PlayerAction) => a.type === "bet" || a.type === "raise";

type Graded = Extract<Grade, { graded: true }>;
type Kind = "fold" | "passive" | "aggressive";
const kindOf = (a: PlayerAction): Kind => (a.type === "fold" ? "fold" : aggressive(a) ? "aggressive" : "passive");

/** Why one kind of play is right here, in the spot's own numbers. */
function why(g: Graded, kind: Kind): string {
  if (g.basis.kind !== "ev") return "";
  const { equity, potOddsNeeded: need, foldToBet: fold, equityWhenCalled: called, opponents } = g.basis;
  const against = opponents > 1 ? `the ${opponents} players still in` : "the hands they bet with";
  const folds = fold === null ? "they rarely fold" : opponents > 1 ? `everyone folds ${pct(fold)} of the time` : `they fold ${pct(fold)} of the time`;
  const rarely = fold !== null && fold < 0.05;
  const whenCalled = called === null ? "" : `, and against the hands that continue you have ${pct(called)}`;
  if (need !== null) {
    if (kind === "fold" && pct(equity) === pct(need))
      return `You had ${pct(equity)}, right at the ${pct(need)} needed, and they keep betting on later cards, so calling loses in the end. Fold.`;
    if (kind === "fold" && equity >= need)
      return `You had ${pct(equity)}, above the ${pct(need)} needed, but they keep betting on later cards, so calling now costs more than it wins. Fold.`;
    if (kind === "fold") return `You needed ${pct(need)} to call but had ${pct(equity)} against ${against}, so folding saves chips.`;
    if (kind === "passive" && equity < need && pct(equity) !== pct(need))
      return `You had ${pct(equity)}, below the ${pct(need)} needed, but calling still pays: when the next card helps you, you win more from them later.`;
    if (kind === "passive") return `You needed ${pct(need)} to call and had ${pct(equity)} against ${against}, so calling makes money.`;
    return rarely ? `Raising earns most even though they rarely fold${whenCalled}.` : `Raising earns most: ${folds} to a raise${whenCalled}.`;
  }
  if (kind === "aggressive") return rarely ? `Betting earns most even though they rarely fold${whenCalled}, so worse hands pay you.` : `Betting works: ${folds}${whenCalled}.`;
  return called !== null && fold !== null
    ? `Checking is better. A bet folds out ${pct(fold)} of their hands, and the ones that continue leave you only ${pct(called)}.`
    : `Checking is better here. Your equity is ${pct(equity)}.`;
}

function evKeyPoint(g: Graded, bigBlind: number): string {
  const chosen = kindOf(g.action);
  const best = kindOf(g.best);
  if (g.verdict === "good") return why(g, chosen);
  if (chosen === "aggressive" && best === "aggressive" && "to" in g.action && "to" in g.best) {
    const bigger = g.best.to > g.action.to;
    return `Right idea, wrong size. ${bigger ? "A bigger" : "A smaller"} size, ${describeAction(g.best, bigBlind)}, earns about ${g.evLossBB!.toFixed(1)}bb more. ${why(g, "aggressive")}`;
  }
  return why(g, best);
}

const MOVE_WORD = { raise: "a raise", call: "a call", fold: "a fold" } as const;

function chartKeyPoint(g: Graded): string {
  if (g.basis.kind !== "chart") return "";
  const { spot, handClass, position, opener, bestMove, raiseShare, callShare, continueShare, borderline } = g.basis;
  const verdict = g.verdict === "good" ? `${handClass} is ${MOVE_WORD[bestMove]} here`
    : borderline && spot === "vs-limp" ? `${handClass} is just outside, so this is close. It is a standard open when nobody has limped`
    : borderline ? `${handClass} is just outside, so this is close. It becomes a raise one seat later`
    : `${handClass} should be ${MOVE_WORD[bestMove]} here`;
  const fold = position === "BB" && spot === "vs-limp" ? "check" : "fold";
  switch (spot) {
    case "rfi":
      return `When it folds to you in ${position}, open about ${pct(raiseShare)} of hands and fold the rest. ${verdict}.`;
    case "vs-limp":
      return `Against limpers, raise about ${pct(raiseShare)} of hands to punish them and ${fold} the rest. Limping behind gives up the initiative. ${verdict}.`;
    case "vs-open":
      return `Facing a raise from ${opener ?? "an earlier seat"}, re-raise about ${pct(raiseShare)} of hands${callShare > 0 ? `, call about ${pct(callShare)}` : ""}, and fold the rest. ${verdict}.`;
    case "vs-3bet":
      return `When your raise gets re-raised, re-raise again with about ${pct(raiseShare)} of hands, call about ${pct(callShare)}, and fold the rest. ${verdict}.`;
    case "vs-4bet":
      return `After a raise and a re-raise, only the top ${pct(continueShare)} of hands continue. ${verdict}.`;
  }
}

export function feedback(g: Grade, concepts: readonly Concept[], opponents: Opponents, bigBlind: number): Feedback {
  const skill = concepts[0]?.title ?? null;
  const context = `Your ${g.street} decision: ${describeAction(g.action, bigBlind)}`;
  if (!g.graded) {
    return { tone: "ungraded", context, headline: "Not graded", stats: [], mix: null, keyPoint: g.reason, read: null, skill, details: [], caveats: [] };
  }
  const cost = g.verdict !== "good" && g.evLossBB !== null ? [{ label: "Cost", value: `−${g.evLossBB.toFixed(1)}bb` }] : [];
  if (g.basis.kind === "chart") {
    return {
      tone: g.verdict, context, headline: headline(g, bigBlind), mix: null, read: null, skill,
      stats: [
        { label: "Your hand", value: g.basis.handClass },
        { label: "Seat", value: g.basis.position },
        { label: "Hands that play on", value: pct(g.basis.continueShare) },
      ],
      keyPoint: chartKeyPoint(g), details: [`Chart: ${g.basis.source}`], caveats: [],
    };
  }
  const b = g.basis;
  const pair = b.potOddsNeeded !== null
    ? [{ label: "Your equity", value: pct(b.equity) }, { label: "Needed to call", value: pct(b.potOddsNeeded) }]
    : [
        { label: "They fold to a bet", value: b.foldToBet === null ? "n/a" : pct(b.foldToBet) },
        { label: "Equity if called", value: b.equityWhenCalled === null ? pct(b.equity) : pct(b.equityWhenCalled) },
      ];
  const opp = opponents[b.villain];
  return {
    tone: g.verdict, context, headline: headline(g, bigBlind), mix: b.mix, skill,
    stats: [...pair, ...cost],
    keyPoint: evKeyPoint(g, bigBlind),
    read: opp ? `${opp.name} plays like a ${opp.style.name.toLowerCase()}. ${opp.style.leak}` : null,
    details: [
      `Their actions narrow them to about ${b.rangeSize} likely hands.`,
      ...b.values.map((v) => `${describeAction(v.action, bigBlind)}: ${signedBB(v.evBB)}`),
    ],
    caveats: b.approximations,
  };
}

export const feedbackText = (f: Feedback) =>
  [f.context, f.headline, ...f.stats.map((s) => `${s.label} ${s.value}`), f.keyPoint, f.read ?? "", ...f.details, ...f.caveats].join(" ");
