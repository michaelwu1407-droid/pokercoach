import { useCallback, useEffect, useState } from "react";
import type { Opponents } from "../bots/opponents";
import { coach, type CoachState, initialCoach } from "../coach/machine";
import type { PlayerAction } from "../engine/types";
import { drillQueue, learnFrom, type Learner, type SavedSpot } from "../learn/learner";
import { type Hand, HANDS_PER_TABLE, heroAct, newHand, newTable } from "../session/session";
import { ALL_CONCEPTS, loadLearner, saveLearner } from "./store";

export type Mode =
  | { readonly kind: "play"; readonly handNo: number; readonly tableSeed: number }
  | { readonly kind: "drill"; readonly queue: readonly SavedSpot[]; readonly index: number; readonly answered: boolean };

export interface Game {
  readonly mode: Mode;
  readonly hand: Hand;
  /** The hand as far as it has been played out on screen. Opponents act one at a time. */
  readonly shown: Hand;
  /** True while opponents' actions are still being played out. */
  readonly playing: boolean;
  readonly coachState: CoachState;
  readonly learner: Learner;
  act(action: PlayerAction): void;
  resume(): void;
  /** Shows the rest of the opponents' actions at once. */
  skip(): void;
  nextHand(): void;
  startDrills(): boolean;
  nextDrill(): void;
  stopDrills(): void;
}

/** Pause between opponents' actions, so each one can be seen. */
export const ACTION_DELAY_MS = 650;

const freshSeed = () => Math.floor(Math.random() * 2 ** 31);
const tables = new Map<number, Opponents>();
const tableFor = (seed: number) => tables.get(seed) ?? (tables.set(seed, newTable(seed)), tables.get(seed)!);

export function useGame(): Game {
  const [learner, setLearner] = useState<Learner>(loadLearner);
  const [first] = useState(() => {
    const tableSeed = freshSeed();
    return { mode: { kind: "play", handNo: 0, tableSeed } as Mode, hand: newHand(freshSeed(), 0, tableFor(tableSeed)) };
  });
  const [mode, setMode] = useState<Mode>(first.mode);
  const [hand, setHand] = useState<Hand>(first.hand);
  const [coachState, setCoach] = useState<CoachState>(initialCoach);
  const [shownCount, setShown] = useState(1);
  useEffect(() => saveLearner(learner), [learner]);

  const paused = coachState.kind === "feedback" && coachState.paused;
  const playing = shownCount < hand.events.length;
  useEffect(() => {
    if (!playing || paused) return;
    const t = setTimeout(() => setShown((n) => n + 1), ACTION_DELAY_MS);
    return () => clearTimeout(t);
  }, [playing, paused, shownCount]);
  const skip = useCallback(() => setShown(hand.events.length), [hand]);

  const act = useCallback((action: PlayerAction) => {
    const r = heroAct(hand, action, ALL_CONCEPTS);
    const ids = r.concepts.map((c) => c.id);
    setLearner((l) => learnFrom(l, r.grade, ids, r.before, mode.kind === "drill" ? "drill" : "play", Date.now()));
    setCoach((c) => coach(c, { type: "heroActed", grade: r.grade, conceptIds: ids }));
    if (mode.kind === "drill") setMode({ ...mode, answered: true });
    else {
      setHand(r.hand);
      setShown(hand.events.length + 1);
    }
  }, [hand, mode]);

  const resume = useCallback(() => setCoach((c) => coach(c, { type: "continue" })), []);

  const playHand = (handNo: number, tableSeed: number) => {
    setMode({ kind: "play", handNo, tableSeed });
    setHand(newHand(freshSeed(), handNo, tableFor(tableSeed)));
    setShown(1);
    setCoach(initialCoach);
  };

  const nextHand = useCallback(() => {
    if (mode.kind !== "play") return playHand(0, freshSeed());
    const handNo = mode.handNo + 1;
    playHand(handNo, handNo % HANDS_PER_TABLE === 0 ? freshSeed() : mode.tableSeed);
  }, [mode]);

  const startDrills = useCallback(() => {
    const queue = drillQueue(learner, Date.now());
    if (queue.length === 0) return false;
    setMode({ kind: "drill", queue, index: 0, answered: false });
    setHand(queue[0]!.hand);
    setShown(queue[0]!.hand.events.length);
    setCoach(initialCoach);
    return true;
  }, [learner]);

  const nextDrill = useCallback(() => {
    if (mode.kind !== "drill") return;
    const index = mode.index + 1;
    if (index >= mode.queue.length) return playHand(0, freshSeed());
    setMode({ ...mode, index, answered: false });
    setHand(mode.queue[index]!.hand);
    setShown(mode.queue[index]!.hand.events.length);
    setCoach(initialCoach);
  }, [mode]);

  const stopDrills = useCallback(() => playHand(0, freshSeed()), []);

  const shown = playing ? { ...hand, events: hand.events.slice(0, shownCount) } : hand;
  return { mode, hand, shown, playing, skip, coachState, learner, act, resume, nextHand, startDrills, nextDrill, stopDrills };
}
