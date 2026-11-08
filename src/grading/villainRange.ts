import type { Card } from "../cards/card";
import { moveDist, moveOf } from "../bots/policy";
import type { Style } from "../bots/styles";
import { apply, start } from "../engine/reduce";
import type { HandEvent, HandState, SeatIndex } from "../engine/types";
import { ALL_CLASSES, blocks, combosOf, type WeightedCombo } from "../evaluator/ranges";

const ALL_COMBOS = ALL_CLASSES.flatMap(combosOf);

/**
 * The villain's range given everything they did this hand. Bots play a known mixed strategy, so this
 * is exact Bayesian inference: each combo's weight is the probability the bot takes the observed line.
 */
export function villainRange(events: readonly HandEvent[], villain: SeatIndex, style: Style, dead: readonly Card[]): WeightedCombo[] {
  const [first, ...actions] = events;
  if (first?.type !== "start") throw new Error("events must begin with start");
  let weights = ALL_COMBOS.map((combo) => ({ combo, weight: blocks(combo, dead) ? 0 : 1 }));
  let st: HandState = start(first);
  for (const action of actions) {
    if (action.type === "start") throw new Error("start may appear only once");
    if (action.seat === villain) {
      const move = moveOf(action);
      weights = weights.map((w) => (w.weight === 0 || blocks(w.combo, st.board) ? { ...w, weight: 0 }
        : { ...w, weight: w.weight * moveDist(st, villain, w.combo, style)[move] }));
    }
    st = apply(st, action);
  }
  const live = weights.filter((w) => w.weight > 0 && !blocks(w.combo, st.board));
  const total = live.reduce((s, w) => s + w.weight, 0);
  return live.map((w) => ({ combo: w.combo, weight: w.weight / total }));
}
