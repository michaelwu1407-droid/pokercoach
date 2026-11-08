import type { PlayerAction } from "../engine/types";
import { RFI } from "../evaluator/preflopCharts";
import type { Grade } from "../grading/types";
import type { Concept, Source } from "../learn/concepts";
import { STYLES } from "../bots/styles";

export interface CoachMessage {
  readonly headline: string;
  readonly lines: readonly string[];
  readonly citations: readonly string[];
  readonly caveats: readonly string[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const bb = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}bb`;
const chips = (bigBlind: number, to: number) => `${(to / bigBlind).toFixed(1)}bb`;

export function describeAction(a: PlayerAction, bigBlind: number): string {
  if (a.type === "bet" || a.type === "raise") return `${a.type} to ${chips(bigBlind, a.to)}`;
  return a.type;
}

export function cite(s: Source): string {
  switch (s.kind) {
    case "book": return `${s.book}, ${s.location}: "${s.quote}"`;
    case "math": return `Computed: ${s.note}`;
    case "chart": return `Chart: ${Object.values(RFI)[0]!.source}`;
    case "opponent": return `Opponent profile (${STYLES[s.styleId as keyof typeof STYLES]?.name ?? s.styleId}): ${STYLES[s.styleId as keyof typeof STYLES]?.leak ?? ""}`;
  }
}

const HEADLINE = { good: "Good decision", small: "Close, slightly off", mistake: "Mistake", blunder: "Big mistake" } as const;

/** Builds the explanation only from numbers the grader produced. */
export function explain(g: Grade, concepts: readonly Concept[], bigBlind: number): CoachMessage {
  if (!g.graded) return { headline: "Not graded", lines: [g.reason], citations: [], caveats: [] };
  const lines: string[] = [];
  const caveats: string[] = [];
  if (g.basis.kind === "chart") {
    const { handClass, inChart } = g.basis;
    lines.push(`${handClass} is ${inChart ? "in" : "not in"} the open-raise chart for this seat, so the play is to ${inChart ? "raise" : "fold"}.`);
  } else {
    const { equity, potOddsNeeded, values, rangeSize } = g.basis;
    lines.push(`Their line narrows them to roughly ${rangeSize} likely hands. Against those, your equity is ${pct(equity)}.`);
    if (potOddsNeeded !== null) lines.push(`Calling needs ${pct(potOddsNeeded)} to break even.`);
    lines.push(`Value of each option: ${values.map((v) => `${describeAction(v.action, bigBlind)} → ${bb(v.evBB)}`).join(", ")}.`);
    if (g.evLossBB !== null && g.evLossBB > 0.05) lines.push(`Your choice cost about ${g.evLossBB.toFixed(1)}bb.`);
    caveats.push(...g.basis.approximations);
  }
  const best = describeAction(g.best, bigBlind);
  const headline = g.verdict === "good" ? HEADLINE.good : `${HEADLINE[g.verdict]}. Best: ${best}`;
  for (const c of concepts) lines.push(`${c.title}. ${c.statement}`);
  const citations = [...new Set(concepts.flatMap((c) => c.sources.map(cite)))];
  return { headline, lines, citations, caveats };
}

const NUMBER = /\d+(?:\.\d+)?/g;
const canon = (n: string) => String(Number(n));

/** Every number the grader produced, in each format the coach is allowed to print it. */
export function allowedNumbers(g: Grade, concepts: readonly Concept[], bigBlind: number): Set<string> {
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
  walk(concepts);
  walk(concepts.flatMap((c) => c.sources.map(cite)));
  add(bigBlind);
  return out;
}

/**
 * Invariant 1 as code. Returns numbers in learner-facing text the grader never produced.
 * Any future LLM-written explanation must return an empty list here before it is shown.
 */
export function ungroundedNumbers(text: string, allowed: ReadonlySet<string>): string[] {
  return (text.match(NUMBER) ?? []).filter((n) => !allowed.has(canon(n)));
}
