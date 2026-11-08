import { aggressiveTo } from "../bots/policy";
import { legalActions } from "../engine/reduce";
import type { HandState, PlayerAction } from "../engine/types";
import { chartMove, type ChartMove, readPreflop, RESPONSE_CHART_SOURCE, rowOf } from "../evaluator/responseCharts";
import { RFI } from "../evaluator/preflopCharts";
import { classOf, rangeCombos } from "../evaluator/ranges";
import type { GradeCore, Verdict } from "./types";

const share = (set: ReadonlySet<string>) => rangeCombos(set).length / 1326;

/** Open-raise share per seat, rounded to 5% so it is easy to remember. */
const LADDER = (["UTG", "HJ", "CO", "BTN", "SB"] as const).map((position) => ({ position, roughPct: Math.round(share(RFI[position]!.raise) * 20) * 5 }));

/** A preflop raise this many times the usual size, and at least this deep, is oversized. */
const OVERSIZE_FACTOR = 3;
const OVERSIZE_MIN_BB = 15;

/**
 * Every preflop decision is graded against the chart for its situation. The amount matters too: a
 * huge raise with a raising hand is "right idea, wrong size", because only better hands call it.
 */
export function gradeChart(st: HandState, action: PlayerAction): GradeCore {
  const seat = action.seat;
  const legal = legalActions(st);
  if (!legal) throw new Error("gradeChart needs a betting state");
  const read = readPreflop(st, seat);
  const handClass = classOf(st.seats[seat]!.hole);
  let bestMove = chartMove(read.chart, handClass);
  if (bestMove === "raise" && !legal.raise) bestMove = "call";
  if (bestMove === "call" && legal.canCheck && read.spot !== "vs-limp") bestMove = "fold";
  const usual = legal.raise ? aggressiveTo(st) : 0;
  const best: PlayerAction = bestMove === "raise" && legal.raise ? { type: legal.raise.kind, seat, to: usual }
    : bestMove === "call" ? (legal.canCheck ? { type: "check", seat } : { type: "call", seat })
    : legal.canCheck ? { type: "check", seat } : { type: "fold", seat };
  const chose: ChartMove = action.type === "raise" || action.type === "bet" ? "raise" : action.type === "call" ? "call" : "fold";
  const bb = st.config.bigBlind;
  const oversized = chose === "raise" && "to" in action && action.to > Math.max(OVERSIZE_FACTOR * usual, OVERSIZE_MIN_BB * bb);
  // Raising a calling hand, or calling a raising hand, is a smaller error than playing a folding hand.
  const borderline = chose === "raise" && bestMove === "fold" && read.nearby.has(handClass);
  const verdict: Verdict = chose === bestMove
    ? (oversized ? "mistake" : "good")
    : (chose !== "fold" && bestMove !== "fold") || borderline ? "small" : "mistake";
  const continueShare = share(new Set([...read.chart.raise, ...read.chart.call]));
  return {
    graded: true, street: st.street, seat, action, best, evLossBB: null, verdict,
    basis: {
      kind: "chart", spot: read.spot, source: RESPONSE_CHART_SOURCE, position: read.position, opener: read.opener,
      openerSeat: read.openerSeat, handClass, bestMove, borderline, oversized,
      raiseShare: share(read.chart.raise), callShare: share(read.chart.call),
      openerShare: read.opener && RFI[read.opener] ? share(RFI[read.opener]!.raise) : null, ladder: LADDER,
      continueShare, foldShare: 1 - continueShare, playOneIn: Math.max(1, Math.round(1 / continueShare)), row: rowOf(read.chart, handClass),
      behind: st.phase === "betting" ? st.pending.filter((p) => p !== seat).length : 0,
    },
  };
}
