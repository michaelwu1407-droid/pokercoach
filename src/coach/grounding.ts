import type { Grade } from "../grading/types";

const NUMBER = /\d+(?:\.\d+)?/g;
const canon = (n: string) => String(Number(n));

/** Every number the grader produced, in each format the coach is allowed to print it. */
export function allowedNumbers(g: Grade, bigBlind: number): Set<string> {
  const out = new Set<string>();
  const add = (x: number) => {
    for (const f of [x, Math.round(x * 100), Math.abs(x).toFixed(1), (Math.abs(x) / bigBlind).toFixed(1)]) out.add(canon(String(f)));
  };
  const walk = (v: unknown): void => {
    if (typeof v === "number") add(v);
    else if (typeof v === "string") (v.match(NUMBER) ?? []).forEach((n) => out.add(canon(n)));
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(g);
  add(bigBlind);
  return out;
}

/**
 * Invariant 1 as code. Returns numbers in learner-facing text the grader never produced.
 * Every feedback card must return an empty list here, which a test checks.
 */
export function ungroundedNumbers(text: string, allowed: ReadonlySet<string>): string[] {
  return (text.match(NUMBER) ?? []).filter((n) => !allowed.has(canon(n)));
}
