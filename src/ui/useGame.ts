import { useCallback, useEffect, useReducer, useState } from "react";
import type { Opponents } from "../bots/opponents";
import type { PlayerAction } from "../engine/types";
import type { Grade } from "../grading/types";
import { CORE_CONCEPTS } from "../learn/concepts";
import { drillQueue, learnFrom, type Learner, type SavedSpot } from "../learn/learner";
import { advance, conceptsAt, type Hand, HANDS_PER_TABLE, newHand, newTable, state } from "../session/session";
import { gradeLater } from "./grader";
import { loadLearner, saveLearner } from "./store";

/** Pause between opponents' actions, so each one can be followed. */
export const ACTION_DELAY_MS = 450;

export type Mode =
  | { readonly kind: "play"; readonly handNo: number; readonly opponents: Opponents }
  | { readonly kind: "drill"; readonly queue: readonly SavedSpot[]; readonly index: number };

/** One of your decisions this hand. The grade arrives from the worker a moment later. */
export interface Decision {
  readonly before: Hand;
  readonly action: PlayerAction;
  readonly grade: Grade | null;
}

interface GameState {
  readonly mode: Mode;
  readonly hand: Hand;
  /** How many of the hand's events are on screen. Opponents' actions appear one at a time. */
  readonly shown: number;
  readonly decisions: readonly Decision[];
}

type Event =
  | { readonly type: "deal"; readonly mode: Mode; readonly hand: Hand }
  | { readonly type: "act"; readonly action: PlayerAction; readonly next: Hand }
  | { readonly type: "graded"; readonly index: number; readonly grade: Grade }
  | { readonly type: "tick" }
  | { readonly type: "skip" };

const dealt = (mode: Mode, hand: Hand): GameState =>
  ({ mode, hand, shown: mode.kind === "drill" ? hand.events.length : 1, decisions: [] });

function reducer(s: GameState, e: Event): GameState {
  switch (e.type) {
    case "deal":
      return dealt(e.mode, e.hand);
    case "act": {
      const decisions = [...s.decisions, { before: s.hand, action: e.action, grade: null }];
      // Practice stops at your answer. Play shows your action at once and the others one by one.
      if (s.mode.kind === "drill") return { ...s, decisions };
      return { ...s, hand: e.next, shown: s.hand.events.length + 1, decisions };
    }
    case "graded":
      return { ...s, decisions: s.decisions.map((d, i) => (i === e.index ? { ...d, grade: e.grade } : d)) };
    case "tick":
      return { ...s, shown: Math.min(s.hand.events.length, s.shown + 1) };
    case "skip":
      return { ...s, shown: s.hand.events.length };
  }
}

const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

function dealPlay(handNo: number, opponents: Opponents): Event {
  return { type: "deal", mode: { kind: "play", handNo, opponents }, hand: newHand(freshSeed(), handNo, opponents) };
}

export function useGame() {
  const [learner, setLearner] = useState<Learner>(loadLearner);
  const [s, dispatch] = useReducer(reducer, null, () => {
    const opponents = newTable(freshSeed());
    return dealt({ kind: "play", handNo: 0, opponents }, newHand(freshSeed(), 0, opponents));
  });
  useEffect(() => saveLearner(learner), [learner]);

  const playing = s.shown < s.hand.events.length;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => dispatch({ type: "tick" }), ACTION_DELAY_MS);
    return () => clearTimeout(t);
  }, [playing, s.shown]);

  const act = useCallback((action: PlayerAction) => {
    const before = s.hand;
    const index = s.decisions.length;
    const origin = s.mode.kind === "drill" ? "drill" : "play";
    dispatch({ type: "act", action, next: s.mode.kind === "drill" ? before : advance(before, action) });
    void gradeLater(before, action).then((grade) => {
      dispatch({ type: "graded", index, grade });
      const ids = grade.graded ? conceptsAt(state(before), before.opponents, CORE_CONCEPTS).map((c) => c.id) : [];
      setLearner((l) => learnFrom(l, grade, ids, before, origin, Date.now()));
    });
  }, [s]);

  const nextHand = useCallback(() => {
    if (s.mode.kind !== "play") return dispatch(dealPlay(0, newTable(freshSeed())));
    const handNo = s.mode.handNo + 1;
    dispatch(dealPlay(handNo, handNo % HANDS_PER_TABLE === 0 ? newTable(freshSeed()) : s.mode.opponents));
  }, [s.mode]);

  const startDrills = useCallback(() => {
    const queue = drillQueue(learner, Date.now());
    const first = queue[0];
    if (first) dispatch({ type: "deal", mode: { kind: "drill", queue, index: 0 }, hand: first.hand });
  }, [learner]);

  const nextDrill = useCallback(() => {
    if (s.mode.kind !== "drill") return;
    const index = s.mode.index + 1;
    const spot = s.mode.queue[index];
    dispatch(spot ? { type: "deal", mode: { ...s.mode, index }, hand: spot.hand } : dealPlay(0, newTable(freshSeed())));
  }, [s.mode]);

  const stopDrills = useCallback(() => dispatch(dealPlay(0, newTable(freshSeed()))), []);
  const skip = useCallback(() => dispatch({ type: "skip" }), []);
  const shown: Hand = playing ? { ...s.hand, events: s.hand.events.slice(0, s.shown) } : s.hand;
  const newTableHand = s.mode.kind === "play" && s.mode.handNo % HANDS_PER_TABLE === 0;

  return { mode: s.mode, hand: s.hand, shown, playing, decisions: s.decisions, learner, newTableHand, act, skip, nextHand, startDrills, nextDrill, stopDrills };
}

export type Game = ReturnType<typeof useGame>;
