import { type Card, FULL_DECK, mulberry32 } from "../cards/card";
import { aggressiveTo, moveDist } from "../bots/policy";
import type { Style } from "../bots/styles";
import { apply, legalActions, potSize } from "../engine/reduce";
import type { HandEvent, HandState, PlayerAction, SeatIndex } from "../engine/types";
import { evaluate } from "../evaluator/handRank";
import { equityVsCombo } from "../evaluator/equity";
import { positionOf, RFI } from "../evaluator/preflopCharts";
import { classOf, type Combo, type WeightedCombo } from "../evaluator/ranges";
import { type ActionValue, type Grade, verdictFor } from "./types";
import { effectiveSize, villainRange } from "./villainRange";

export interface DecisionContext {
  /** Every event before the decision. Reducing them gives `state`. */
  readonly events: readonly HandEvent[];
  readonly state: HandState;
  readonly action: PlayerAction;
  readonly styles: Readonly<Record<SeatIndex, Style>>;
}

const FLOP_RUNOUTS = 120;

function comboEquity(hero: Combo, villain: Combo, board: readonly Card[], seed: number): number {
  if (board.length >= 4) return equityVsCombo(hero, villain, board);
  const rng = mulberry32(seed);
  const deck = FULL_DECK.filter((c) => !hero.includes(c) && !villain.includes(c) && !board.includes(c));
  let sum = 0;
  for (let t = 0; t < FLOP_RUNOUTS; t++) {
    const i = Math.floor(rng() * deck.length);
    let j = Math.floor(rng() * (deck.length - 1));
    if (j >= i) j++;
    const run = [...board, deck[i]!, deck[j]!];
    const h = evaluate([...hero, ...run]);
    const v = evaluate([...villain, ...run]);
    sum += h > v ? 1 : h === v ? 0.5 : 0;
  }
  return sum / FLOP_RUNOUTS;
}

const isRaiseFirstIn = (st: HandState) => st.street === "preflop" && st.history.every((a) => a.type === "fold");

function gradeChart(ctx: DecisionContext): Grade {
  const { state: st, action } = ctx;
  const pos = positionOf(st.config, action.seat);
  const chart = RFI[pos];
  if (!chart) return { graded: false, street: st.street, seat: action.seat, action, reason: `No open-raise chart for ${pos}.` };
  const handClass = classOf(st.seats[action.seat]!.hole);
  const inChart = chart.raise.has(handClass);
  const legal = legalActions(st)!;
  const best: PlayerAction = inChart && legal.raise ? { type: legal.raise.kind, seat: action.seat, to: aggressiveTo(st) } : { type: "fold", seat: action.seat };
  const right = inChart ? action.type === "raise" : action.type === "fold";
  return {
    graded: true, street: st.street, seat: action.seat, action, best, evLossBB: null,
    verdict: right ? "good" : "mistake",
    basis: { kind: "chart", chartId: chart.id, source: chart.source, inChart, handClass },
  };
}

function candidates(st: HandState, action: PlayerAction): PlayerAction[] {
  const legal = legalActions(st)!;
  const seat = legal.seat;
  const out: PlayerAction[] = [action];
  if (!legal.canCheck) out.push({ type: "fold", seat });
  out.push(legal.canCheck ? { type: "check", seat } : { type: "call", seat });
  if (legal.raise) {
    out.push({ type: legal.raise.kind, seat, to: aggressiveTo(st) });
    out.push({ type: legal.raise.kind, seat, to: legal.raise.max });
  }
  const key = (a: PlayerAction) => `${a.type}:${"to" in a ? a.to : ""}`;
  return out.filter((a, i) => out.findIndex((b) => key(b) === key(a)) === i);
}

