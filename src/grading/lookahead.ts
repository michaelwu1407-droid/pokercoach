import { type Card, FULL_DECK, mulberry32 } from "../cards/card";
import { moveDist, toAction } from "../bots/policy";
import type { Style } from "../bots/styles";
import { apply, legalActions, potSize } from "../engine/reduce";
import type { HandState, PlayerAction, SeatIndex } from "../engine/types";
import { evaluate } from "../evaluator/handRank";
import type { Combo } from "../evaluator/ranges";
import { isDeepShove } from "./options";
import { sizeOptions } from "./sizes";

/** Next cards sampled per lookahead, and later cards sampled per combo for equity after it. */
export const NEXT_CARDS = 10;
const LATER_CARDS = 8;
type Values = Float64Array;

interface Setup {
  readonly hero: SeatIndex;
  readonly villain: SeatIndex;
  readonly style: Style;
  readonly heroHole: readonly [Card, Card];
  /** Board at the decision being graded. The next card is appended to it. */
  readonly board: readonly Card[];
  readonly combos: readonly Combo[];
  readonly seed: number;
}

const blocked = (c: Combo, cards: readonly Card[]) => cards.includes(c[0]) || cards.includes(c[1]);

/** Hero's showdown share against each combo on `board`, sampling later cards when the board is not full. */
function shares(s: Setup, board: readonly Card[], rng: () => number): Values {
  const out = new Float64Array(s.combos.length);
  const share = (b: readonly Card[], c: Combo) => {
    const h = evaluate([...s.heroHole, ...b]);
    const v = evaluate([...c, ...b]);
    return h > v ? 1 : h === v ? 0.5 : 0;
  };
  s.combos.forEach((c, i) => {
    if (blocked(c, board)) return;
    if (board.length === 5) return void (out[i] = share(board, c));
    const deck = FULL_DECK.filter((x) => !board.includes(x) && !s.heroHole.includes(x) && !c.includes(x));
    let sum = 0;
    for (let k = 0; k < LATER_CARDS; k++) sum += share([...board, deck[Math.floor(rng() * deck.length)]!], c);
    out[i] = sum / LATER_CARDS;
  });
  return out;
}

/** Hero options on the looked-ahead street: check or the non-shove bet sizes, or fold or call. */
function heroOptions(st: HandState, hero: SeatIndex): PlayerAction[] {
  const legal = legalActions(st)!;
  if (legal.canCheck) {
    const bets = legal.raise ? sizeOptions(st).map((o) => ({ type: legal.raise!.kind, seat: hero, to: o.to }) as PlayerAction) : [];
    return [{ type: "check", seat: hero }, ...bets.filter((b) => !isDeepShove(st, b))];
  }
  return [{ type: "fold", seat: hero }, { type: "call", seat: hero }];
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

/**
 * Value of reaching `closed`, the state just after the graded street's betting ends, per combo:
 * the hero's expected gain from that point, averaged over sampled next cards.
 */
export function nextRoundValue(s: Setup, closed: HandState, weights: Values): Values {
  const rng = mulberry32(s.seed);
  const dead = [...s.heroHole, ...s.board];
  const deck = FULL_DECK.filter((c) => !dead.includes(c)).sort(() => rng() - 0.5).slice(0, NEXT_CARDS);
  const sum = new Float64Array(s.combos.length);
  const count = new Float64Array(s.combos.length);
  for (const card of deck) {
    const board = [...s.board, card];
    const start = { ...closed, board } as HandState;
    const reach = weights.map((w, i) => (blocked(s.combos[i]!, [card]) ? 0 : w));
    const v = playRound(s, start, start, reach, shares(s, board, rng));
    for (let i = 0; i < v.length; i++) if (reach[i]! > 0 || weights[i] === 0) (sum[i]! += v[i]!, count[i]! += 1);
  }
  return sum.map((x, i) => (count[i]! > 0 ? x / count[i]! : 0));
}
