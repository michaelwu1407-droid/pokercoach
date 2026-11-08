import { type Card, FULL_DECK, mulberry32 } from "../cards/card";
import { evaluate } from "./handRank";
import { blocks, type Combo, type WeightedCombo } from "./ranges";

export interface EquityResult {
  /** Hero's share of the pot at showdown, ties counted as half. */
  readonly equity: number;
  readonly method: "exact" | "sampled";
  readonly trials: number;
}

const showdownShare = (hero: Combo, villain: Combo, board: readonly Card[]): number => {
  const h = evaluate([...hero, ...board]);
  const v = evaluate([...villain, ...board]);
  return h > v ? 1 : h === v ? 0.5 : 0;
};

function* runouts(deck: readonly Card[], need: number, from = 0, acc: Card[] = []): Generator<Card[]> {
  if (need === 0) return yield acc;
  for (let i = from; i <= deck.length - need; i++) yield* runouts(deck, need - 1, i + 1, [...acc, deck[i]!]);
}

/** Exact equity of one hand against one hand by enumerating every runout. */
export function equityVsCombo(hero: Combo, villain: Combo, board: readonly Card[]): number {
  const dead = [...hero, ...villain, ...board];
  const deck = FULL_DECK.filter((c) => !dead.includes(c));
  let total = 0;
  let n = 0;
  for (const run of runouts(deck, 5 - board.length)) {
    total += showdownShare(hero, villain, [...board, ...run]);
    n++;
  }
  return total / n;
}

export interface EquityOptions {
  /** Enumerate exactly when the work is at most this many showdowns. Default 2 million. */
  readonly exactBudget?: number;
  readonly samples?: number;
  readonly seed?: number;
}

const choose = (n: number, k: number) => {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
};

/** Equity of a hand against a weighted range. Exact when cheap enough, seeded sampling otherwise. */
export function equityVsRange(hero: Combo, range: readonly WeightedCombo[], board: readonly Card[], opts: EquityOptions = {}): EquityResult {
  const dead = [...hero, ...board];
  const live = range.filter((w) => w.weight > 0 && !blocks(w.combo, dead));
  if (live.length === 0) throw new Error("villain range is empty after card removal");
  const work = live.length * choose(52 - dead.length - 2, 5 - board.length);
  if (work <= (opts.exactBudget ?? 2_000_000)) {
    let sum = 0;
    let weights = 0;
    for (const { combo, weight } of live) {
      sum += weight * equityVsCombo(hero, combo, board);
      weights += weight;
    }
    return { equity: sum / weights, method: "exact", trials: work };
  }
  const rng = mulberry32(opts.seed ?? 1);
  const samples = opts.samples ?? 50_000;
  const cumulative: number[] = [];
  live.reduce((acc, w) => (cumulative.push(acc + w.weight), acc + w.weight), 0);
  const totalWeight = cumulative[cumulative.length - 1]!;
  let sum = 0;
  for (let t = 0; t < samples; t++) {
    const x = rng() * totalWeight;
    const villain = live[cumulative.findIndex((c) => c > x)]!.combo;
    const taken = new Set<Card>([...dead, ...villain]);
    const run = [...board];
    while (run.length < 5) {
      const c = FULL_DECK[Math.floor(rng() * 52)]!;
      if (!taken.has(c)) (taken.add(c), run.push(c));
    }
    sum += showdownShare(hero, villain, run);
  }
  return { equity: sum / samples, method: "sampled", trials: samples };
}