function valueOf(st: HandState, action: PlayerAction, hero: SeatIndex, villain: SeatIndex, range: readonly WeightedCombo[],
  eq: ReadonlyMap<WeightedCombo, number>, style: Style): number {
  if (action.type === "fold") return 0;
  const before = st.seats[hero]!;
  const after = apply(st, action);
  const added = before.stack - after.seats[hero]!.stack;
  const potAfter = potSize(after);
  const checkDown = (pot: number) => range.reduce((s, w) => s + w.weight * eq.get(w)!, 0) * pot - added;
  if (after.phase !== "betting" || after.street !== st.street || after.toAct !== villain) return checkDown(potAfter);

  let value = 0;
  let raiseCall = 0;
  let raiseFold = 0;
  const legal = legalActions(after)!;
  const raiseTo = legal.raise ? aggressiveTo(after) : 0;
  const vStreet = after.seats[villain]!.street;
  const hStreet = after.seats[hero]!.street;
  for (const w of range) {
    const d = moveDist(after, villain, w.combo, style);
    const e = eq.get(w)!;
    value += w.weight * (d.fold * (potAfter - added) + d.passive * (e * (potAfter + legal.callAmount) - added));
    if (d.aggressive > 0 && legal.raise) {
      const pot3 = potAfter + (raiseTo - vStreet) + (raiseTo - hStreet);
      raiseCall += w.weight * d.aggressive * (e * pot3 - added - (raiseTo - hStreet));
      raiseFold += w.weight * d.aggressive * -added;
    }
  }
  return value + Math.max(raiseCall, raiseFold);
}

function gradeEv(ctx: DecisionContext): Grade {
  const { state: st, action, events, styles } = ctx;
  const hero = action.seat;
  const live = st.seats.map((s, i) => i).filter((i) => !st.seats[i]!.folded);
  if (live.length !== 2) return { graded: false, street: st.street, seat: hero, action, reason: "Multiway pots are not graded yet." };
  const villain = live.find((i) => i !== hero)!;
  const style = styles[villain];
  if (!style) return { graded: false, street: st.street, seat: hero, action, reason: "Opponent strategy unknown." };
  const holeHero = st.seats[hero]!.hole;
  const range = villainRange(events, villain, style, [...holeHero, ...st.board]);
  const eq = new Map(range.map((w, k) => [w, comboEquity(holeHero, w.combo, st.board, 17 + k)] as const));
  const equity = range.reduce((s, w) => s + w.weight * eq.get(w)!, 0);
  const bb = st.config.bigBlind;
  const values: ActionValue[] = candidates(st, action).map((a) => ({ action: a, evBB: valueOf(st, a, hero, villain, range, eq, style) / bb }));
  const best = values.reduce((a, b) => (b.evBB > a.evBB ? b : a));
  const chosen = values[0]!;
  const legal = legalActions(st)!;
  const potOddsNeeded = legal.callAmount > 0 ? legal.callAmount / (potSize(st) + legal.callAmount) : null;
  const approximations = [
    ...(st.street !== "river" ? ["Later streets are treated as checked down, so future bets and implied odds are ignored."] : []),
    ...(st.street === "flop" ? [`Equity on the flop is sampled from ${FLOP_RUNOUTS} runouts per opposing hand.`] : []),
    ...(legal.raise ? ["If you bet and get raised, you either fold or call. Re-raising is not considered."] : []),
  ];
  const evLossBB = Math.max(0, best.evBB - chosen.evBB);
  return {
    graded: true, street: st.street, seat: hero, action, best: best.action, evLossBB, verdict: verdictFor(evLossBB),
    basis: { kind: "ev", values, equity, potOddsNeeded, rangeSize: effectiveSize(range), approximations },
  };
}

/** Grades one hero decision. Never looks at how the hand turned out. */
export function grade(ctx: DecisionContext): Grade {
  const { state: st, action } = ctx;
  if (st.phase !== "betting" || legalActions(st)?.seat !== action.seat) throw new Error("grade needs the state the action was taken in");
  if (st.street === "preflop") {
    return isRaiseFirstIn(st)
      ? gradeChart(ctx)
      : { graded: false, street: st.street, seat: action.seat, action, reason: "Only raise-first-in preflop spots are graded so far." };
  }
  return gradeEv(ctx);
}
