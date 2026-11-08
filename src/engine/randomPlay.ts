import { mulberry32, shuffled } from "../cards/card";
import { apply, legalActions, start } from "./reduce";
import type { HandEvent, HandState, PlayerAction, Start } from "./types";

export function randomStart(rng: () => number): Start {
  const n = 2 + Math.floor(rng() * 5);
  const seats = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, stack: 1 + Math.floor(rng() * 3) * 1000 + Math.floor(rng() * 1500) }));
  return { type: "start", config: { seats, smallBlind: 50, bigBlind: 100, button: Math.floor(rng() * n) }, deck: shuffled(rng) };
}

export function randomAction(st: HandState, rng: () => number): PlayerAction {
  const legal = legalActions(st);
  if (!legal) throw new Error("hand is over");
  const { seat } = legal;
  const options: PlayerAction[] = [legal.canCheck ? { type: "check", seat } : { type: "fold", seat }];
  if (legal.callAmount > 0) options.push({ type: "call", seat });
  if (legal.raise) {
    const { kind, min, max } = legal.raise;
    const to = rng() < 0.2 ? max : min + Math.floor(rng() * (max - min + 1));
    options.push({ type: kind, seat, to });
  }
  return options[Math.floor(rng() * options.length)]!;
}

export function playRandomHand(seed: number): { events: HandEvent[]; final: HandState } {
  const rng = mulberry32(seed);
  const first = randomStart(rng);
  const events: HandEvent[] = [first];
  let st = start(first);
  for (let steps = 0; st.phase === "betting"; steps++) {
    if (steps > 500) throw new Error(`hand ${seed} did not terminate`);
    const a = randomAction(st, rng);
    events.push(a);
    st = apply(st, a);
  }
  return { events, final: st };
}
