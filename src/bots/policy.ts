import { legalActions, potSize } from "../engine/reduce";
import type { HandState, LegalActions, PlayerAction, SeatIndex } from "../engine/types";
import { positionOf, RFI } from "../evaluator/preflopCharts";
import { classOf, type Combo } from "../evaluator/ranges";
import { drawsOf, madeStrength, preflopPercentile } from "./strength";
import type { Style } from "./styles";

export type Move = "fold" | "passive" | "aggressive";
export type MoveDist = Readonly<Record<Move, number>>;
type Betting = Extract<HandState, { phase: "betting" }>;

const sig = (x: number) => 1 / (1 + Math.exp(-x / 0.03));
const EPS = 0.01;

export const moveOf = (a: PlayerAction): Move =>
  a.type === "fold" ? "fold" : a.type === "check" || a.type === "call" ? "passive" : "aggressive";

/** Spreads a little weight to every legal move so any line a bot takes keeps a nonzero range. */
function normalise(raw: MoveDist, legal: LegalActions): MoveDist {
  const allowed: Record<Move, boolean> = { fold: !legal.canCheck, passive: true, aggressive: legal.raise !== undefined };
  const moved = { ...raw, passive: raw.passive + (allowed.aggressive ? 0 : raw.aggressive) + (allowed.fold ? 0 : raw.fold) };
  const out = { fold: 0, passive: 0, aggressive: 0 };
  let total = 0;
  for (const m of ["fold", "passive", "aggressive"] as const) if (allowed[m]) total += out[m] = Math.max(moved[m], 0) + EPS;
  for (const m of ["fold", "passive", "aggressive"] as const) out[m] /= total;
  return out;
}

function preflop(st: Betting, seat: SeatIndex, combo: Combo, style: Style): MoveDist {
  const pct = preflopPercentile(combo);
  const raises = st.history.filter((a) => a.type === "raise").length;
  const opened = st.currentBet > st.config.bigBlind;
  if (!opened) {
    const pos = positionOf(st.config, seat);
    if (pos === "BB") return { fold: 0, passive: 1 - sig(0.08 - pct), aggressive: sig(0.08 - pct) };
    const as = style.openAs[pos];
    const inChart = as !== null && RFI[as]!.raise.has(classOf(combo));
    if (inChart) return { fold: 0.02, passive: 0, aggressive: 0.98 };
    const limp = sig(style.limpTop - pct);
    return { fold: 1 - limp, passive: limp, aggressive: 0 };
  }
  const scale = raises >= 2 ? 0.4 : 1;
  const agg = sig(style.threeBetTop * scale - pct);
  const call = (1 - agg) * sig(style.callRaiseTop * scale - pct);
  return { fold: 1 - agg - call, passive: call, aggressive: agg };
}

function postflop(st: Betting, combo: Combo, style: Style, legal: LegalActions): MoveDist {
  const made = madeStrength(combo, st.board);
  const { flushDraw, straightOuts } = drawsOf(combo, st.board);
  const draw = flushDraw || straightOuts >= 2;
  const strength = Math.min(1, made + (flushDraw ? 0.15 : 0) + (straightOuts >= 2 ? 0.12 : straightOuts === 1 ? 0.05 : 0));
  if (legal.canCheck) {
    const bet = Math.max(sig(made - style.valueBet), draw ? style.semiBluff : 0, made < 0.35 ? style.bluff : 0);
    return { fold: 0, passive: 1 - bet, aggressive: bet };
  }
  const betToPot = legal.callAmount / Math.max(1, potSize(st) - legal.callAmount);
  const pressure = betToPot / (betToPot + 1.5);
  const callBar = Math.min(0.98, style.callBase + (1 - style.callBase) * pressure * style.sizeFear);
  const raise = Math.max(sig(made - style.raiseValue), draw ? style.semiBluff * 0.3 : 0);
  const call = (1 - raise) * sig(strength - callBar);
  return { fold: 1 - raise - call, passive: call, aggressive: raise };
}

/** The probability of each move for `combo` in seat `seat`. Pure, so ranges can be inferred from it. */
export function moveDist(st: HandState, seat: SeatIndex, combo: Combo, style: Style): MoveDist {
  const legal = legalActions(st);
  if (st.phase !== "betting" || !legal || legal.seat !== seat) throw new Error("not this seat's turn");
  const raw = st.street === "preflop" ? preflop(st, seat, combo, style) : postflop(st, combo, style, legal);
  return normalise(raw, legal);
}

/** Concrete chip size for an aggressive move. Deterministic given the state. */
export function aggressiveTo(st: HandState): number {
  const legal = legalActions(st);
  if (st.phase !== "betting" || !legal?.raise) throw new Error("no aggressive move available");
  const r = legal.raise;
  const me = st.seats[legal.seat]!;
  const bb = st.config.bigBlind;
  let to: number;
  if (st.street === "preflop") {
    const limpers = st.seats.filter((s) => s.street === bb && !s.folded).length - 1;
    to = st.currentBet === bb ? Math.round(2.5 * bb + Math.max(0, limpers) * bb) : 3 * st.currentBet;
  } else to = st.currentBet === 0 ? Math.round(0.66 * potSize(st)) : 3 * st.currentBet;
  to = Math.min(r.max, Math.max(r.min, to));
  return to > 0.6 * (me.street + me.stack) ? r.max : to;
}

export function toAction(st: HandState, move: Move): PlayerAction {
  const legal = legalActions(st)!;
  const seat = legal.seat;
  if (move === "fold") return { type: "fold", seat };
  if (move === "passive") return legal.canCheck ? { type: "check", seat } : { type: "call", seat };
  return { type: legal.raise!.kind, seat, to: aggressiveTo(st) };
}

export function decide(st: HandState, style: Style, rng: () => number): PlayerAction {
  const seat = legalActions(st)!.seat;
  const dist = moveDist(st, seat, st.seats[seat]!.hole, style);
  const x = rng();
  const move: Move = x < dist.fold ? "fold" : x < dist.fold + dist.passive ? "passive" : "aggressive";
  return toAction(st, move);
}
