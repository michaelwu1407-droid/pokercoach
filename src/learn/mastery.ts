import type { Verdict } from "../grading/types";

export interface Mastery {
  readonly conceptId: string;
  readonly attempts: number;
  /** Moving average of graded correctness, 0..1. */
  readonly estimate: number;
  readonly intervalMs: number;
  readonly dueAt: number;
}

const MINUTE = 60_000;
const FIRST_INTERVAL = 10 * MINUTE;
const RELEARN_INTERVAL = 2 * MINUTE;
const GROWTH = 2.5;
const MASTERED = 0.8;

const SCORE: Record<Verdict, number> = { good: 1, small: 0.6, mistake: 0, blunder: 0 };

export const fresh = (conceptId: string, now: number): Mastery => ({ conceptId, attempts: 0, estimate: 0, intervalMs: 0, dueAt: now });

/**
 * Spaced review. A good decision pushes the next review further out. A mistake brings the concept
 * back within minutes, where the learner meets it again as a fresh decision, not a reread.
 */
export function record(m: Mastery, verdict: Verdict, now: number): Mastery {
  const score = SCORE[verdict];
  const estimate = m.attempts === 0 ? score : 0.7 * m.estimate + 0.3 * score;
  const intervalMs = score >= 0.6 ? (m.intervalMs === 0 ? FIRST_INTERVAL : Math.round(m.intervalMs * GROWTH)) : RELEARN_INTERVAL;
  return { conceptId: m.conceptId, attempts: m.attempts + 1, estimate, intervalMs, dueAt: now + intervalMs };
}

/** A concept is being studied while it is due or not yet mastered. */
export const studying = (m: Mastery, now: number) => m.dueAt <= now || m.estimate < MASTERED;
export const mastered = (m: Mastery) => m.attempts >= 3 && m.estimate >= MASTERED;
