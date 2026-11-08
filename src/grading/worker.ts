/// <reference lib="webworker" />
import type { PlayerAction } from "../engine/types";
import { gradeDecision, type Hand } from "../session/session";

/** Grades off the main thread, so the table keeps moving while the coach works. */
self.onmessage = (e: MessageEvent<{ id: number; before: Hand; action: PlayerAction }>) => {
  const { id, before, action } = e.data;
  self.postMessage({ id, grade: gradeDecision(before, action) });
};
