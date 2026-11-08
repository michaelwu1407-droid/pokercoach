import { type Card, FULL_DECK, rankOf, suitOf } from "../cards/card";

export interface Draw {
  readonly name: "flush draw" | "straight draw" | "flush and straight draw";
  /** Unseen cards that complete the flush or straight with at least one of your cards. */
  readonly outs: number;
  /** The rule of 4 on the flop (two cards to come) and the rule of 2 on the turn. */
  readonly multiplier: 4 | 2;
  /** outs × multiplier, as a share. The quick estimate a player can do in their head. */
  readonly estimate: number;
}

const rankMask = (cards: readonly Card[]) => cards.reduce((m, c) => m | (1 << rankOf(c)), 0);

function hasStraight(mask: number): boolean {
  const m = (mask << 1) | ((mask >> 12) & 1);
  for (let lo = 0; lo <= 9; lo++) if (((m >> lo) & 0b11111) === 0b11111) return true;
  return false;
}

function hasFlush(cards: readonly Card[], hole: readonly Card[]): boolean {
  return [0, 1, 2, 3].some((s) => cards.filter((c) => suitOf(c) === s).length >= 5 && hole.some((c) => suitOf(c) === s));
}

/** Counts outs to a flush or straight you do not already have. Null when there is no draw. */
export function drawOf(hole: readonly [Card, Card], board: readonly Card[]): Draw | null {
  if (board.length < 3 || board.length > 4) return null;
  const now = [...hole, ...board];
  const haveFlush = hasFlush(now, hole);
  const haveStraight = hasStraight(rankMask(now)) && !hasStraight(rankMask(board));
  let flushOuts = 0, straightOuts = 0, outs = 0;
  for (const c of FULL_DECK) {
    if (now.includes(c)) continue;
    const next = [...now, c];
    const flush = !haveFlush && hasFlush(next, hole);
    const straight = !haveStraight && hasStraight(rankMask(next)) && !hasStraight(rankMask([...board, c]));
    if (flush) flushOuts++;
    if (straight) straightOuts++;
    if (flush || straight) outs++;
  }
  if (outs === 0) return null;
  const name = flushOuts > 0 && straightOuts > 0 ? "flush and straight draw" : flushOuts > 0 ? "flush draw" : "straight draw";
  const multiplier = board.length === 3 ? 4 : 2;
  return { name, outs, multiplier, estimate: Math.min(1, (outs * multiplier) / 100) };
}
