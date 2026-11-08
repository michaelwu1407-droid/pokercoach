import type { Card } from "../cards/card";

export type SeatIndex = number;

export interface SeatConfig {
  readonly id: string;
  readonly stack: number;
}

export interface TableConfig {
  readonly seats: readonly SeatConfig[];
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly button: SeatIndex;
}

/** A hand is `[Start, ...PlayerAction[]]`. Everything else is derived by `reduce`. */
export type Start = { readonly type: "start"; readonly config: TableConfig; readonly deck: readonly Card[] };

export type PlayerAction =
  | { readonly type: "fold"; readonly seat: SeatIndex }
  | { readonly type: "check"; readonly seat: SeatIndex }
  | { readonly type: "call"; readonly seat: SeatIndex }
  /** `to` is the seat's total commitment on this street after the action. */
  | { readonly type: "bet"; readonly seat: SeatIndex; readonly to: number }
  | { readonly type: "raise"; readonly seat: SeatIndex; readonly to: number };

export type HandEvent = Start | PlayerAction;

export type Street = "preflop" | "flop" | "turn" | "river";

export interface SeatState {
  readonly id: string;
  readonly hole: readonly [Card, Card];
  readonly stack: number;
  readonly street: number;
  readonly total: number;
  readonly folded: boolean;
}

export interface Payout {
  readonly seat: SeatIndex;
  readonly amount: number;
}

interface Common {
  readonly config: TableConfig;
  readonly deck: readonly Card[];
  readonly seats: readonly SeatState[];
  readonly board: readonly Card[];
  readonly street: Street;
  readonly history: readonly PlayerAction[];
}

export type HandState =
  | (Common & {
      readonly phase: "betting";
      readonly toAct: SeatIndex;
      readonly currentBet: number;
      /** Size of the last full bet or raise. The next raise must add at least this. */
      readonly lastRaise: number;
      /** Seats that still must act before the round closes. */
      readonly pending: readonly SeatIndex[];
      /** Seats that acted since the last full raise. They may call or fold but not re-raise. */
      readonly closedToRaise: readonly SeatIndex[];
    })
  | (Common & {
      readonly phase: "complete";
      readonly payouts: readonly Payout[];
      readonly showdown: boolean;
    });

export type LegalActions = {
  readonly seat: SeatIndex;
  readonly canCheck: boolean;
  readonly callAmount: number;
  /** Absent when the seat cannot bet or raise. Bounds are street totals. */
  readonly raise?: { readonly kind: "bet" | "raise"; readonly min: number; readonly max: number };
};
