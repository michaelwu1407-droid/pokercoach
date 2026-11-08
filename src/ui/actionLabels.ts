import { money } from "../coach/words";
import { describeHand } from "../evaluator/describe";
import { apply, reduce } from "../engine/reduce";
import type { HandEvent, HandState, SeatIndex } from "../engine/types";

/** What each seat last did on the current street, as shown in its bubble. */
export function lastActions(events: readonly HandEvent[]): Map<SeatIndex, string> {
  const [first, ...rest] = events;
  const out = new Map<SeatIndex, string>();
  if (!first) return out;
  let st: HandState = reduce([first]);
  for (const e of rest) {
    if (e.type === "start") continue;
    const next = apply(st, e);
    const bb = st.config.bigBlind;
    const allIn = next.seats[e.seat]!.stack === 0 && e.type !== "fold" && e.type !== "check";
    const label = e.type === "fold" ? "Fold" : e.type === "check" ? "Check"
      : allIn ? `All-in ${money(next.seats[e.seat]!.street || next.seats[e.seat]!.total, bb)}`
      : e.type === "call" ? `Call ${money(next.seats[e.seat]!.street, bb)}`
      : e.type === "bet" ? `Bet ${money(e.to, bb)}` : `Raise to ${money(e.to, bb)}`;
    if (next.street !== st.street) {
      out.clear();
      if (e.type === "fold") out.set(e.seat, label);
    } else out.set(e.seat, label);
    st = next;
  }
  return out;
}

/** "Nico wins $24 with Two pair, Kings and Sevens", or "Nico wins $5. Everyone else folded." */
export function resultLine(st: HandState): string | null {
  if (st.phase !== "complete") return null;
  const bb = st.config.bigBlind;
  const top = [...st.payouts].sort((a, b) => b.amount - a.amount);
  const winner = top[0];
  if (!winner) return null;
  const name = st.seats[winner.seat]!.id;
  const who = name === "You" ? "You win" : `${name} wins`;
  if (!st.showdown) return `${who} ${money(winner.amount, bb)}. Everyone else folded.`;
  const hand = describeHand(st.seats[winner.seat]!.hole, st.board).split(". ")[0];
  const split = top.length > 1 && top[1]!.amount === winner.amount ? " (pot split)" : "";
  return `${who} ${money(winner.amount, bb)} with ${hand!.charAt(0).toLowerCase()}${hand!.slice(1)}${split}.`;
}
