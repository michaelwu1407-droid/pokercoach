import { RANKS } from "../cards/card";
import { NAMES, PLURAL } from "../evaluator/describe";
import type { ChartRow, Run } from "../evaluator/responseCharts";

/** "T3o" becomes "Ten-Three offsuit", "88" becomes "Pocket Eights": the same words as "You have". */
export function handWords(cls: string): string {
  const [a, b] = [RANKS.indexOf(cls[0] ?? ""), RANKS.indexOf(cls[1] ?? "")];
  if (a === b) return `Pocket ${PLURAL[a]}`;
  return `${NAMES[a]}-${NAMES[b]} ${cls[2] === "s" ? "suited" : "offsuit"}`;
}

export function runWords(row: ChartRow, [lo, hi]: Run): string {
  if (row.shape === "pair") {
    if (hi === 12) return lo === 0 ? "any pair" : `${PLURAL[lo]} or better`;
    return lo === hi ? `${PLURAL[lo]}` : `${PLURAL[lo]} to ${PLURAL[hi]}`;
  }
  const h = NAMES[row.high]!;
  const name = (k: number) => `${h}-${NAMES[k]}`;
  if (lo === hi) return `${name(lo)} ${row.shape}`;
  if (hi === row.high - 1) return lo === 0 ? `any ${row.shape} ${h}` : `${name(lo)} ${row.shape} or better`;
  return lo === hi ? `${name(lo)} ${row.shape}` : `${name(lo)} to ${name(hi)} ${row.shape}`;
}
