import { allInLabel, money } from "../coach/words";
import { handName } from "../evaluator/describe";
import { evaluate } from "../evaluator/handRank";
import { apply, reduce } from "../engine/reduce";
import type { HandEvent, HandState, SeatIndex } from "../engine/types";

export interface SeatLabel {
  readonly text: string;
  /** Styles the bubble: a bet or raise stands out, a fold is muted. */
  readonly kind: "fold" | "check" | "call" | "bet" | "raise" | "all-in";
}

/** What each seat last did on the current street, as shown in its bubble. */
export function lastActions(events: readonly HandEvent[]): Map<SeatIndex, SeatLabel> {
  const [first, ...rest] = events;
  const out = new Map<SeatIndex, SeatLabel>();
  if (!first) return out;
  let st: HandState = reduce([first]);
  for (const e of rest) {
    if (e.type === "start") continue;
    const next = apply(st, e);
    const bb = st.config.bigBlind;
    const allIn = next.seats[e.seat]!.stack === 0 && e.type !== "fold" && e.type !== "check";
    const label: SeatLabel = e.type === "fold" ? { text: "Fold", kind: "fold" }
      : e.type === "check" ? { text: "Check", kind: "check" }
      : allIn ? { text: allInLabel(next.seats[e.seat]!.street || next.seats[e.seat]!.total, bb), kind: "all-in" }
      : e.type === "call" ? { text: `Call ${money(next.seats[e.seat]!.street, bb)}`, kind: "call" }
      : e.type === "bet" ? { text: `Bet ${money(e.to, bb)}`, kind: "bet" } : { text: `Raise to ${money(e.to, bb)}`, kind: "raise" };
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
  const winnerName = st.seats[winner.seat]!.id;
  const who = winnerName === "You" ? "You win" : `${winnerName} wins`;
  if (!st.showdown) return `${who} ${money(winner.amount, bb)}. Everyone else folded.`;
  const hand = handName(evaluate([...st.seats[winner.seat]!.hole, ...st.board]));
  const split = top.length > 1 && top[1]!.amount === winner.amount ? " (pot split)" : "";
  return `${who} ${money(winner.amount, bb)} with ${hand.charAt(0).toLowerCase()}${hand.slice(1)}${split}.`;
}
