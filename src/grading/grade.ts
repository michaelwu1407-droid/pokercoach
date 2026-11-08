import { type Card, FULL_DECK, mulberry32 } from "../cards/card";
import { aggressiveTo, moveDist } from "../bots/policy";
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
  const verdict = chose === bestMove ? "good" : chose !== "fold" && bestMove !== "fold" ? "small" : "mistake";
  return {
    graded: true, street: st.street, seat, action, best, evLossBB: null, verdict,
    basis: {
      kind: "chart", spot: read.spot, source: RESPONSE_CHART_SOURCE, position: read.position, opener: read.opener,
      handClass, bestMove, raiseShare: share(read.chart.raise), callShare: share(read.chart.call),
      continueShare: share(new Set([...read.chart.raise, ...read.chart.call])),
    },
  };
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
  const missing = live.find((i) => i !== hero && !styles[i]);
  if (missing !== undefined) return { graded: false, street: st.street, seat: hero, action, reason: "Opponent strategy unknown." };
  if (live.length > 2) return gradeMultiway(events, st, action, styles, live.filter((i) => i !== hero));
  const villain = live.find((i) => i !== hero)!;
  const style = styles[villain];
  if (!style) return { graded: false, street: st.street, seat: hero, action, reason: "Opponent strategy unknown." };
  const holeHero = st.seats[hero]!.hole;
  const range = villainRange(events, villain, style, [...holeHero, ...st.board]);
  const eq = new Map(range.map((w, k) => [w, comboEquity(holeHero, w.combo, st.board, 17 + k)] as const));
  const equity = range.reduce((s, w) => s + w.weight * eq.get(w)!, 0);
  const bb = st.config.bigBlind;
  const values: ActionValue[] = candidates(st, action).map((a) => ({ action: a, evBB: valueOf(st, a, hero, villain, range, eq, style) / bb }));
  // A deep all-in is priced but never recommended. The one-step lookahead undervalues smaller bets,
  // which keep later streets to bet on, so a deep shove would look better than it is.
  const recommendable = values.filter((v) => !isDeepShove(st, v.action));
  const best = recommendable.reduce((a, b) => (b.evBB > a.evBB ? b : a));
  const chosen = values[0]!;
  const legal = legalActions(st)!;
  const potOddsNeeded = legal.callAmount > 0 ? legal.callAmount / (potSize(st) + legal.callAmount) : null;
  const approximations = [
    ...(st.street !== "river" ? ["Later streets are treated as checked down, so future bets and implied odds are ignored."] : []),
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
