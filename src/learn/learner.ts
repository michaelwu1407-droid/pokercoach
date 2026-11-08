import type { Hand } from "../session/session";
import { type Grade, isMiss, type Verdict } from "../grading/types";

export type Origin = "play" | "drill";

export interface LogEntry {
  readonly at: number;
  readonly origin: Origin;
  readonly verdict: Verdict;
  readonly evLossBB: number | null;
  readonly conceptIds: readonly string[];
}

export interface SavedSpot {
  /** The same spot always gets the same id, so a repeated mistake does not save a copy. */
  readonly id: string;
  /** The hand just before the decision, with its opponents, so the practice replays it exactly. */
  readonly hand: Hand;
  readonly conceptIds: readonly string[];
  /** When the spot comes back. A wrong answer brings it back soon; a right one retires it. */
  readonly dueAt: number;
}

export interface Learner {
  readonly log: readonly LogEntry[];
  /** Spots you got wrong. Practice replays them as fresh decisions until you get them right. */
  readonly spots: readonly SavedSpot[];
}

export const emptyLearner: Learner = { log: [], spots: [] };
const MAX_SPOTS = 200;
/** Enough history for many months of weekly progress, well inside browser storage limits. */
const MAX_LOG = 20_000;
export const PRACTICE_DELAY_MS = 2 * 60_000;

export const spotId = (h: Hand) => `${h.seed}:${h.events.length}`;

/**
 * Records a graded decision. A mistake saves the spot for practice. In practice, a right answer
 * retires the spot and a wrong one brings it back after a short delay.
 */
export function learnFrom(l: Learner, g: Grade, conceptIds: readonly string[], before: Hand, origin: Origin, now: number): Learner {
  if (!g.graded) return l;
  const log = [...l.log, { at: now, origin, verdict: g.verdict, evLossBB: g.evLossBB, conceptIds }].slice(-MAX_LOG);
  const id = spotId(before);
  const others = l.spots.filter((s) => s.id !== id);
  const spots = isMiss(g.verdict) && conceptIds.length > 0
    ? [...others, { id, hand: before, conceptIds, dueAt: now + PRACTICE_DELAY_MS }].slice(-MAX_SPOTS)
    : origin === "drill" ? others : l.spots;
  return { log, spots };
}

/** Next practice: saved mistakes that are due, interleaved so consecutive ones practise different skills. */
export function drillQueue(l: Learner, now: number, size = 10): SavedSpot[] {
  const byConcept = new Map<string, SavedSpot[]>();
  for (const s of [...l.spots].reverse()) {
    if (s.dueAt > now) continue;
    const k = s.conceptIds[0] ?? "";
    byConcept.set(k, [...(byConcept.get(k) ?? []), s]);
  }
  const out: SavedSpot[] = [];
  const queues = [...byConcept.values()];
  while (out.length < size && queues.some((q) => q.length > 0))
    for (const q of queues) {
      const next = q.shift();
      if (next && out.length < size) out.push(next);
    }
  return out;
}
