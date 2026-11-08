import { type Card, rankOf } from "../cards/card";

/** One bit per rank present. */
export const rankMask = (cards: readonly Card[]) => cards.reduce((m, c) => m | (1 << rankOf(c)), 0);

/** True when the ranks include five in a row. The ace also plays low. */
export function hasStraight(mask: number): boolean {
  const m = (mask << 1) | ((mask >> 12) & 1);
  for (let lo = 0; lo <= 9; lo++) if (((m >> lo) & 0b11111) === 0b11111) return true;
  return false;
}
