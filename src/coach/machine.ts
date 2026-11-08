import type { Grade } from "../grading/types";

/** A loss this big pauses play. Smaller ones show feedback without stopping the hand. */
export const PAUSE_LOSS_BB = 2;

export type CoachState =
  | { readonly kind: "idle"; readonly pausedThisHand: boolean }
  /** Feedback on the last decision. `paused` holds play until the learner continues. */
  | { readonly kind: "feedback"; readonly grade: Grade; readonly conceptIds: readonly string[]; readonly paused: boolean; readonly pausedThisHand: boolean };

export type CoachEvent =
  | { readonly type: "heroActed"; readonly grade: Grade; readonly conceptIds: readonly string[] }
  | { readonly type: "continue" }
  | { readonly type: "newHand" };

export const initialCoach: CoachState = { kind: "idle", pausedThisHand: false };

export function pauses(g: Grade): boolean {
  if (!g.graded || (g.verdict !== "mistake" && g.verdict !== "blunder")) return false;
  return g.evLossBB === null || g.evLossBB >= PAUSE_LOSS_BB;
}

/**
 * Every decision gets feedback after it is made. Only a costly mistake stops play, and at most once
 * per hand, so a rough hand does not turn into a lecture.
 */
export function coach(state: CoachState, event: CoachEvent): CoachState {
  switch (event.type) {
    case "newHand":
      return initialCoach;
    case "continue":
      return state.kind === "feedback" ? { ...state, paused: false } : state;
    case "heroActed": {
      const paused = !state.pausedThisHand && pauses(event.grade);
      return { kind: "feedback", grade: event.grade, conceptIds: event.conceptIds, paused, pausedThisHand: state.pausedThisHand || paused };
    }
  }
}
