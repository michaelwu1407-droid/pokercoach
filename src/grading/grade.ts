import type { Style } from "../bots/styles";
import { legalActions, potSize } from "../engine/reduce";
import type { HandEvent, HandState, PlayerAction, SeatIndex } from "../engine/types";
import { equityVsRange } from "../evaluator/equity";
import { type GroupKind, groupOf } from "../evaluator/handGroups";
import { ALL_CLASSES, classOf, combosOf, type WeightedCombo } from "../evaluator/ranges";
import { gradeChart } from "./chart";
import { gradeHeadsUp } from "./headsUp";
import { equityAgainst, gradeMultiway } from "./multiway";
import { effectiveSize, villainRange } from "./villainRange";
import { drawOf } from "./outs";
import type { Facing, Graded, Grade, GradeCore, Win } from "./types";

export interface DecisionContext {
  /** Every event before the decision. Reducing them gives `state`. */
  readonly events: readonly HandEvent[];
  readonly state: HandState;
  readonly action: PlayerAction;
  readonly styles: Readonly<Record<SeatIndex, Style>>;
}

const ALL_HANDS = ALL_CLASSES.flatMap((c) => combosOf(c)).map((combo) => ({ combo, weight: 1 }));

/**
 * Your chance to win at the decision. After the flop it is against everyone still in. Preflop it is
 * against the players who have put money in, or one random hand when nobody has.
 */
function winAt(ctx: DecisionContext, core: Omit<Graded, "win" | "draw" | "facing" | "allInTo">): Win {
  const { state: st, action, events, styles } = ctx;
  const hero = action.seat;
  if (core.basis.kind === "ev") {
    const live = st.seats.flatMap((s, i) => (i !== hero && !s.folded ? [i] : []));
    return { chance: core.basis.equity, against: live, theirs: null };
  }
  const inPot = [...new Set(st.history.filter((a) => (a.type === "call" || a.type === "raise") && a.seat !== hero).map((a) => a.seat))]
    .filter((s) => !st.seats[s]!.folded && styles[s]);
  if (inPot.length === 0) {
    const r = equityVsRange(st.seats[hero]!.hole, ALL_HANDS, [], { samples: 4000, seed: 7 + events.length });
    return { chance: r.equity, against: [], theirs: null };
  }
  const theirs = inPot.length === 1 ? rangeSummary(villainRange(events, inPot[0]!, styles[inPot[0]!]!, st.seats[hero]!.hole)) : null;
  return { chance: equityAgainst(events, st, hero, styles, inPot), against: inPot, theirs };
}

/** A share of their range at least this big names a type as what they "mostly" hold. */
const MOSTLY = 0.2;

/** How many hands a range holds, and which types make up most of it. */
function rangeSummary(range: readonly WeightedCombo[]): NonNullable<Win["theirs"]> {
  const byKind = new Map<GroupKind, number>();
  for (const { combo, weight } of range) byKind.set(groupOf(classOf(combo)), (byKind.get(groupOf(classOf(combo))) ?? 0) + weight);
  const total = [...byKind.values()].reduce((a, b) => a + b, 0);
  const mostly = [...byKind.entries()].filter(([, w]) => w >= MOSTLY * total).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return { hands: effectiveSize(range), mostly };
}

/** The bet you were answering, and who made it. Null when there was nothing to call. */
function facingAt(st: HandState): Facing | null {
  const legal = legalActions(st);
  if (st.phase !== "betting" || !legal || legal.callAmount === 0) return null;
  const last = [...st.history].reverse().find((a) => (a.type === "bet" || a.type === "raise") && a.to === st.currentBet);
  return { to: st.currentBet, by: last ? last.seat : null, call: legal.callAmount, potAfter: potSize(st) + legal.callAmount };
}

function gradeCore(ctx: DecisionContext): GradeCore {
  const { state: st, action, events, styles } = ctx;
  if (st.street === "preflop") return gradeChart(st, action);
  const hero = action.seat;
  const villains = st.seats.map((_, i) => i).filter((i) => i !== hero && !st.seats[i]!.folded);
  if (villains.some((v) => !styles[v])) return { graded: false, street: st.street, seat: hero, action, reason: "Opponent strategy unknown." };
  if (villains.length > 1) return gradeMultiway(events, st, action, styles, villains);
  return gradeHeadsUp(events, st, action, villains[0]!, styles[villains[0]!]!);
}

/** Grades one hero decision. Never looks at how the hand turned out. */
export function grade(ctx: DecisionContext): Grade {
  const { state: st, action } = ctx;
  const legal = legalActions(st);
  if (!legal || legal.seat !== action.seat) throw new Error("grade needs the state the action was taken in");
  const core = gradeCore(ctx);
  if (!core.graded) return core;
  const me = st.seats[action.seat]!;
  return {
    ...core,
    win: winAt(ctx, core),
    draw: drawOf(me.hole, st.board),
    facing: facingAt(st),
    allInTo: me.street + me.stack,
  };
}
