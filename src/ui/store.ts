import { CORE_CONCEPTS, type Concept } from "../learn/concepts";
import { emptyLearner, type Learner } from "../learn/learner";

const KEY = "pokercoach.learner.v2";

export function loadLearner(): Learner {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyLearner;
    const parsed = JSON.parse(raw) as Partial<Learner>;
    return { mastery: parsed.mastery ?? {}, log: parsed.log ?? [], spots: parsed.spots ?? [] };
  } catch {
    return emptyLearner;
  }
}

export function saveLearner(l: Learner): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    // Storage can be full or blocked. Learning still works for this session.
  }
}

export const ALL_CONCEPTS: readonly Concept[] = CORE_CONCEPTS;
