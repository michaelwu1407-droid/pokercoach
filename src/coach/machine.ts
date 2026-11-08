import type { Grade } from "../grading/types";

/** How big a loss interrupts play even when the spot is not being studied. */
export const INTERRUPT_LOSS_BB = 2;

export type CoachState =
  | { readonly kind: "idle"; readonly pausesThisHand: number }
  /** Play is paused before the learner acts. They commit to a decision and, optionally, a reason. */
  | { readonly kind: "predict"; readonly conceptIds: readonly string[]; readonly pausesThisHand: number }
  | { readonly kind: "reveal"; readonly grade: Grade; readonly conceptIds: readonly string[]; readonly reason: string | null; readonly pausesThisHand: number }
  | { readonly kind: "review"; readonly grades: readonly Grade[] };

export type CoachEvent =
  | { readonly type: "heroTurn"; readonly studiedConceptIds: readonly string[] }
  | { readonly type: "heroActed"; readonly grade: Grade; readonly conceptIds: readonly string[]; readonly reason: string | null }
  | { readonly type: "dismiss" }
  | { readonly type: "handEnded"; readonly grades: readonly Grade[] }
  | { readonly type: "newHand" };

/** At most this many prediction pauses per hand, so studying never drowns out play. */
const MAX_PAUSES_PER_HAND = 1;

export const initialCoach: CoachState = { kind: "idle", pausesThisHand: 0 };

function interrupts(g: Grade): boolean {
  if (!g.graded) return false;
  if (g.evLossBB === null) return g.verdict !== "good";
  return g.evLossBB >= INTERRUPT_LOSS_BB;
}

export function coach(state: CoachState, event: CoachEvent): CoachState {
  switch (event.type) {
    case "newHand":
      return initialCoach;
    case "handEnded":
      return { kind: "review", grades: event.grades };
    case "dismiss":
      return state.kind === "reveal" ? { kind: "idle", pausesThisHand: state.pausesThisHand } : state;
    case "heroTurn": {
      if (state.kind !== "idle") return state;
      if (event.studiedConceptIds.length === 0 || state.pausesThisHand >= MAX_PAUSES_PER_HAND) return state;
      return { kind: "predict", conceptIds: event.studiedConceptIds, pausesThisHand: state.pausesThisHand + 1 };
    }
    case "heroActed": {
      if (state.kind === "review") return state;
      const pausesThisHand = state.pausesThisHand;
      const wasStudied = state.kind === "predict";
      if (!wasStudied && !interrupts(event.grade)) return { kind: "idle", pausesThisHand };
      return { kind: "reveal", grade: event.grade, conceptIds: event.conceptIds, reason: event.reason, pausesThisHand };
    }
  }
}
