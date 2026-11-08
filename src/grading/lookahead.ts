import { type Card, FULL_DECK } from "../cards/card";
import { moveDist, toAction } from "../bots/policy";
import type { Style } from "../bots/styles";
import { apply, legalActions, potSize } from "../engine/reduce";
import type { HandState, PlayerAction, SeatIndex } from "../engine/types";
import { evaluate } from "../evaluator/handRank";
import { showdownShare } from "../evaluator/equity";
import type { Combo } from "../evaluator/ranges";
import { sizeOptions } from "./sizes";

type Values = Float64Array;

interface Setup {
  readonly hero: SeatIndex;
  readonly villain: SeatIndex;
  readonly style: Style;
  readonly heroHole: readonly [Card, Card];
  /** Board at the decision being graded. The next card is appended to it. */
  readonly board: readonly Card[];
  readonly combos: readonly Combo[];
}

const blocked = (c: Combo, cards: readonly Card[]) => cards.includes(c[0]) || cards.includes(c[1]);

/** Hero's exact showdown share against each combo on `board`, enumerating the river when it is still to come. */
function shares(s: Setup, board: readonly Card[]): Values {
  const out = new Float64Array(s.combos.length);
  const rivers = board.length === 5 ? [null] : FULL_DECK.filter((x) => !board.includes(x) && !s.heroHole.includes(x));
  for (const river of rivers) {
    const full = river === null ? board : [...board, river];
    const h = evaluate([...s.heroHole, ...full]);
    s.combos.forEach((c, i) => {
      if (blocked(c, full)) return;
      out[i]! += showdownShare(h, evaluate([...c, ...full]));
    });
  }
  if (rivers.length > 1) {
    s.combos.forEach((c, i) => {
      const live = rivers.filter((r) => r !== null && !c.includes(r)).length;
      out[i] = live > 0 ? out[i]! / live : 0;
    });
  }
  return out;
}

/** Hero options on the looked-ahead street: check or any offered bet, or fold, call or raise. */
function heroOptions(st: HandState, hero: SeatIndex): PlayerAction[] {
  const legal = legalActions(st);
  if (!legal) return [];
  const sizes: PlayerAction[] = legal.raise ? sizeOptions(st).map((o) => ({ type: legal.raise!.kind, seat: hero, to: o.to })) : [];
  return legal.canCheck ? [{ type: "check", seat: hero }, ...sizes] : [{ type: "fold", seat: hero }, { type: "call", seat: hero }];
}

/**
 * Plays one betting round on a known board. Returns, per combo, the hero's chip gain from the start of
 * that round. Hero picks each option by its value against the whole range reaching that point, because
 * the hero cannot see the opponent's cards. After the round, the hand is treated as checked down.
 */
function playRound(s: Setup, start: HandState, node: HandState, reach: Values, eq: Values): Values {
  const invested = start.seats[s.hero]!.stack - node.seats[s.hero]!.stack;
  const closeAt = (next: HandState) => {
    const v = new Float64Array(s.combos.length);
    const pot = potSize(next);
    const spent = start.seats[s.hero]!.stack - next.seats[s.hero]!.stack;
    for (let i = 0; i < v.length; i++) v[i] = eq[i]! * pot - spent;
    return v;
  };
  const step = (a: PlayerAction, r: Values): Values => {
    if (a.type === "fold") {
      const gain = a.seat === s.hero ? -invested : potSize(node) - invested;
      return new Float64Array(s.combos.length).fill(gain);
    }
    const next = apply(node, a);
    if (next.phase !== "betting" || next.street !== node.street) return closeAt(next);
    return playRound(s, start, next, r, eq);
  };
  if (node.phase !== "betting") return closeAt(node);
  if (node.toAct === s.hero) {
    let best: Values | null = null;
    let bestScore = -Infinity;
    for (const a of heroOptions(node, s.hero)) {
      const v = step(a, reach);
      let score = 0;
      for (let i = 0; i < v.length; i++) score += reach[i]! * v[i]!;
      if (score > bestScore) (best = v, bestScore = score);
    }
    return best!;
  }
  const n = s.combos.length;
  const p = { fold: new Float64Array(n), passive: new Float64Array(n), aggressive: new Float64Array(n) };
  for (let i = 0; i < n; i++) {
    if (reach[i] === 0) continue;
    const d = moveDist(node, s.villain, s.combos[i]!, s.style);
    p.fold[i] = d.fold, p.passive[i] = d.passive, p.aggressive[i] = d.aggressive;
  }
  const out = new Float64Array(n);
  for (const m of ["fold", "passive", "aggressive"] as const) {
    if (!p[m].some((x) => x > 0)) continue;
    const r = reach.map((x, i) => x * p[m][i]!);
    const v = step(toAction(node, m), r);
    for (let i = 0; i < n; i++) out[i]! += p[m][i]! * v[i]!;
  }
  return out;
}

export interface Lookahead {
  /** Per combo, the hero's expected gain from `closed` (betting on the graded street just ended) onward. */
  value(closed: HandState, weights: Values): Values;
  /** Per combo, the hero's exact chance to win from the graded street, from the same enumeration. */
  equityNow(): Values;
}

/**
 * Prices the next betting round exactly: every unseen next card, and on the turn every river.
 * Showdown shares depend only on the cards, so they are computed once per next card and reused for
 * every line the hero considers.
 */
export function makeLookahead(s: Setup): Lookahead {
  const dead = [...s.heroHole, ...s.board];
  const cards = FULL_DECK.filter((c) => !dead.includes(c));
  const shareCache = new Map<Card, Values>();
  const sharesFor = (card: Card) => shareCache.get(card) ?? (shareCache.set(card, shares(s, [...s.board, card])), shareCache.get(card)!);
  const average = (perCard: (card: Card) => Values) => {
    const sum = new Float64Array(s.combos.length);
    const count = new Float64Array(s.combos.length);
    for (const card of cards) {
      const v = perCard(card);
      s.combos.forEach((c, i) => {
        if (!blocked(c, [card])) (sum[i]! += v[i]!, count[i]! += 1);
      });
    }
    return sum.map((x, i) => (count[i]! > 0 ? x / count[i]! : 0));
  };
  return {
    value: (closed, weights) => average((card) => {
      const start: HandState = { ...closed, board: [...s.board, card] };
      const reach = weights.map((w, i) => (blocked(s.combos[i]!, [card]) ? 0 : w));
      return playRound(s, start, start, reach, sharesFor(card));
    }),
    equityNow: () => average(sharesFor),
  };
}
