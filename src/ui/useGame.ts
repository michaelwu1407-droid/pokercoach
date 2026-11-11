import { useCallback, useEffect, useReducer, useState } from "react";
import type { PlayerAction } from "../engine/types";
import type { Grade } from "../grading/types";
import { CORE_CONCEPTS } from "../learn/concepts";
import { drillQueue, learnFrom, type Learner, type SavedSpot } from "../learn/learner";
import { advance, conceptsAt, freshGame, type Hand, newHand, nextTable, state, type Table } from "../session/session";
import { gradeLater } from "./grader";
import { loadLearner, saveLearner } from "./store";

/** Pause between opponents' actions, so each one can be followed. */
export const ACTION_DELAY_MS = 450;

export type Mode =
  | ({ readonly kind: "play" } & Table)
  | { readonly kind: "drill"; readonly queue: readonly SavedSpot[]; readonly index: number; readonly resume: Table };

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

function dealPlay(table: Table): Event {
  return { type: "deal", mode: { kind: "play", ...table }, hand: newHand(freshSeed(), table.handNo, table.opponents, table.stacks) };
}

const firstTable = (): Table => freshGame(freshSeed());
const tableOf = (m: Mode): Table => (m.kind === "play" ? m : m.resume);

export function useGame() {
  const [learner, setLearner] = useState<Learner>(loadLearner);
  const [s, dispatch] = useReducer(reducer, null, () => {
    const table = firstTable();
    return dealt({ kind: "play", ...table }, newHand(freshSeed(), 0, table.opponents, table.stacks));
  });
  useEffect(() => saveLearner(learner), [learner]);

  const playing = s.shown < s.hand.events.length;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => dispatch({ type: "tick" }), ACTION_DELAY_MS);
    return () => clearTimeout(t);
  }, [playing, s.shown]);

  /** Plays your action. The trainer may pass the grade it already has, and marks moves it helped with. */
  const act = useCallback((action: PlayerAction, opts: { grade?: Grade; assisted?: boolean } = {}) => {
    const before = s.hand;
    const index = s.decisions.length;
    const origin = opts.assisted ? "assisted" : s.mode.kind === "drill" ? "drill" : "play";
    dispatch({ type: "act", action, next: s.mode.kind === "drill" ? before : advance(before, action) });
    void (opts.grade ? Promise.resolve(opts.grade) : gradeLater(before, action)).then((grade) => {
      dispatch({ type: "graded", index, grade });
      const ids = grade.graded ? conceptsAt(state(before), before.opponents, CORE_CONCEPTS).map((c) => c.id) : [];
      setLearner((l) => learnFrom(l, grade, ids, before, origin, Date.now()));
    });
  }, [s]);

  const nextHand = useCallback(() => {
    if (s.mode.kind === "play") dispatch(dealPlay(nextTable(s.mode, s.hand, freshSeed())));
  }, [s.mode, s.hand]);

  const startDrills = useCallback(() => {
    const queue = drillQueue(learner, Date.now());
    const first = queue[0];
    if (first) dispatch({ type: "deal", mode: { kind: "drill", queue, index: 0, resume: nextTable(tableOf(s.mode), s.hand, freshSeed()) }, hand: first.hand });
  }, [learner, s.mode, s.hand]);

  const nextDrill = useCallback(() => {
    if (s.mode.kind !== "drill") return;
    const index = s.mode.index + 1;
    const spot = s.mode.queue[index];
    dispatch(spot ? { type: "deal", mode: { ...s.mode, index }, hand: spot.hand } : dealPlay(s.mode.resume));
  }, [s.mode]);

  const stopDrills = useCallback(() => {
    if (s.mode.kind === "drill") dispatch(dealPlay(s.mode.resume));
  }, [s.mode]);
  const skip = useCallback(() => dispatch({ type: "skip" }), []);
  const shown: Hand = playing ? { ...s.hand, events: s.hand.events.slice(0, s.shown) } : s.hand;
  const newTableHand = s.mode.kind === "play" && s.mode.handNo === 0;
  const table = tableOf(s.mode);

  return { mode: s.mode, table, hand: s.hand, shown, playing, decisions: s.decisions, learner, newTableHand, act, skip, nextHand, startDrills, nextDrill, stopDrills };
}

export type Game = ReturnType<typeof useGame>;
