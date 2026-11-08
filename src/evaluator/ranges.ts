import { type Card, makeCard, RANKS, rankOf, suitOf } from "../cards/card";

export type Combo = readonly [Card, Card];
export interface WeightedCombo {
  readonly combo: Combo;
  readonly weight: number;
}

/** "AA", "AKs" or "AKo". The 169 starting-hand classes. */
export type HandClass = string;

export function classOf([a, b]: Combo): HandClass {
  const [hi, lo] = rankOf(a) >= rankOf(b) ? [a, b] : [b, a];
  const r = `${RANKS[rankOf(hi)]}${RANKS[rankOf(lo)]}`;
  if (rankOf(hi) === rankOf(lo)) return r;
  return r + (suitOf(hi) === suitOf(lo) ? "s" : "o");
}

export function combosOf(cls: HandClass): Combo[] {
  const hi = RANKS.indexOf(cls[0] ?? "");
  const lo = RANKS.indexOf(cls[1] ?? "");
  const kind = cls[2];
  if (hi < 0 || lo < 0) throw new Error(`bad hand class "${cls}"`);
  const out: Combo[] = [];
  for (let s1 = 0; s1 < 4; s1++)
    for (let s2 = 0; s2 < 4; s2++) {
      if (hi === lo ? s2 <= s1 : kind === "s" ? s1 !== s2 : s1 === s2) continue;
      out.push([makeCard(hi, s1), makeCard(lo, s2)]);
    }
  return out;
}

export const ALL_CLASSES: readonly HandClass[] = (() => {
  const out: HandClass[] = [];
  for (let hi = 12; hi >= 0; hi--)
    for (let lo = hi; lo >= 0; lo--) {
      const r = `${RANKS[hi]}${RANKS[lo]}`;
      if (hi === lo) out.push(r);
      else out.push(`${r}s`, `${r}o`);
    }
  return out;
})();

/**
 * Parses standard range notation into hand classes.
 * "TT+" pairs TT and up. "A2s+" A2s through AKs. "K9o-KJo" a span. "AK" both suited and offsuit.
 */
export function parseRange(text: string): Set<HandClass> {
  const out = new Set<HandClass>();
  for (const raw of text.split(",").map((t) => t.trim()).filter(Boolean)) {
    const [from, to] = raw.split("-");
    const plus = from!.endsWith("+");
    const token = plus ? from!.slice(0, -1) : from!;
    const hi = RANKS.indexOf(token[0] ?? "");
    const lo = RANKS.indexOf(token[1] ?? "");
    const kinds = token[2] ? [token[2]] : hi === lo ? [""] : ["s", "o"];
    if (hi < 0 || lo < 0 || lo > hi || !kinds.every((k) => ["", "s", "o"].includes(k))) throw new Error(`bad range token "${raw}"`);
    let lows: number[] = [lo];
    if (to !== undefined) {
      const end = RANKS.indexOf(to[1] ?? "");
      const sameShape = hi === lo ? to[0] === to[1] : to[0] === token[0];
      if (!sameShape || end < 0) throw new Error(`bad span "${raw}"`);
      lows = span(Math.min(lo, end), Math.max(lo, end));
    } else if (plus) lows = hi === lo ? span(lo, 12) : span(lo, hi - 1);
    for (const l of lows)
      for (const k of kinds) out.add(hi === lo ? `${RANKS[l]}${RANKS[l]}` : `${RANKS[hi]}${RANKS[l]}${k}`);
  }
  return out;
}

const span = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function rangeCombos(classes: Iterable<HandClass>, weight = 1): WeightedCombo[] {
  return [...classes].flatMap((c) => combosOf(c).map((combo) => ({ combo, weight })));
}

export const blocks = (combo: Combo, dead: readonly Card[]) => dead.includes(combo[0]) || dead.includes(combo[1]);
