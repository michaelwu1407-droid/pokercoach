import { parseRange, type HandClass } from "./ranges";
import { blindSeats } from "../engine/reduce";
import type { SeatIndex, TableConfig } from "../engine/types";

export type Position = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB";

/** Seats clockwise from the button for each table size. Short tables drop the early seats. */
const LAYOUT: Record<number, readonly Position[]> = {
  2: ["BTN", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "CO"],
  5: ["BTN", "SB", "BB", "HJ", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
};

export function positionOf(config: TableConfig, seat: SeatIndex): Position {
  const n = config.seats.length;
  const layout = LAYOUT[n];
  if (!layout) throw new Error(`no position layout for ${n} seats`);
  if (n === 2) return seat === blindSeats(config).bb ? "BB" : "BTN";
  return layout[(seat - config.button + n) % n]!;
}

export interface Chart {
  readonly id: string;
  /** Who stands behind this chart. Shown to the learner with every chart-based grade. */
  readonly source: string;
  readonly raise: ReadonlySet<HandClass>;
}

const DEFAULT_SOURCE =
  "pokercoach default 6-max 100bb open-raise chart. Approximate, written for this app. Replace with a chart from your own books.";

const chart = (position: Position, text: string): Chart => ({
  id: `rfi-${position}`,
  source: DEFAULT_SOURCE,
  raise: parseRange(text),
});

/** Raise-first-in charts. Any hand outside the chart folds when the action folds to you. */
export const RFI: Readonly<Partial<Record<Position, Chart>>> = {
  UTG: chart("UTG", "55+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, AJo+, KQo"),
  HJ: chart("HJ", "33+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, ATo+, KJo+, QJo"),
  CO: chart("CO", "22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, KTo+, QTo+, JTo"),
  BTN: chart("BTN", "22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o"),
  SB: chart("SB", "22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 97s+, 86s+, 75s+, 65s, 54s, A4o+, K9o+, QTo+, JTo"),
};
