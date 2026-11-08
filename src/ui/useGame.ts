import { useCallback, useEffect, useMemo, useState } from "react";
import { coach, type CoachState, initialCoach } from "../coach/machine";
import type { HandEvent, PlayerAction } from "../engine/types";
import { applies, type Concept } from "../learn/concepts";
import { drillQueue, learnFrom, type Learner, type Origin, type SavedSpot, studiedIds } from "../learn/learner";
import { spotView } from "../learn/spot";
import { conceptsAt, type Hand, heroAct, HERO, LINEUP, newHand, state } from "../session/session";
import { ALL_CONCEPTS, loadLearner, saveLearner } from "./store";

export type Mode = { readonly kind: "play"; readonly handNo: number } | { readonly kind: "drill"; readonly queue: readonly SavedSpot[]; readonly index: number };

export interface Game {
  readonly mode: Mode;
  readonly hand: Hand;
  readonly coachState: CoachState;
  readonly learner: Learner;
  readonly concepts: readonly Concept[];
  /** Book concepts that apply to the current spot. They teach but are never graded. */
  readonly related: readonly Concept[];
  act(action: PlayerAction, reason: string | null): void;
  dismiss(): void;
  nextHand(): void;
  startDrills(): boolean;
  stopDrills(): void;
}

const seedFor = (handNo: number) => (Date.now() % 1_000_000) * 7 + handNo;

function drillHand(spot: SavedSpot): Hand {
  return { seed: 1, events: spot.events as HandEvent[], grades: [], gradeConcepts: [] };
}

export function useGame(): Game {
  const [learner, setLearner] = useState<Learner>(loadLearner);
  const [mode, setMode] = useState<Mode>({ kind: "play", handNo: 0 });
  const [hand, setHand] = useState<Hand>(() => newHand(seedFor(0), 0));
  const [coachState, setCoach] = useState<CoachState>(initialCoach);
  useEffect(() => saveLearner(learner), [learner]);

  const st = state(hand);
  const heroToAct = st.phase === "betting" && st.toAct === HERO;
  const related = useMemo(() => {
    if (!heroToAct) return [];
    const view = spotView(st, HERO, LINEUP);
    return ALL_CONCEPTS.filter((c) => !c.graded && applies(c, view));
  }, [hand, heroToAct]);

  useEffect(() => {
    if (!heroToAct || coachState.kind !== "idle") return;
    const ids = conceptsAt(st, ALL_CONCEPTS).map((c) => c.id);
    const studied = mode.kind === "drill" ? [] : studiedIds(learner, ids, Date.now());
    setCoach((c) => coach(c, { type: "heroTurn", studiedConceptIds: studied }));
  }, [hand, heroToAct]);

  const act = useCallback((action: PlayerAction, reason: string | null) => {
    const origin: Origin = mode.kind === "drill" ? "drill" : "play";
    const r = heroAct(hand, action, ALL_CONCEPTS);
    const ids = r.concepts.map((c) => c.id);
    setLearner((l) => learnFrom(l, r.grade, ids, r.spotEvents, origin, Date.now()));
    if (mode.kind === "drill") {
      setCoach({ kind: "reveal", grade: r.grade, conceptIds: ids, reason, pausesThisHand: 1 });
      return;
    }
    let c = coach(coachState, { type: "heroActed", grade: r.grade, conceptIds: ids, reason });
    if (state(r.hand).phase === "complete" && c.kind !== "reveal") c = coach(c, { type: "handEnded", grades: r.hand.grades });
    setCoach(c);
    setHand(r.hand);
  }, [hand, coachState, mode]);

  const dismiss = useCallback(() => {
    if (mode.kind === "drill") {
      const index = mode.index + 1;
      if (index >= mode.queue.length) return void (setMode({ kind: "play", handNo: 0 }), startPlay(0));
      setMode({ ...mode, index });
      setHand(drillHand(mode.queue[index]!));
      setCoach(initialCoach);
      return;
    }
    const c = coach(coachState, { type: "dismiss" });
    setCoach(state(hand).phase === "complete" ? coach(c, { type: "handEnded", grades: hand.grades }) : c);
  }, [mode, coachState, hand]);

  function startPlay(handNo: number) {
    setHand(newHand(seedFor(handNo), handNo));
    setCoach(initialCoach);
  }

  const nextHand = useCallback(() => {
    const handNo = mode.kind === "play" ? mode.handNo + 1 : 0;
    setMode({ kind: "play", handNo });
    startPlay(handNo);
  }, [mode]);

  const startDrills = useCallback(() => {
    const queue = drillQueue(learner, Date.now());
    if (queue.length === 0) return false;
    setMode({ kind: "drill", queue, index: 0 });
    setHand(drillHand(queue[0]!));
    setCoach(initialCoach);
    return true;
  }, [learner]);

  const stopDrills = useCallback(() => nextHand(), [nextHand]);

  return { mode, hand, coachState, learner, concepts: ALL_CONCEPTS, related, act, dismiss, nextHand, startDrills, stopDrills };
}
