import type { Style } from "../bots/styles";
import { legalActions } from "../engine/reduce";
import type { HandState, SeatIndex, Street } from "../engine/types";
import { type Position, positionOf } from "../evaluator/preflopCharts";

/** What a concept can test about a decision. Derived from state only, so it never sees the future. */
export interface SpotView {
  readonly street: Street;
  readonly position: Position;
  readonly raiseFirstIn: boolean;
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
    facingBet: legal.callAmount > 0,
    headsUp: live.length === 2,
    villainStyle: villain === null ? null : (styles[villain]?.id ?? null),
  };
}

/**
 * The only situation tests a concept may use. Book concepts pick ids from this table, so an
 * extracted concept can never introduce code.
 */
export const PREDICATES = {
  "preflop-raise-first-in": (s: SpotView) => s.raiseFirstIn,
  "postflop": (s: SpotView) => s.street !== "preflop",
  "river": (s: SpotView) => s.street === "river",
  "facing-bet": (s: SpotView) => s.facingBet,
  "not-facing-bet": (s: SpotView) => !s.facingBet,
  "heads-up": (s: SpotView) => s.headsUp,
  "late-position": (s: SpotView) => s.position === "CO" || s.position === "BTN",
  "early-position": (s: SpotView) => s.position === "UTG" || s.position === "HJ",
  "vs-nit": (s: SpotView) => s.villainStyle === "nit",
  "vs-maniac": (s: SpotView) => s.villainStyle === "lag",
  "vs-station": (s: SpotView) => s.villainStyle === "station",
} as const satisfies Record<string, (s: SpotView) => boolean>;

export type PredicateId = keyof typeof PREDICATES;
export const isPredicateId = (x: string): x is PredicateId => Object.hasOwn(PREDICATES, x);
