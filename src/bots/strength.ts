import { type Card, FULL_DECK, suitOf } from "../cards/card";
import { hasStraight, rankMask } from "../evaluator/structure";
import { evaluate } from "../evaluator/handRank";
import { classOf, combosOf, type Combo } from "../evaluator/ranges";
import strengthTable from "../evaluator/preflopStrength.json";

/** Share of all 1326 combos that are stronger than this class preflop. 0 is AA, near 1 is 32o. */
export const preflopPercentile: (combo: Combo) => number = (() => {
  const table = strengthTable as Record<string, number>;
  const ordered = Object.keys(table).sort((a, b) => table[b]! - table[a]!);
  const pct = new Map<string, number>();
  let above = 0;
  for (const cls of ordered) {
    pct.set(cls, above / 1326);
    above += combosOf(cls).length;
  }
  return (combo) => pct.get(classOf(combo))!;
})();

const boardCache = new Map<string, Map<string, number>>();
const key = (cards: readonly Card[]) => [...cards].sort((a, b) => a - b).join(",");

/**
 * Made-hand strength on the current board: the share of possible opposing combos this hand
 * beats or ties, ignoring cards still to come. 1 is the nuts.
 */
export function madeStrength(combo: Combo, board: readonly Card[]): number {
  const bk = key(board);
  let table = boardCache.get(bk);
  if (!table) {
    const deck = FULL_DECK.filter((c) => !board.includes(c));
    const scored: { k: string; s: number }[] = [];
    for (let i = 0; i < deck.length; i++)
      for (let j = i + 1; j < deck.length; j++) scored.push({ k: key([deck[i]!, deck[j]!]), s: evaluate([deck[i]!, deck[j]!, ...board]) });
    scored.sort((a, b) => a.s - b.s);
    table = new Map();
    for (let i = scored.length - 1, top = scored.length; i >= 0; i--) {
      if (i < scored.length - 1 && scored[i]!.s !== scored[i + 1]!.s) top = i + 1;
      table.set(scored[i]!.k, top / scored.length);
    }
    if (boardCache.size > 64) boardCache.clear();
    boardCache.set(bk, table);
  }
  const v = table.get(key(combo));
  if (v === undefined) throw new Error("combo overlaps the board");
  return v;
}

export interface Draws {
  readonly flushDraw: boolean;
  /** Distinct ranks that would give this hand a straight the board alone would not make. */
  readonly straightOuts: number;
}

export function drawsOf(combo: Combo, board: readonly Card[]): Draws {
  if (board.length === 0 || board.length >= 5) return { flushDraw: false, straightOuts: 0 };
  const cards = [...combo, ...board];
  const flushDraw = [0, 1, 2, 3].some(
    (s) => cards.filter((c) => suitOf(c) === s).length === 4 && combo.some((c) => suitOf(c) === s),
  );
  const mask = rankMask(cards);
  const boardMask = rankMask(board);
  let straightOuts = 0;
  if (!hasStraight(mask))
    for (let r = 0; r < 13; r++) {
      const bit = 1 << r;
      if (!(mask & bit) && hasStraight(mask | bit) && !hasStraight(boardMask | bit)) straightOuts++;
    }
  return { flushDraw, straightOuts };
}
