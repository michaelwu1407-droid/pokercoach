import type { PlayerAction, SeatIndex, Street } from "../engine/types";
import type { Position } from "../evaluator/preflopCharts";
import type { MixShare } from "./rangeMix";

export type Verdict = "good" | "small" | "mistake" | "blunder";

export interface ActionValue {
  readonly action: PlayerAction;
  /** Expected chips won from this point, in big blinds. Chips already in the pot are sunk. */
  readonly evBB: number;
}

export type Basis =
  | {
      readonly kind: "chart";
      readonly chartId: string;
      readonly source: string;
      readonly position: Position;
      readonly inChart: boolean;
      readonly handClass: string;
      /** Share of all starting hands the chart opens from this seat. */
      readonly chartShare: number;
    }
  | {
      readonly kind: "ev";
      readonly villain: SeatIndex;
      /** What the opponent likely holds, grouped by hand type. Shares sum to 1. */
      readonly mix: readonly MixShare[];
      /** Share of their range that folds to the smallest offered bet or raise. Null when you cannot raise. */
      readonly foldToBet: number | null;
      /** Your equity against the hands that call or raise that bet. */
      readonly equityWhenCalled: number | null;
      readonly values: readonly ActionValue[];
      /** Hero's showdown equity against the inferred range, before anyone acts. */
      readonly equity: number;
      readonly potOddsNeeded: number | null;
      /** Effective number of equally likely hands in the inferred range. */
      readonly rangeSize: number;
      /** Plain-English list of what this number simplifies. Shown to the learner. */
      readonly approximations: readonly string[];
    };

export type Grade =
  | {
      readonly graded: true;
      readonly street: Street;
      readonly seat: SeatIndex;
      readonly action: PlayerAction;
      readonly best: PlayerAction;
      /** Null for chart grades, which judge a deviation, not a measured loss. */
      readonly evLossBB: number | null;
      readonly verdict: Verdict;
      readonly basis: Basis;
    }
  | { readonly graded: false; readonly street: Street; readonly seat: SeatIndex; readonly action: PlayerAction; readonly reason: string };

export function verdictFor(evLossBB: number): Verdict {
  if (evLossBB < 0.25) return "good";
  if (evLossBB < 1) return "small";
  if (evLossBB < 3) return "mistake";
  return "blunder";
}
