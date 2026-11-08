import type { Grade } from "../grading/types";

/** A loss this big pauses play. Smaller ones show feedback without stopping the hand. */
export const PAUSE_LOSS_BB = 2;

export type CoachState =
  | { readonly kind: "idle" }
  /** Feedback on the last decision. `paused` holds play until the learner continues. */
  | { readonly kind: "feedback"; readonly grade: Grade; readonly conceptIds: readonly string[]; readonly paused: boolean };

export type CoachEvent =
  | { readonly type: "heroActed"; readonly grade: Grade; readonly conceptIds: readonly string[] }
  | { readonly type: "continue" }
  | { readonly type: "newHand" };

export const initialCoach: CoachState = { kind: "idle" };

export function pauses(g: Grade): boolean {
  if (!g.graded) return false;
  if (g.evLossBB === null) return g.verdict !== "good";
  return g.evLossBB >= PAUSE_LOSS_BB;
}

/** Every decision gets feedback after it is made. Only costly mistakes stop play. */
export function coach(state: CoachState, event: CoachEvent): CoachState {
  switch (event.type) {
    case "newHand":
      return initialCoach;
    case "continue":
      return state.kind === "feedback" ? { ...state, paused: false } : state;
    case "heroActed":
      return { kind: "feedback", grade: event.grade, conceptIds: event.conceptIds, paused: pauses(event.grade) };
  }
}
