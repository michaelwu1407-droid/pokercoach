import type { PlayerAction } from "../engine/types";
import type { Grade } from "../grading/types";
import GradeWorker from "../grading/worker?worker&inline";
import { gradeDecision, type Hand } from "../session/session";

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, (g: Grade) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new GradeWorker();
    worker.onmessage = (e: MessageEvent<{ id: number; grade: Grade }>) => {
      waiting.get(e.data.id)?.(e.data.grade);
      waiting.delete(e.data.id);
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Grades a decision in a worker, or in place where workers are unavailable. */
export function gradeLater(before: Hand, action: PlayerAction): Promise<Grade> {
  const w = getWorker();
  if (!w) return Promise.resolve(gradeDecision(before, action));
  const id = nextId++;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    w.postMessage({ id, before, action });
  });
}
