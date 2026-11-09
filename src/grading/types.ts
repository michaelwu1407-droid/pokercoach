import type { PlayerAction, SeatIndex, Street } from "../engine/types";
import type { Position } from "../evaluator/preflopCharts";
import type { ChartMove, ChartRow, PreflopSpot } from "../evaluator/responseCharts";
import type { GroupKind, HandGroup } from "../evaluator/handGroups";
import type { MixShare } from "./rangeMix";
import type { Draw } from "./outs";

export type Verdict = "good" | "small" | "mistake" | "blunder";

export interface ActionValue {
  readonly action: PlayerAction;
  /** Expected chips won from this point, in big blinds. Chips already in the pot are sunk. */
  readonly evBB: number;
  /** For a bet or raise: how often everyone folds to it, and your chance to win when someone continues. */
  readonly foldShare: number | null;
  readonly winWhenCalled: number | null;
  /** For a bet or raise: how often everyone must fold for it to pay off on folds alone. Set by grade(). */
  readonly foldNeeded?: number;
  /** What the bet adds, and the pot once it is in: foldNeeded = risk ÷ potWithBet. Set by grade(). */
  readonly risk?: number;
  readonly potWithBet?: number;
}

export type Basis =
  | {
      readonly kind: "chart";
      readonly spot: PreflopSpot;
      readonly source: string;
      readonly position: Position;
      /** Seat of the first raiser, when there is one. */
      readonly opener: Position | null;
      readonly openerSeat: SeatIndex | null;
      readonly handClass: string;
      readonly bestMove: ChartMove;
      /** You raised a hand that is a standard raise one seat later. */
      readonly borderline: boolean;
      /** You raised far more than the usual size. */
      readonly oversized: boolean;
      /** Share of all starting hands the chart raises, and calls, in this spot. */
      readonly raiseShare: number;
      readonly callShare: number;
      /** raiseShare + callShare. */
      readonly continueShare: number;
      /** How many of the ALL_HANDS starting hands the chart plays here: continueShare = listSize / allHands. */
      readonly listSize: number;
      /** The main types in the list (pairs, Ace with a Ten or higher, ...), and how many listed hands are other types. */
      readonly groups: readonly HandGroup[];
      readonly otherCombos: number;
      readonly allHands: number;
      /** 1 - continueShare: the hands to fold. */
      readonly foldShare: number;
      /** Players still to act after you this round. */
      readonly behind: number;
      /** The chart's line for hands like yours, so the lesson can name real hands. */
      readonly row: ChartRow;
      /** About one hand in this many is played here: 1 / continueShare, rounded. */
      readonly playOneIn: number;
      /** Share of hands the first raiser opens from their seat, when someone raised. */
      readonly openerShare: number | null;
      /** The rule of thumb: how many hands to open from each seat, rounded to 5%. */
      readonly ladder: readonly { readonly position: Position; readonly roughPct: number }[];
    }
  | {
      readonly kind: "ev";
      /** The opponent the card focuses on: the last bettor, or the next to act. */
      readonly villain: SeatIndex;
      /** How many opponents are still in the hand. */
      readonly opponents: number;
      /** What the opponent likely holds, grouped by hand type. Shares sum to 1. */
      readonly mix: readonly MixShare[];
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
  /** Opponents it is measured against. Empty means one random hand, used preflop before anyone puts money in. */
  readonly against: readonly SeatIndex[];
  /** Before the flop against one player: how many hands they play the way they did, and the main types. */
  readonly theirs: { readonly hands: number; readonly mostly: readonly GroupKind[] } | null;
}

export interface Facing {
  /** The total bet you had to match this round. */
  readonly to: number;
  /** Who made it. Null for the big blind's forced bet. */
  readonly by: SeatIndex | null;
  /** What calling costs you, and the pot once you have called: call ÷ potAfter is the share you must win. */
  readonly call: number;
  readonly potAfter: number;
}

/** Shares to win needed against a half-pot and a pot-size bet: the two to remember. */
export const CALL_GUIDE = { halfPot: 1 / 4, fullPot: 1 / 3 } as const;
/** How often they must fold for a half-pot and a pot-size bluff to pay off. */
export const BLUFF_GUIDE = { halfPot: 1 / 3, fullPot: 1 / 2 } as const;

export interface Graded {
  readonly graded: true;
  /** Chips in the pot when you decided, and what you had already put in this round. */
  readonly pot: number;
  readonly committed: number;
  /** An even share of the pot among everyone still in: 1 ÷ players. Beating it is why raising a big pot pays. */
  readonly fairShare: number;
  /** The five shared cards are your best hand, so at best you split the pot. */
  readonly boardPlays: boolean;
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
  readonly facing: Facing | null;
  /** Your total bet this round if you went all-in, so every surface can name all-in the same way. */
  readonly allInTo: number;
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
export type GradeCore = Omit<Graded, "win" | "draw" | "facing" | "allInTo" | "pot" | "committed" | "fairShare" | "boardPlays"> | Ungraded;

/** Mistakes and blunders: the decisions that count against you and come back as practice. */
export const isMiss = (v: Verdict) => v === "mistake" || v === "blunder";

export const aggressive = (a: PlayerAction) => a.type === "bet" || a.type === "raise";

/**
 * Right idea with the wrong size is at most a "mistake", and only "close" under 3bb, because the
 * choice to bet was right. The card still shows what the better size earns.
 */
export function verdictForChoice(chosen: PlayerAction, best: PlayerAction, evLossBB: number): Verdict {
  const v = verdictFor(evLossBB);
  if (!aggressive(chosen) || !aggressive(best) || v === "good") return v;
  return evLossBB < 3 ? "small" : "mistake";
}

export function verdictFor(evLossBB: number): Verdict {
  if (evLossBB < 0.25) return "good";
  if (evLossBB < 1) return "small";
  if (evLossBB < 3) return "mistake";
  return "blunder";
}
