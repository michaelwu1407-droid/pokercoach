import { PREDICATES, type PredicateId, type SpotView } from "./spot";

export type Source =
  | { readonly kind: "book"; readonly book: string; readonly location: string; readonly quote: string }
  | { readonly kind: "math"; readonly note: string }
  | { readonly kind: "chart"; readonly chartId: string }
  | { readonly kind: "opponent"; readonly styleId: string };

export interface Concept {
  readonly id: string;
  readonly title: string;
  /** One plain sentence the learner should be able to act on. */
  readonly statement: string;
  readonly prerequisites: readonly string[];
  /** All must hold for the concept to apply to a spot. */
  readonly appliesWhen: readonly PredicateId[];
  readonly sources: readonly Source[];
  /** True only when the claim is checked by the grader, so a grade can be credited to it. */
  readonly graded: boolean;
}

export const applies = (c: Concept, s: SpotView) => c.appliesWhen.every((p) => PREDICATES[p](s));

/** Built-in concepts. Each one's claim is exactly what the grader measures, so each cites it. */
export const CORE_CONCEPTS: readonly Concept[] = [
  {
    id: "open-by-position",
    title: "Open wider the later you sit",
    statement: "When it folds to you, raise with the hands in your seat's chart and fold the rest. Later seats raise more hands.",
    prerequisites: [], appliesWhen: ["preflop-raise-first-in"], graded: true,
    sources: [{ kind: "chart", chartId: "rfi" }],
  },
  {
    id: "pot-odds",
    title: "Pot odds",
    statement: "Call when your chance of winning is higher than the share of the final pot you would be putting in.",
    prerequisites: [], appliesWhen: ["postflop", "facing-bet", "heads-up"], graded: true,
    sources: [{ kind: "math", note: "Call EV = equity × (pot + call) − call. It is positive exactly when equity > call ÷ (pot + call)." }],
  },
  {
    id: "range-not-hand",
    title: "Play against their range",
    statement: "You never know their exact cards. Weigh every hand they would play this way, not the one you fear.",
    prerequisites: ["pot-odds"], appliesWhen: ["postflop", "heads-up"], graded: true,
    sources: [{ kind: "math", note: "Equity is averaged over every hand the opponent would have taken this line with." }],
  },
  {
    id: "respect-nit-aggression",
    title: "Respect a nit's bets",
    statement: "A tight, passive player who bets or raises usually has it. Fold your bluff-catchers.",
    prerequisites: ["range-not-hand"], appliesWhen: ["postflop", "facing-bet", "vs-nit"], graded: true,
    sources: [{ kind: "opponent", styleId: "nit" }],
  },
  {
    id: "call-down-maniacs",
    title: "Call down a maniac lighter",
    statement: "A hyper-aggressive player bluffs a lot, so medium hands become calls.",
    prerequisites: ["range-not-hand"], appliesWhen: ["postflop", "facing-bet", "vs-maniac"], graded: true,
    sources: [{ kind: "opponent", styleId: "lag" }],
  },
  {
    id: "value-bet-stations",
    title: "Value bet a calling station",
    statement: "A station calls with weak hands, so bet your medium-strong hands and do not bluff.",
    prerequisites: ["range-not-hand"], appliesWhen: ["postflop", "not-facing-bet", "vs-station"], graded: true,
    sources: [{ kind: "opponent", styleId: "station" }],
  },
];
