import { type Card, rankOf } from "../cards/card";
import { drawsOf } from "../bots/strength";
import { CATEGORIES, categoryOf, evaluate } from "../evaluator/handRank";
import type { Combo, WeightedCombo } from "../evaluator/ranges";

export const MIX_LABELS = ["Two pair or better", "Top pair or a big pocket pair", "Smaller pair", "Straight or flush draw", "Nothing"] as const;
export type MixLabel = (typeof MIX_LABELS)[number];
export interface MixShare {
  readonly label: MixLabel;
  readonly share: number;
}

/** What the board alone already makes, so a board pair does not count as the opponent's pair. */
function boardLevel(board: readonly Card[]): number {
  const counts = new Map<number, number>();
  for (const c of board) counts.set(rankOf(c), (counts.get(rankOf(c)) ?? 0) + 1);
  const n = [...counts.values()];
  if (n.includes(3)) return CATEGORIES.indexOf("trips");
  if (n.filter((x) => x === 2).length >= 2) return CATEGORIES.indexOf("two pair");
  return n.includes(2) ? CATEGORIES.indexOf("pair") : 0;
}

export function classify(combo: Combo, board: readonly Card[]): MixLabel {
  const level = CATEGORIES.indexOf(categoryOf(evaluate([...combo, ...board])));
  const twoPair = CATEGORIES.indexOf("two pair");
  // Two pair made with a pair on the board is really one pair: 2-2 on K-K-5 is a small pair.
  const strong = level > twoPair ? level > boardLevel(board) : level === twoPair && boardLevel(board) === 0;
  if (strong) return "Two pair or better";
  const top = Math.max(...board.map(rankOf));
  const [a, b] = [rankOf(combo[0]), rankOf(combo[1])];
  const boardRanks = new Set(board.map(rankOf));
  if (a === b) return a > top ? "Top pair or a big pocket pair" : "Smaller pair";
  if (a === top || b === top) return "Top pair or a big pocket pair";
  if (boardRanks.has(a) || boardRanks.has(b)) return "Smaller pair";
  const d = drawsOf(combo, board);
  return d.flushDraw || d.straightOuts >= 2 ? "Straight or flush draw" : "Nothing";
}

/** The opponent's likely holdings, grouped the way a player thinks about them. */
export function rangeMix(range: readonly WeightedCombo[], board: readonly Card[]): MixShare[] {
  const totals = new Map<MixLabel, number>(MIX_LABELS.map((l) => [l, 0]));
  for (const w of range) totals.set(classify(w.combo, board), totals.get(classify(w.combo, board))! + w.weight);
  return MIX_LABELS.map((label) => ({ label, share: totals.get(label)! }));
}
