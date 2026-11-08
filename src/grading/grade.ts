import { type Card, FULL_DECK, mulberry32 } from "../cards/card";
import { aggressiveTo, moveDist, toAction } from "../bots/policy";
import { NEXT_CARDS, nextRoundValue } from "./lookahead";
import type { Style } from "../bots/styles";
import { apply, legalActions, potSize } from "../engine/reduce";
import type { HandEvent, HandState, PlayerAction, SeatIndex } from "../engine/types";
import { evaluate } from "../evaluator/handRank";
import { equityVsCombo } from "../evaluator/equity";
import { chartMove, type ChartMove, readPreflop, RESPONSE_CHART_SOURCE } from "../evaluator/responseCharts";
import { classOf, type Combo, rangeCombos, type WeightedCombo } from "../evaluator/ranges";
import { rangeMix } from "./rangeMix";
import { sizeOptions } from "./sizes";
import { candidates, isDeepShove } from "./options";
import { gradeMultiway } from "./multiway";
import { type ActionValue, type Grade, verdictForChoice } from "./types";
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

const share = (set: ReadonlySet<string>) => rangeCombos(set).length / 1326;

/** Every preflop decision is graded against the chart for its situation. */
function gradeChart(ctx: DecisionContext): Grade {
  const { state: st, action } = ctx;
  const seat = action.seat;
  const read = readPreflop(st, seat);
  const handClass = classOf(st.seats[seat]!.hole);
  const legal = legalActions(st)!;
  let bestMove = chartMove(read.chart, handClass);
  if (bestMove === "raise" && !legal.raise) bestMove = "call";
  if (bestMove === "call" && legal.canCheck && read.spot !== "vs-limp") bestMove = "fold";
  const best: PlayerAction = bestMove === "raise" ? { type: legal.raise!.kind, seat, to: aggressiveTo(st) }
    : bestMove === "call" ? (legal.canCheck ? { type: "check", seat } : { type: "call", seat })
    : legal.canCheck ? { type: "check", seat } : { type: "fold", seat };
  const chose: ChartMove = action.type === "raise" || action.type === "bet" ? "raise" : action.type === "call" ? "call" : "fold";
  // Raising a calling hand or calling a raising hand is a smaller error than playing a folding hand.
  const borderline = chose === "raise" && bestMove === "fold" && read.nearby.has(handClass);
  const verdict = chose === bestMove ? "good" : (chose !== "fold" && bestMove !== "fold") || borderline ? "small" : "mistake";
  return {
    graded: true, street: st.street, seat, action, best, evLossBB: null, verdict,
    basis: {
      kind: "chart", spot: read.spot, source: RESPONSE_CHART_SOURCE, position: read.position, opener: read.opener,
      handClass, bestMove, borderline, raiseShare: share(read.chart.raise), callShare: share(read.chart.call),
      continueShare: share(new Set([...read.chart.raise, ...read.chart.call])),
    },
  };
}

/** Combos the lookahead plays out. The rest of the range keeps the checked-down value. */
const LOOKAHEAD_COMBOS = 250;

interface EvModel {
  readonly st: HandState;
  readonly hero: SeatIndex;
  readonly villain: SeatIndex;
  readonly style: Style;
  readonly range: readonly WeightedCombo[];
  /**
   * Hero's expected gain per combo from a state where the graded street's betting has just ended.
   * `reach` is how likely each combo is to get there, so the hero's later choices answer that range.
   */
  readonly cont: (closed: HandState, reach: Float64Array) => Float64Array;
}

function evModel(st: HandState, hero: SeatIndex, villain: SeatIndex, style: Style, range: readonly WeightedCombo[], eq: Float64Array, seed: number): EvModel {
  const checkDown = (closed: HandState) => eq.map((e) => e * potSize(closed));
  if (st.street === "river") return { st, hero, villain, style, range, cont: checkDown };
  // The heaviest combos covering almost all of the range are played out. The tail keeps check-down values.
  const order = range.map((_, i) => i).sort((a, b) => range[b]!.weight - range[a]!.weight);
  const chosen: number[] = [];
  let covered = 0;
  for (const i of order) {
    if (chosen.length >= LOOKAHEAD_COMBOS || covered >= 0.995) break;
    chosen.push(i);
    covered += range[i]!.weight;
  }
  const setup = { hero, villain, style, heroHole: st.seats[hero]!.hole, board: st.board, combos: chosen.map((i) => range[i]!.combo), seed };
  const cont = (closed: HandState, reach: Float64Array) => {
    const base = checkDown(closed);
    if (closed.phase !== "betting") return base;
    const ahead = nextRoundValue(setup, closed, Float64Array.from(chosen, (i) => reach[i]!));
    chosen.forEach((i, k) => (base[i] = ahead[k]!));
    return base;
  };
  return { st, hero, villain, style, range, cont };
}

