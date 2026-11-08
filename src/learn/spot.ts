import type { Style } from "../bots/styles";
import { legalActions } from "../engine/reduce";
import type { HandState, SeatIndex, Street } from "../engine/types";
import { type Position, positionOf } from "../evaluator/preflopCharts";
import { type PreflopSpot, readPreflop } from "../evaluator/responseCharts";

/** What a concept can test about a decision. Derived from state only, so it never sees the future. */
export interface SpotView {
  readonly street: Street;
  readonly position: Position;
  readonly raiseFirstIn: boolean;
  readonly preflopSpot: PreflopSpot | null;
  readonly facingBet: boolean;
  readonly headsUp: boolean;
  readonly villainStyle: Style["id"] | null;
}

export function spotView(st: HandState, hero: SeatIndex, styles: Readonly<Record<SeatIndex, Style>>): SpotView {
  const legal = legalActions(st);
  if (!legal || legal.seat !== hero) throw new Error("spotView needs hero to act");
  const live = st.seats.map((_, i) => i).filter((i) => !st.seats[i]!.folded);
  const villain = live.length === 2 ? live.find((i) => i !== hero)! : null;
  return {
    street: st.street,
    position: positionOf(st.config, hero),
    raiseFirstIn: st.street === "preflop" && st.history.every((a) => a.type === "fold"),
    preflopSpot: st.street === "preflop" ? readPreflop(st, hero).spot : null,
    facingBet: legal.callAmount > 0,
    headsUp: live.length === 2,
    villainStyle: villain === null ? null : (styles[villain]?.id ?? null),
  };
}

/** The situation tests concepts are built from. One table, so a new skill never adds branching elsewhere. */
export const PREDICATES = {
  "preflop-raise-first-in": (s: SpotView) => s.raiseFirstIn,
  "preflop-vs-limp": (s: SpotView) => s.preflopSpot === "vs-limp",
  "preflop-vs-open": (s: SpotView) => s.preflopSpot === "vs-open",
  "preflop-vs-reraise": (s: SpotView) => s.preflopSpot === "vs-3bet" || s.preflopSpot === "vs-4bet",
  "postflop": (s: SpotView) => s.street !== "preflop",
  "facing-bet": (s: SpotView) => s.facingBet,
  "not-facing-bet": (s: SpotView) => !s.facingBet,
  "heads-up": (s: SpotView) => s.headsUp,
  "multiway": (s: SpotView) => !s.headsUp,
  "vs-nit": (s: SpotView) => s.villainStyle === "nit",
  "vs-maniac": (s: SpotView) => s.villainStyle === "lag",
  "vs-station": (s: SpotView) => s.villainStyle === "station",
} as const satisfies Record<string, (s: SpotView) => boolean>;

export type PredicateId = keyof typeof PREDICATES;
