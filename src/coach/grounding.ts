import { RANK_LABELS, RANKS } from "../cards/card";
import type { Grade } from "../grading/types";

/** A number as printed, thousands separators included: "1,326" is one number. */
const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
/** A hand class such as "97s". Its card names may be printed, and they are not computed figures. */
const HAND_CLASS = /^[2-9TJQKA]{2}[so]?$/;
const canon = (n: string) => String(Number(n.replace(/,/g, "")));

/** Every number the grader produced, in each format the coach is allowed to print it. */
export function allowedNumbers(g: Grade, bigBlind: number): Set<string> {
  const out = new Set<string>();
  const add = (x: number) => {
    const forms = [x, Math.round(x * 100), Math.abs(x).toFixed(1), Math.abs(x).toFixed(2), (Math.abs(x) / bigBlind).toFixed(1), (Math.abs(x) / bigBlind).toFixed(2)];
    for (const f of forms) out.add(canon(String(f)));
  };
  const walk = (v: unknown): void => {
    if (typeof v === "number") add(v);
    else if (typeof v === "string" && HAND_CLASS.test(v)) [...v.slice(0, 2)].forEach((ch) => out.add(canon(RANK_LABELS[RANKS.indexOf(ch)]!)));
    else if (typeof v === "string") (v.match(NUMBER) ?? []).forEach((n) => out.add(canon(n)));
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(g);
  add(bigBlind);
  // "Chance to win vs 3 players" counts the seats the grader measured against.
  if (g.graded) add(g.win.against.length);
  return out;
}

/**
 * Invariant 1 as code. Returns numbers in learner-facing text the grader never produced.
 * Every feedback card must return an empty list here, which a test checks.
 */
export function ungroundedNumbers(text: string, allowed: ReadonlySet<string>): string[] {
  return (text.match(NUMBER) ?? []).filter((n) => !allowed.has(canon(n)));
}
