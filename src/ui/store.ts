import type { Verdict } from "../grading/types";
import { emptyLearner, type Learner, type LogEntry, type SavedSpot } from "../learn/learner";

const VERDICTS: readonly Verdict[] = ["good", "small", "mistake", "blunder"];

const KEY = "pokercoach.learner.v3";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function isLogEntry(v: unknown): v is LogEntry {
  return isObject(v) && isNumber(v.at) && (v.origin === "play" || v.origin === "drill") && VERDICTS.some((x) => x === v.verdict)
    && (v.evLossBB === null || isNumber(v.evLossBB)) && isStrings(v.conceptIds);
}

function isSpot(v: unknown): v is SavedSpot {
  return isObject(v) && typeof v.id === "string" && isNumber(v.dueAt) && isStrings(v.conceptIds)
    && isObject(v.hand) && isNumber(v.hand.seed) && Array.isArray(v.hand.events) && isObject(v.hand.opponents);
}

/** Saved progress is outside data: keep only entries with the right shape, so a bad save never breaks the app. */
export function parseLearner(raw: unknown): Learner {
  if (!isObject(raw)) return emptyLearner;
  return {
    log: Array.isArray(raw.log) ? raw.log.filter(isLogEntry) : [],
    spots: Array.isArray(raw.spots) ? raw.spots.filter(isSpot) : [],
  };
}

export function loadLearner(): Learner {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseLearner(JSON.parse(raw)) : emptyLearner;
  } catch {
    return emptyLearner;
  }
}

export function saveLearner(l: Learner): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    // Storage can be blocked. Learning still works for this session.
  }
}