/** Hero's expected chip gain from the decision, over the opponent's range. */
function valueOf(m: EvModel, action: PlayerAction): number {
  if (action.type === "fold") return 0;
  const { st, hero, villain, style, range } = m;
  const n = range.length;
  const weights = Float64Array.from(range, (w) => w.weight);
  const stack0 = st.seats[hero]!.stack;
  const gainAt = (closed: HandState) => closed.seats[hero]!.stack - stack0;
  const after = apply(st, action);
  if (after.phase !== "betting" || after.street !== st.street || after.toAct !== villain) {
    const c = m.cont(after, weights);
    return range.reduce((s, w, i) => s + w.weight * (gainAt(after) + c[i]!), 0);
  }
  const fold = new Float64Array(n), passive = new Float64Array(n), aggressive = new Float64Array(n);
  range.forEach((w, i) => {
    const d = moveDist(after, villain, w.combo, style);
    fold[i] = d.fold, passive[i] = d.passive, aggressive[i] = d.aggressive;
  });
  const added = stack0 - after.seats[hero]!.stack;
  let value = range.reduce((s, w, i) => s + w.weight * fold[i]! * (potSize(after) - added), 0);
  const called = apply(after, toAction(after, "passive"));
  const cCalled = m.cont(called, weights.map((w, i) => w * passive[i]!));
  value += range.reduce((s, w, i) => s + w.weight * passive[i]! * (gainAt(called) + cCalled[i]!), 0);
  if (legalActions(after)!.raise && aggressive.some((x) => x > 0)) {
    // Facing their raise you either fold or call. Calling leads into the next round like any other call.
    const raised = apply(after, toAction(after, "aggressive"));
    const callIt = raised.phase === "betting" && raised.toAct === hero ? apply(raised, { type: "call", seat: hero }) : raised;
    const cRaise = m.cont(callIt, weights.map((w, i) => w * aggressive[i]!));
    const raiseCall = range.reduce((s, w, i) => s + w.weight * aggressive[i]! * (gainAt(callIt) + cRaise[i]!), 0);
    const raiseFold = range.reduce((s, w, i) => s + w.weight * aggressive[i]! * -added, 0);
    value += Math.max(raiseCall, raiseFold);
  }
  return value;
}

function gradeEv(ctx: DecisionContext): Grade {
  const { state: st, action, events, styles } = ctx;
  const hero = action.seat;
  const live = st.seats.map((s, i) => i).filter((i) => !st.seats[i]!.folded);
  const missing = live.find((i) => i !== hero && !styles[i]);
  if (missing !== undefined) return { graded: false, street: st.street, seat: hero, action, reason: "Opponent strategy unknown." };
  if (live.length > 2) return gradeMultiway(events, st, action, styles, live.filter((i) => i !== hero));
  const villain = live.find((i) => i !== hero)!;
  const style = styles[villain];
  if (!style) return { graded: false, street: st.street, seat: hero, action, reason: "Opponent strategy unknown." };
  const holeHero = st.seats[hero]!.hole;
  const range = villainRange(events, villain, style, [...holeHero, ...st.board]);
  const eqArr = Float64Array.from(range.map((w, k) => comboEquity(holeHero, w.combo, st.board, 17 + k)));
  const eq = new Map(range.map((w, k) => [w, eqArr[k]!] as const));
  const equity = range.reduce((s, w) => s + w.weight * eq.get(w)!, 0);
  const bb = st.config.bigBlind;
  const model = evModel(st, hero, villain, style, range, eqArr, 101 + events.length);
  const values: ActionValue[] = candidates(st, action).map((a) => ({ action: a, evBB: valueOf(model, a) / bb }));
  // A deep all-in is priced but never recommended. The one-step lookahead undervalues smaller bets,
  // which keep later streets to bet on, so a deep shove would look better than it is.
  const recommendable = values.filter((v) => !isDeepShove(st, v.action));
  const best = recommendable.reduce((a, b) => (b.evBB > a.evBB ? b : a));
  const chosen = values[0]!;
  const legal = legalActions(st)!;
  const potOddsNeeded = legal.callAmount > 0 ? legal.callAmount / (potSize(st) + legal.callAmount) : null;
  const approximations = [
    ...(st.street !== "river" ? [`The next betting round is played out over ${NEXT_CARDS} sampled cards, with you choosing your best option and them following their strategy. Streets after that are treated as checked down.`] : []),
    ...(st.street === "flop" ? [`Equity on the flop is sampled from ${FLOP_RUNOUTS} runouts per opposing hand.`] : []),
    ...(legal.raise ? ["If you bet and get raised, you either fold or call. Re-raising is not considered.", "A deep all-in is priced but never recommended, because this lookahead undervalues bets that keep later streets to play."] : []),
  ];
  const evLossBB = Math.max(0, best.evBB - chosen.evBB);
  let foldToBet: number | null = null;
  let equityWhenCalled: number | null = null;
  if (legal.raise) {
    const after = apply(st, { type: legal.raise.kind, seat: hero, to: sizeOptions(st)[0]!.to });
    if (after.phase === "betting" && after.toAct === villain) {
      let fold = 0, cont = 0, contEq = 0;
      for (const w of range) {
        const d = moveDist(after, villain, w.combo, style);
        fold += w.weight * d.fold;
        cont += w.weight * (1 - d.fold);
        contEq += w.weight * (1 - d.fold) * eq.get(w)!;
      }
      foldToBet = fold;
      equityWhenCalled = cont > 0 ? contEq / cont : null;
    }
  }
  return {
    graded: true, street: st.street, seat: hero, action, best: best.action, evLossBB, verdict: verdictForChoice(action, best.action, evLossBB),
    basis: { kind: "ev", villain, opponents: 1, mix: rangeMix(range, st.board), foldToBet, equityWhenCalled, values, equity, potOddsNeeded, rangeSize: effectiveSize(range), approximations },
  };
}

/** Grades one hero decision. Never looks at how the hand turned out. */
export function grade(ctx: DecisionContext): Grade {
  const { state: st, action } = ctx;
  if (st.phase !== "betting" || legalActions(st)?.seat !== action.seat) throw new Error("grade needs the state the action was taken in");
  if (st.street === "preflop") {
    return gradeChart(ctx);
  }
  return gradeEv(ctx);
}
