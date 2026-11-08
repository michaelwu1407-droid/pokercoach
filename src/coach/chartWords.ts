import { RANKS } from "../cards/card";
import { NAMES, PLURAL } from "../evaluator/describe";
import type { ChartRow, Run } from "../evaluator/responseCharts";

/** "T3o" becomes "Ten-Three offsuit", "88" becomes "Pocket Eights": the same words as "You have". */
export function handWords(cls: string): string {
  const [a, b] = [RANKS.indexOf(cls[0] ?? ""), RANKS.indexOf(cls[1] ?? "")];
  if (a === b) return `Pocket ${PLURAL[a]}`;
  return `${NAMES[a]}-${NAMES[b]} ${cls[2] === "s" ? "suited" : "offsuit"}`;
}

function runWords(row: ChartRow, [lo, hi]: Run): string {
  if (row.shape === "pair") {
    if (hi === 12) return lo === 0 ? "any pair" : `${PLURAL[lo]} or better`;
    return lo === hi ? `${PLURAL[lo]}` : `${PLURAL[lo]} to ${PLURAL[hi]}`;
  }
  const h = NAMES[row.high]!;
  const name = (k: number) => `${h}-${NAMES[k]}`;
  if (hi === row.high - 1) return lo === 0 ? `any ${row.shape} ${h}` : `${name(lo)} ${row.shape} or better`;
  return lo === hi ? `${name(lo)} ${row.shape}` : `${name(lo)} to ${name(hi)} ${row.shape}`;
}

const list = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * The chart's line for hands like yours, in a player's words:
 * "With Queen-high suited hands, raise Queen-Eight suited or better."
 */
export const rowGroup = (row: ChartRow) => (row.shape === "pair" ? "pairs" : `${NAMES[row.high]}-high ${row.shape} hands`);
export const rowEmpty = (row: ChartRow) => row.raise.length === 0 && row.call.length === 0;

export function rowLine(row: ChartRow, raiseVerb: string): string {
  const group = rowGroup(row);
  const parts = [
    ...(row.raise.length ? [`${raiseVerb} ${list(row.raise.map((r) => runWords(row, r)))}`] : []),
    ...(row.call.length ? [`call ${list(row.call.map((r) => runWords(row, r)))}`] : []),
  ];
  return parts.length === 0 ? `Every one of the ${group} is a fold here.` : `With ${group}, ${parts.join(", and ")}.`;
}
