import { evaluate, type HandScore } from "../evaluator/handRank";
import type { Card } from "../cards/card";
import type { Payout, SeatIndex, SeatState } from "./types";

export const seatsFrom = (start: SeatIndex, n: number): SeatIndex[] =>
  Array.from({ length: n }, (_, k) => (start + k) % n);

/**
 * Splits every chip committed into layered side pots. Each layer goes to the best live hand among
 * seats that reached it. An uncalled bet is a layer only its bettor reached, so it returns to them.
 */
export function settle(seats: readonly SeatState[], board: readonly Card[], button: SeatIndex): Payout[] {
  const live = seats.map((s, i) => ({ s, i })).filter(({ s }) => !s.folded);
  const scores = new Map<SeatIndex, HandScore>(
    live.map(({ s, i }) => [i, live.length > 1 ? evaluate([...s.hole, ...board]) : (0 as HandScore)]),
  );
  const oddChipOrder = seatsFrom(button + 1, seats.length);
  const won = new Array<number>(seats.length).fill(0);
  const levels = [...new Set(seats.map((s) => s.total))].filter((t) => t > 0).sort((a, b) => a - b);

  let prev = 0;
  for (const level of levels) {
    const amount = seats.reduce((sum, s) => sum + Math.min(s.total, level) - Math.min(s.total, prev), 0);
    let eligible = live.filter(({ s }) => s.total >= level).map(({ i }) => i);
    if (eligible.length === 0) eligible = live.map(({ i }) => i);
    const best = Math.max(...eligible.map((i) => scores.get(i)!));
    const winners = oddChipOrder.filter((i) => eligible.includes(i) && scores.get(i) === best);
    const share = Math.floor(amount / winners.length);
    winners.forEach((w, k) => (won[w]! += share + (k < amount - share * winners.length ? 1 : 0)));
    prev = level;
  }
  return won.flatMap((amount, seat) => (amount > 0 ? [{ seat, amount }] : []));
}
