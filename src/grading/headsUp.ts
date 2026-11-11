import { moveDist, toAction } from "../bots/policy";
import type { Style } from "../bots/styles";
import { apply, legalActions, potSize } from "../engine/reduce";
import type { HandEvent, HandState, PlayerAction, SeatIndex } from "../engine/types";
import { equityVsCombo, equityVsRange } from "../evaluator/equity";
import type { WeightedCombo } from "../evaluator/ranges";
import { makeLookahead } from "./lookahead";
import { candidates, pickBest, potOddsNeeded } from "./options";
import { rangeMix } from "./rangeMix";
import { type ActionValue, type GradeCore, verdictForChoice } from "./types";
import { effectiveSize, villainRange } from "./villainRange";

/** The heaviest combos that cover almost all of the range are played out exactly. */
const LOOKAHEAD_COMBOS = 160;
const LOOKAHEAD_COVER = 0.995;

interface Model {
  readonly st: HandState;
  readonly hero: SeatIndex;
  readonly villain: SeatIndex;
  readonly style: Style;
  readonly range: readonly WeightedCombo[];
  /** Your chance to win against each combo now. */
  readonly eq: Float64Array;
  /** Your expected gain per combo from a state where this street's betting just ended, given how likely each combo is to be there. */
  readonly cont: (closed: HandState, reach: Float64Array) => Float64Array;
}

function model(events: readonly HandEvent[], st: HandState, hero: SeatIndex, villain: SeatIndex, style: Style): Model {
  const hole = st.seats[hero]!.hole;
  const range = villainRange(events, villain, style, [...hole, ...st.board]);
  const order = range.map((_, i) => i).sort((a, b) => range[b]!.weight - range[a]!.weight);
  const played: number[] = [];
  for (let covered = 0, k = 0; k < order.length && played.length < LOOKAHEAD_COMBOS && covered < LOOKAHEAD_COVER; k++) {
    played.push(order[k]!);
    covered += range[order[k]!]!.weight;
  }
  if (st.street === "river") {
    const eq = Float64Array.from(range, (w) => equityVsCombo(hole, w.combo, st.board));
    return { st, hero, villain, style, range, eq, cont: (closed) => eq.map((e) => e * potSize(closed)) };
  }
  const ahead = makeLookahead({ hero, villain, style, heroHole: hole, board: st.board, combos: played.map((i) => range[i]!.combo) });
  // Exact for the played combos. The tail, under half a percent of the range, is exact on the turn and
  // sampled on the flop, where exact enumeration of hundreds of rare hands would cost seconds.
  const exact = ahead.equityNow();
  const eq = Float64Array.from(range, (w, i) => {
    const k = played.indexOf(i);
    if (k >= 0) return exact[k]!;
    if (st.board.length >= 4) return equityVsCombo(hole, w.combo, st.board);
    return equityVsRange(hole, [{ combo: w.combo, weight: 1 }], st.board, { exactBudget: 0, samples: 60, seed: i + 1 }).equity;
  });
  const cont = (closed: HandState, reach: Float64Array) => {
    const out = eq.map((e) => e * potSize(closed));
    if (closed.phase !== "betting") return out;
    const v = ahead.value(closed, Float64Array.from(played, (i) => reach[i]!));
    played.forEach((i, k) => (out[i] = v[k]!));
    return out;
  };
  return { st, hero, villain, style, range, eq, cont };
}

/** Your expected chip gain from the decision, and for a bet how they respond to it. */
function valueOf(m: Model, action: PlayerAction): Omit<ActionValue, "action" | "evBB"> & { ev: number } {
  const none = { foldShare: null, winWhenCalled: null };
  if (action.type === "fold") return { ev: 0, ...none };
  const { st, hero, villain, style, range } = m;
  const weights = Float64Array.from(range, (w) => w.weight);
  const stack0 = st.seats[hero]!.stack;
  const gainAt = (s: HandState) => s.seats[hero]!.stack - stack0;
  const sum = (f: (i: number) => number) => range.reduce((acc, _, i) => acc + f(i), 0);
  const after = apply(st, action);
  if (after.phase !== "betting" || after.street !== st.street || after.toAct !== villain) {
    const c = m.cont(after, weights);
    return { ev: sum((i) => weights[i]! * (gainAt(after) + c[i]!)), ...none };
  }
  const d = range.map((w) => moveDist(after, villain, w.combo, style));
  const added = stack0 - after.seats[hero]!.stack;
  const called = apply(after, toAction(after, "passive"));
  const cCalled = m.cont(called, weights.map((w, i) => w * d[i]!.passive));
  let ev = sum((i) => weights[i]! * (d[i]!.fold * (potSize(after) - added) + d[i]!.passive * (gainAt(called) + cCalled[i]!)));
  if (legalActions(after)?.raise && d.some((x) => x.aggressive > 0)) {
    // Facing their raise you either fold or call, and a call leads into the next round like any other.
    const raised = apply(after, toAction(after, "aggressive"));
    const callIt = raised.phase === "betting" && raised.toAct === hero ? apply(raised, { type: "call", seat: hero }) : raised;
    const cRaise = m.cont(callIt, weights.map((w, i) => w * d[i]!.aggressive));
    const raiseCall = sum((i) => weights[i]! * d[i]!.aggressive * (gainAt(callIt) + cRaise[i]!));
    ev += Math.max(raiseCall, sum((i) => weights[i]! * d[i]!.aggressive * -added));
  }
  const foldShare = sum((i) => weights[i]! * d[i]!.fold);
  const contWeight = 1 - foldShare;
  const winWhenCalled = contWeight > 0 ? sum((i) => weights[i]! * (1 - d[i]!.fold) * m.eq[i]!) / contWeight : null;
  return { ev, foldShare: action.type === "bet" || action.type === "raise" ? foldShare : null, winWhenCalled: action.type === "bet" || action.type === "raise" ? winWhenCalled : null };
}

/** Grades a decision against one opponent: their exact range, every option priced one betting round ahead. */
export function gradeHeadsUp(events: readonly HandEvent[], st: HandState, action: PlayerAction, villain: SeatIndex, style: Style): GradeCore {
  const hero = action.seat;
  const m = model(events, st, hero, villain, style);
  const bb = st.config.bigBlind;
  const values: ActionValue[] = candidates(st, action).map((a) => {
    const { ev, ...stats } = valueOf(m, a);
    return { action: a, evBB: ev / bb, ...stats };
  });
  const { best, evLossBB } = pickBest(st, values);
  const raiseLegal = legalActions(st)?.raise !== undefined;
  return {
    graded: true, street: st.street, seat: hero, action, best: best.action, evLossBB,
    verdict: verdictForChoice(action, best.action, evLossBB),
    basis: {
      kind: "ev", villain, opponents: 1, mix: rangeMix(m.range, st.board), values,
      equity: m.range.reduce((s, w, i) => s + w.weight * m.eq[i]!, 0),
      potOddsNeeded: potOddsNeeded(st), rangeSize: effectiveSize(m.range),
      approximations: [
        ...(st.street !== "river" ? ["It plays out the next round for every possible next card.", "After that, it assumes everyone checks to the end."] : []),
        ...(raiseLegal ? ["If you bet and get raised, you fold or call. Re-raising is left out.", "A huge all-in is never suggested, since it only looks one round ahead."] : []),
      ],
    },
  };
}
