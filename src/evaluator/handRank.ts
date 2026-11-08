import { type Card, rankOf, suitOf } from "../cards/card";

export const CATEGORIES = [
  "high card",
  "pair",
  "two pair",
  "trips",
  "straight",
  "flush",
  "full house",
  "quads",
  "straight flush",
] as const;
export type Category = (typeof CATEGORIES)[number];

declare const scoreBrand: unique symbol;
/** Higher beats lower. Equal means a split. */
export type HandScore = number & { readonly [scoreBrand]: true };

const score = (category: number, kickers: readonly number[]): HandScore => {
  let s = category;
  for (let i = 0; i < 5; i++) s = s * 16 + (kickers[i] ?? 0);
  return s as HandScore;
};

export const categoryOf = (s: HandScore): Category => CATEGORIES[Math.floor(s / 16 ** 5)]!;

/** The ranks a score was decided on, most important first: for a full house, the trips then the pair. */
export const scoreRanks = (s: HandScore): number[] => [4, 3, 2, 1, 0].map((i) => Math.floor(s / 16 ** i) % 16);

/** Highest rank of a 5-long run in a rank bitmask, or -1. Ace plays low in the wheel. */
function straightHigh(mask: number): number {
  const withAceLow = (mask << 1) | ((mask >> 12) & 1);
  for (let hi = 13; hi >= 4; hi--) {
    const run = 0b11111 << (hi - 4);
    if ((withAceLow & run) === run) return hi - 1;
  }
  return -1;
}

function topBits(mask: number, n: number): number[] {
  const out: number[] = [];
  for (let r = 12; r >= 0 && out.length < n; r--) if (mask & (1 << r)) out.push(r);
  return out;
}

/** Scores the best 5-card hand from 5 to 7 cards. */
export function evaluate(cards: readonly Card[]): HandScore {
  if (cards.length < 5 || cards.length > 7) throw new Error(`evaluate needs 5-7 cards, got ${cards.length}`);
  const counts = new Array<number>(13).fill(0);
  const suitMasks = [0, 0, 0, 0];
  let rankMask = 0;
  for (const c of cards) {
    const r = rankOf(c);
    counts[r]!++;
    suitMasks[suitOf(c)]! |= 1 << r;
    rankMask |= 1 << r;
  }

  const flushMask = suitMasks.find((m) => popcount(m) >= 5);
  if (flushMask !== undefined) {
    const sf = straightHigh(flushMask);
    if (sf >= 0) return score(8, [sf]);
  }

  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    const n = counts[r]!;
    if (n === 4) quads.push(r);
    else if (n === 3) trips.push(r);
    else if (n === 2) pairs.push(r);
  }

  if (quads.length > 0) {
    const q = quads[0]!;
    return score(7, [q, topBits(rankMask & ~(1 << q), 1)[0]!]);
  }
  if (trips.length > 0 && trips.length + pairs.length >= 2) {
    const t = trips[0]!;
    const pairCandidates = [...trips.slice(1), ...pairs].sort((a, b) => b - a);
    return score(6, [t, pairCandidates[0]!]);
  }
  if (flushMask !== undefined) return score(5, topBits(flushMask, 5));
  const st = straightHigh(rankMask);
  if (st >= 0) return score(4, [st]);
  if (trips.length > 0) {
    const t = trips[0]!;
    return score(3, [t, ...topBits(rankMask & ~(1 << t), 2)]);
  }
  if (pairs.length >= 2) {
    const [a, b] = [pairs[0]!, pairs[1]!];
    return score(2, [a, b, topBits(rankMask & ~(1 << a) & ~(1 << b), 1)[0]!]);
  }
  if (pairs.length === 1) {
    const p = pairs[0]!;
    return score(1, [p, ...topBits(rankMask & ~(1 << p), 3)]);
  }
  return score(0, topBits(rankMask, 5));
}

function popcount(x: number): number {
  let n = 0;
  for (let v = x; v; v &= v - 1) n++;
  return n;
}
