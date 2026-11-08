import { legalActions, potSize } from "../engine/reduce";
import type { HandState, PlayerAction } from "../engine/types";
import { sizeOptions } from "./sizes";
import type { ActionValue } from "./types";

/** All-in for more than twice the pot after calling. */
export function isDeepShove(st: HandState, a: PlayerAction): boolean {
  if (a.type !== "bet" && a.type !== "raise") return false;
  const legal = legalActions(st)!;
  return a.to === legal.raise?.max && a.to - st.seats[a.seat]!.street > 2 * (potSize(st) + legal.callAmount);
}

/** The chosen action first, then every other option the learner could have clicked. */
export function candidates(st: HandState, action: PlayerAction): PlayerAction[] {
  const legal = legalActions(st)!;
  const seat = legal.seat;
  const out: PlayerAction[] = [action];
  if (!legal.canCheck) out.push({ type: "fold", seat });
  out.push(legal.canCheck ? { type: "check", seat } : { type: "call", seat });
  if (legal.raise) for (const s of sizeOptions(st)) out.push({ type: legal.raise.kind, seat, to: s.to });
  const key = (a: PlayerAction) => `${a.type}:${"to" in a ? a.to : ""}`;
  return out.filter((a, i) => out.findIndex((b) => key(b) === key(a)) === i);
}


export const potOddsNeeded = (st: HandState): number | null => {
  const legal = legalActions(st);
  return legal && legal.callAmount > 0 ? legal.callAmount / (potSize(st) + legal.callAmount) : null;
};

/**
 * The recommended option and what the choice cost. A deep all-in is priced but never recommended,
 * because the lookahead stops after one more betting round and so undervalues smaller bets.
 */
export function pickBest(st: HandState, values: readonly ActionValue[]): { best: ActionValue; evLossBB: number } {
  const best = values.filter((v) => !isDeepShove(st, v.action)).reduce((a, b) => (b.evBB > a.evBB ? b : a));
  return { best, evLossBB: Math.max(0, best.evBB - values[0]!.evBB) };
}
