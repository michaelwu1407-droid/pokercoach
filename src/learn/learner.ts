import type { Hand } from "../session/session";
import type { Grade, Verdict } from "../grading/types";
import { fresh, type Mastery, record, studying } from "./mastery";

export type Origin = "play" | "drill" | "benchmark";

export interface LogEntry {
  readonly at: number;
  readonly origin: Origin;
  readonly verdict: Verdict;
  readonly evLossBB: number | null;
  readonly conceptIds: readonly string[];
}

export interface SavedSpot {
  readonly id: string;
  /** The hand just before the decision, with its opponents, so the drill replays it exactly. */
  readonly hand: Hand;
  readonly conceptIds: readonly string[];
  readonly savedAt: number;
}

export interface Learner {
  readonly mastery: Readonly<Record<string, Mastery>>;
  readonly log: readonly LogEntry[];
  /** Spots the learner got wrong. Drills replay them as fresh decisions. */
  readonly spots: readonly SavedSpot[];
}

export const emptyLearner: Learner = { mastery: {}, log: [], spots: [] };
const MAX_SPOTS = 200;

export function learnFrom(l: Learner, g: Grade, conceptIds: readonly string[], before: Hand, origin: Origin, now: number): Learner {
  if (!g.graded) return l;
  const mastery = { ...l.mastery };
  for (const id of conceptIds) mastery[id] = record(mastery[id] ?? fresh(id, now), g.verdict, now);
  const log = [...l.log, { at: now, origin, verdict: g.verdict, evLossBB: g.evLossBB, conceptIds }];
  const wrong = g.verdict === "mistake" || g.verdict === "blunder";
  const id = `${now}-${l.spots.length}`;
  const spots = wrong && origin !== "benchmark" && conceptIds.length > 0
    ? [...l.spots, { id, hand: { ...before, grades: [] }, conceptIds, savedAt: now }].slice(-MAX_SPOTS)
    : l.spots;
  return { mastery, log, spots };
}

/** Concepts the coach should pause on now. Unseen concepts count as studied. */
export function studiedIds(l: Learner, candidateIds: readonly string[], now: number): string[] {
  return candidateIds.filter((id) => {
    const m = l.mastery[id];
    return m === undefined || studying(m, now);
  });
}

/**
 * Next drills: saved mistakes whose concepts are due, interleaved so consecutive drills
 * practise different concepts.
 */
export function drillQueue(l: Learner, now: number, size = 10): SavedSpot[] {
  const due = l.spots.filter((s) => s.conceptIds.some((id) => (l.mastery[id]?.dueAt ?? 0) <= now));
  const byConcept = new Map<string, SavedSpot[]>();
  for (const s of [...due].reverse()) {
    const k = s.conceptIds[0]!;
    byConcept.set(k, [...(byConcept.get(k) ?? []), s]);
  }
  const out: SavedSpot[] = [];
  const queues = [...byConcept.values()];
  while (out.length < size && queues.some((q) => q.length > 0))
    for (const q of queues) if (q.length > 0 && out.length < size) out.push(q.shift()!);
  return out;
}
