import type { PlayerAction, SeatIndex, Street } from "../engine/types";
import type { Position } from "../evaluator/preflopCharts";
import type { ChartMove, PreflopSpot } from "../evaluator/responseCharts";
import type { MixShare } from "./rangeMix";
import type { Draw } from "./outs";

export type Verdict = "good" | "small" | "mistake" | "blunder";

export interface ActionValue {
  readonly action: PlayerAction;
  /** Expected chips won from this point, in big blinds. Chips already in the pot are sunk. */
  readonly evBB: number;
}

export type Basis =
  | {
      readonly kind: "chart";
      readonly spot: PreflopSpot;
      readonly source: string;
      readonly position: Position;
      /** Seat of the first raiser, when there is one. */
      readonly opener: Position | null;
      readonly handClass: string;
      readonly bestMove: ChartMove;
      /** You raised a hand that is a standard raise one seat later. */
      readonly borderline: boolean;
      /** Share of all starting hands the chart raises, and calls, in this spot. */
      readonly raiseShare: number;
      readonly callShare: number;
      /** raiseShare + callShare. */
      readonly continueShare: number;
      /** Players still to act after you this round. */
      readonly behind: number;
    }
  | {
      readonly kind: "ev";
      /** The opponent the card focuses on: the last bettor, or the next to act. */
      readonly villain: SeatIndex;
      /** How many opponents are still in the hand. */
      readonly opponents: number;
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

export interface Win {
  /** Your share of the pot if all cards were dealt out now. */
  readonly chance: number;
  /** Opponents it is measured against. 0 means one random hand, used preflop before anyone puts money in. */
  readonly against: number;
}

export interface Graded {
  readonly graded: true;
  readonly street: Street;
  readonly seat: SeatIndex;
  readonly action: PlayerAction;
  readonly best: PlayerAction;
  /** Null for chart grades, which judge a deviation, not a measured loss. */
  readonly evLossBB: number | null;
  readonly verdict: Verdict;
  readonly basis: Basis;
  readonly win: Win;
  readonly draw: Draw | null;
}

export interface Ungraded {
  readonly graded: false;
  readonly street: Street;
  readonly seat: SeatIndex;
  readonly action: PlayerAction;
  readonly reason: string;
}

export type Grade = Graded | Ungraded;
/** What each grader returns. `grade` adds your chance to win and any draw. */
export type GradeCore = Omit<Graded, "win" | "draw"> | Ungraded;

const aggressive = (a: PlayerAction) => a.type === "bet" || a.type === "raise";

/**
 * Right idea with the wrong size is "small" at most. Sizing is a second-order skill, and the card
 * still shows what the better size earns.
 */
export function verdictForChoice(chosen: PlayerAction, best: PlayerAction, evLossBB: number): Verdict {
  const v = verdictFor(evLossBB);
  return aggressive(chosen) && aggressive(best) && v !== "good" ? "small" : v;
}

export function verdictFor(evLossBB: number): Verdict {
  if (evLossBB < 0.25) return "good";
  if (evLossBB < 1) return "small";
  if (evLossBB < 3) return "mistake";
  return "blunder";
}
