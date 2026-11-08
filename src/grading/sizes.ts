import { aggressiveTo } from "../bots/policy";
import { legalActions, potSize } from "../engine/reduce";
import type { HandState } from "../engine/types";

export interface SizeOption {
  /** "All-in", or a hint of the size such as "half the pot". Empty for the standard preflop raise. */
  readonly label: string;
  readonly to: number;
}

/**
 * The bet and raise sizes the learner can pick. The grader prices exactly these, so a
 * recommendation is always a button on screen.
 */
export function sizeOptions(st: HandState): SizeOption[] {
  const legal = legalActions(st);
  if (st.phase !== "betting" || !legal?.raise) return [];
  const { raise, callAmount } = legal;
  const clamp = (to: number) => Math.min(raise.max, Math.max(raise.min, Math.round(to)));
  const afterCall = potSize(st) + callAmount;
  const candidates = st.street === "preflop"
    ? [{ label: "", to: aggressiveTo(st) }]
    : [{ label: "half the pot", to: st.currentBet + afterCall / 2 }, { label: "the pot", to: st.currentBet + afterCall }];
  const out: SizeOption[] = [];
  for (const c of [...candidates, { label: "All-in", to: raise.max }]) {
    const to = clamp(c.to);
    if (!out.some((s) => s.to === to)) out.push({ label: to === raise.max ? "All-in" : c.label, to });
  }
  return out;
}
