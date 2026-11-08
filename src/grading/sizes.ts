import { aggressiveTo } from "../bots/policy";
import { legalActions, potSize } from "../engine/reduce";
import type { HandState } from "../engine/types";

/** Every amount anyone bets is a multiple of the small blind, so the table never shows odd cents. */
export const CHIP_STEP = 50;
export const roundChips = (x: number) => Math.round(x / CHIP_STEP) * CHIP_STEP;

export interface SizeOption {
  /** Button label: "Usual raise", "Half pot", "Pot" or "All-in". */
  readonly label: string;
  /** Total bet after the action this street. */
  readonly to: number;
}

/**
 * The one list of bet sizes. The sizer shows exactly these as presets and the grader prices exactly
 * these, so a recommended size is always a button on screen.
 */
export function sizeOptions(st: HandState): SizeOption[] {
  const legal = legalActions(st);
  if (st.phase !== "betting" || !legal?.raise) return [];
  const { raise, callAmount } = legal;
  const clamp = (to: number) => Math.min(raise.max, Math.max(raise.min, roundChips(to)));
  const afterCall = potSize(st) + callAmount;
  const candidates = st.street === "preflop"
    ? [{ label: "Usual raise", to: aggressiveTo(st) }, { label: "Pot", to: st.currentBet + afterCall }]
    : [{ label: "Half pot", to: st.currentBet + afterCall / 2 }, { label: "Pot", to: st.currentBet + afterCall }];
  const out: SizeOption[] = [];
  for (const c of [...candidates, { label: "All-in", to: raise.max }]) {
    const to = c.label === "All-in" ? raise.max : clamp(c.to);
    if (!out.some((s) => s.to === to)) out.push({ label: to === raise.max ? "All-in" : c.label, to });
  }
  return out;
}
