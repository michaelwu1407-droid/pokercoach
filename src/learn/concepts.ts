import { PREDICATES, type PredicateId, type SpotView } from "./spot";

export type Source =
  | { readonly kind: "math"; readonly note: string }
  | { readonly kind: "chart"; readonly chartId: string }
  | { readonly kind: "opponent"; readonly styleId: string };

/** A skill the learner is tracked on. Each one's claim is exactly what the grader measures. */
export interface Concept {
  readonly id: string;
  readonly title: string;
  readonly statement: string;
  /** All must hold for the concept to apply to a spot. */
  readonly appliesWhen: readonly PredicateId[];
  readonly sources: readonly Source[];
}

export const applies = (c: Concept, s: SpotView) => c.appliesWhen.every((p) => PREDICATES[p](s));

export const CORE_CONCEPTS: readonly Concept[] = [
  {
    id: "open-by-position",
    title: "Opening ranges by seat",
    statement: "When it folds to you, raise the hands in your seat's range and fold the rest. Later seats open more hands.",
    appliesWhen: ["preflop-raise-first-in"],
    sources: [{ kind: "chart", chartId: "rfi" }],
  },
  {
    id: "pot-odds",
    title: "Pot odds",
    statement: "Call when your chance of winning beats the share of the final pot you would put in.",
    appliesWhen: ["postflop", "facing-bet", "heads-up"],
    sources: [{ kind: "math", note: "Calling breaks even when equity = call ÷ (pot + call)." }],
  },
  {
    id: "bet-or-check",
    title: "Betting with a reason",
    statement: "Bet when worse hands call or better hands fold. Otherwise check.",
    appliesWhen: ["postflop", "not-facing-bet", "heads-up"],
    sources: [{ kind: "math", note: "A bet's value is what it wins when they fold plus its equity when they call." }],
  },
  {
    id: "respect-nit-aggression",
    title: "Reading a nit",
    statement: "A tight player who bets or raises usually has it. Fold your medium hands.",
    appliesWhen: ["postflop", "facing-bet", "vs-nit"],
    sources: [{ kind: "opponent", styleId: "nit" }],
  },
  {
    id: "call-down-maniacs",
    title: "Reading a maniac",
    statement: "A hyper-aggressive player bluffs a lot, so medium hands become calls.",
    appliesWhen: ["postflop", "facing-bet", "vs-maniac"],
    sources: [{ kind: "opponent", styleId: "lag" }],
  },
  {
    id: "value-bet-stations",
    title: "Reading a calling station",
    statement: "A station calls with weak hands, so bet your decent hands and never bluff.",
    appliesWhen: ["postflop", "not-facing-bet", "vs-station"],
    sources: [{ kind: "opponent", styleId: "station" }],
  },
];
