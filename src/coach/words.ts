import type { Position } from "../evaluator/preflopCharts";

/**
 * Everything the learner reads goes through these, so no poker shorthand reaches the screen.
 * Amounts are dollars at $0.50 and $1 blinds: one big blind is $1.
 */
export function money(chips: number, bigBlind: number): string {
  const d = Math.abs(chips / bigBlind);
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

/** The one name for putting every chip in, used on buttons, seats and feedback alike. */
export const allInLabel = (chips: number, bigBlind: number) => `All-in ${money(chips, bigBlind)}`;

export const signedMoney = (chips: number, bigBlind: number) => `${chips >= 0 ? "+" : "−"}${money(chips, bigBlind)}`;

/** Dollars from an amount already counted in big blinds. */
export const dollars = (bbAmount: number) => money(bbAmount, 1);

const SEAT_NAMES: Record<Position, string> = {
  UTG: "Early", HJ: "Middle", CO: "Late", BTN: "Dealer", SB: "Small blind", BB: "Big blind",
};
export const seatName = (p: Position) => SEAT_NAMES[p];

/**
 * Shorthand that must never reach the screen: big-blind units, solver words, seat codes, hand
 * codes like "T3o", and a lone "T" for ten. Tests scan every rendered string for it.
 */
export const JARGON = /(?<![A-Za-z])bb\b|\b(EV|equity|UTG|HJ|CO|BTN|SB|BB|RFI|GTO)\b|\b[2-9TJQKA]{2}[so]\b|(^|\s)T(?=[♣♦♥♠\s]|$)/i;
