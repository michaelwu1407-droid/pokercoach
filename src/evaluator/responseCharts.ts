import { legalActions } from "../engine/reduce";
import type { HandState, SeatIndex } from "../engine/types";
import { type Position, positionOf, RFI } from "./preflopCharts";
import { type HandClass, parseRange } from "./ranges";

/** The preflop situations the app grades. Together they cover every preflop decision. */
export type PreflopSpot = "rfi" | "vs-limp" | "vs-open" | "vs-3bet" | "vs-4bet";
export type ChartMove = "raise" | "call" | "fold";

export interface ResponseChart {
  readonly raise: ReadonlySet<HandClass>;
  readonly call: ReadonlySet<HandClass>;
}

/** Raising hands take priority, so a hand written in both lists is a raise. */
function rc(raise: string, call: string): ResponseChart {
  const r = parseRange(raise);
  return { raise: r, call: new Set([...parseRange(call)].filter((h) => !r.has(h))) };
}
const EARLY: readonly Position[] = ["UTG", "HJ"];
const LOOSER: Partial<Record<Position, Position>> = { UTG: "HJ", HJ: "CO", CO: "BTN", SB: "BTN" };
const TIGHTER: Partial<Record<Position, Position>> = { UTG: "UTG", HJ: "UTG", CO: "HJ", BTN: "CO", SB: "CO" };

const VS_OPEN = {
  early: rc("QQ+, AKs, AKo", "77-JJ, AQs, AJs, KQs"),
  lateVsEarly: rc("QQ+, AKs, AKo", "22-JJ, AJs-AQs, KJs-KQs, QJs, JTs, T9s, 98s, AQo"),
  late: rc("TT+, AJs+, KQs, AQo+, A5s-A4s", "22-99, ATs, KJs, QJs, JTs, T9s, 98s, AJo, KQo"),
  bbEarly: rc("QQ+, AKs, AKo", "22-JJ, A2s-AQs, K9s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 76s, 65s, AJo-AQo, KQo"),
  bbLate: rc("TT+, AJs+, AQo+, A5s-A4s", "22-99, A2s-ATs, K2s+, Q6s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, A2o-AJo, K9o+, Q9o+, J9o+, T9o, 98o"),
  sb: rc("TT+, AQs+, AKo, A5s", ""),
  sbVsLate: rc("88+, ATs+, KJs+, QJs, AJo+, KQo, A5s-A4s", ""),
};
const VS_3BET = rc("QQ+, AKs, AKo", "TT-JJ, AQs, AJs, KQs, AQo");
const VS_4BET = rc("KK+, AKs", "QQ, AKo");
const BB_VS_LIMP = rc("88+, ATs+, KQs, AJo+", "");

export interface PreflopRead {
  readonly spot: PreflopSpot;
  /** A looser chart for the same spot. Raising a hand only in this one is a borderline call, not a mistake. */
  readonly nearby: ReadonlySet<HandClass>;
  readonly position: Position;
  /** Seat of the first raiser, when there is one. */
  readonly opener: Position | null;
  readonly chart: ResponseChart;
}

/** Classifies the hero's preflop decision and picks the chart that answers it. */
export function readPreflop(st: HandState, hero: SeatIndex): PreflopRead {
  const legal = legalActions(st);
  if (st.street !== "preflop" || !legal || legal.seat !== hero) throw new Error("readPreflop needs the hero to act preflop");
  const position = positionOf(st.config, hero);
  const raises = st.history.filter((a) => a.type === "raise");
  const opener = raises[0] ? positionOf(st.config, raises[0].seat) : null;
  const heroRaised = st.history.some((a) => a.seat === hero && a.type === "raise");
  const asChart = (p: Position | undefined): ResponseChart => {
    const c = p && RFI[p];
    return c ? { raise: c.raise, call: new Set() } : BB_VS_LIMP;
  };
  const none = new Set<HandClass>();
  if (raises.length === 0) {
    const limped = st.history.some((a) => a.type === "call");
    if (!limped) return { spot: "rfi", position, opener, chart: asChart(position), nearby: asChart(LOOSER[position]).raise };
    // Raising over limpers uses the next tighter seat's opening range, because limpers call a lot.
    const chart = position === "BB" ? BB_VS_LIMP : asChart(TIGHTER[position]);
    return { spot: "vs-limp", position, opener, chart, nearby: position === "BB" ? none : asChart(position).raise };
  }
  if (raises.length >= 3 || (raises.length === 2 && !heroRaised)) return { spot: "vs-4bet", position, opener, chart: VS_4BET, nearby: none };
  if (raises.length === 2) return { spot: "vs-3bet", position, opener, chart: VS_3BET, nearby: none };
  const early = opener !== null && EARLY.includes(opener);
  const chart = position === "BB" ? (early ? VS_OPEN.bbEarly : VS_OPEN.bbLate)
    : position === "SB" ? (early ? VS_OPEN.sb : VS_OPEN.sbVsLate)
    : early ? (position === "CO" || position === "BTN" ? VS_OPEN.lateVsEarly : VS_OPEN.early)
    : VS_OPEN.late;
  return { spot: "vs-open", position, opener, chart, nearby: none };
}

export const chartMove = (c: ResponseChart, cls: HandClass): ChartMove =>
  c.raise.has(cls) ? "raise" : c.call.has(cls) ? "call" : "fold";

export const RESPONSE_CHART_SOURCE =
  "pokercoach default 6-max 100bb charts for opening, facing a raise, a re-raise and limpers. Approximate, written for this app.";
