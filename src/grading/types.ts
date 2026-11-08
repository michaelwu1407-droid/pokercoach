import type { PlayerAction, SeatIndex, Street } from "../engine/types";

export type Verdict = "good" | "small" | "mistake" | "blunder";

export interface ActionValue {
  readonly action: PlayerAction;
  /** Expected chips won from this point, in big blinds. Chips already in the pot are sunk. */
  readonly evBB: number;
}

export type Basis =
  | { readonly kind: "chart"; readonly chartId: string; readonly source: string; readonly inChart: boolean; readonly handClass: string }
  | {
      readonly kind: "ev";
      readonly values: readonly ActionValue[];
      /** Hero's showdown equity against the inferred range, before anyone acts. */
      readonly equity: number;
      readonly potOddsNeeded: number | null;
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
