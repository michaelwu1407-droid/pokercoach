import type { Card } from "../cards/card";
import { money, seatName } from "../coach/words";
import { bestFive } from "../evaluator/bestFive";
import { describeHand, handName } from "../evaluator/describe";
import { evaluate } from "../evaluator/handRank";
import { positionOf } from "../evaluator/preflopCharts";
import { potSize } from "../engine/reduce";
import type { HandEvent, HandState, SeatIndex } from "../engine/types";
import { HERO } from "../session/session";
import { lastActions, resultLine, type SeatLabel } from "./actionLabels";

export interface Bubble {
  readonly text: string;
  readonly kind: SeatLabel["kind"] | "blind";
  /** The newest action this round is fully opaque; older bubbles fade. */
  readonly latest: boolean;
}

/** Your hand while you play; at showdown, each shown hand as a winner or a loser. */
export interface HandTag {
  readonly text: string;
  readonly tone: "yours" | "folded" | "winner" | "loser";
}

export type SeatCard = { readonly card: Card; readonly hidden: boolean; readonly dim: boolean };

export interface SeatView {
  readonly index: SeatIndex;
  readonly name: string;
  /** "Dealer", "Big blind": shown after "You" and in the hover title. */
  readonly seat: string;
  readonly stack: string;
  readonly isHero: boolean;
  readonly isDealer: boolean;
  readonly folded: boolean;
  readonly toAct: boolean;
  readonly winner: boolean;
  readonly bubble: Bubble | null;
  /** Chips put in this round, blinds included, shown as a pill on the felt. At the end all chips are in the pot. */
  readonly bet: string | null;
  readonly cards: readonly SeatCard[];
  readonly tag: HandTag | null;
}

export interface TableView {
  readonly seats: readonly SeatView[];
  readonly board: readonly { readonly card: Card | null; readonly dim: boolean }[];
  readonly pot: string;
  readonly result: string | null;
  /** "+$12" when you made a profit on the hand just finished. */
  readonly heroWin: string | null;
}

/** Chips a seat got back only because nobody matched them. Winning those is not winning the hand. */
function refund(st: HandState, i: SeatIndex): number {
  const others = st.seats.filter((_, j) => j !== i).map((s) => s.total);
  return Math.max(0, st.seats[i]!.total - Math.max(0, ...others));
}

export function tableView(st: HandState, events: readonly HandEvent[]): TableView {
  const bb = st.config.bigBlind;
  const over = st.phase === "complete";
  const showdown = over && st.showdown;
  const paid = (i: SeatIndex) => (over ? st.payouts.find((p) => p.seat === i)?.amount ?? 0 : 0);
  const winners = new Set(st.seats.flatMap((s, i) => (!s.folded && paid(i) > refund(st, i) ? [i] : [])));
  const labels = lastActions(events);
  const newest = Math.max(-1, ...[...labels.values()].map((l) => l.at));
  const played = showdown
    ? new Set([...winners].flatMap((i) => bestFive([...st.seats[i]!.hole, ...st.board])))
    : null;

  const seats = st.seats.map((s, i): SeatView => {
    const pos = positionOf(st.config, i);
    const isHero = i === HERO;
    const shown = showdown && !s.folded;
    const label = labels.get(i);
    const blind = !label && st.street === "preflop" && s.street > 0 && (pos === "SB" || pos === "BB");
    const bubble: Bubble | null = label ? { text: label.text, kind: label.kind, latest: label.at === newest }
      : blind ? { text: seatName(pos), kind: "blind", latest: false } : null;
    const winner = winners.has(i);
    const tag: HandTag | null = shown
      ? { text: handName(evaluate([...s.hole, ...st.board])), tone: winner ? "winner" : "loser" }
      : isHero ? { text: describeHand(s.hole, st.board), tone: s.folded ? "folded" : "yours" } : null;
    // Opponents' folded cards leave the table; yours stay, greyed, so you can still see what you let go.
    const cards = s.folded && !isHero ? [] : s.hole.map((card) => ({ card, hidden: !isHero && !shown, dim: shown && !winner }));
    return {
      // Once the hand is over the pot is paid out, so the stack shown includes what the seat won.
      index: i, name: s.id, seat: seatName(pos), stack: money(s.stack + (st.phase === "complete" ? st.payouts.filter((p) => p.seat === i).reduce((t, p) => t + p.amount, 0) : 0), bb), isHero, isDealer: pos === "BTN",
      folded: s.folded, toAct: st.phase === "betting" && st.toAct === i, winner,
      bubble, bet: !over && s.street > 0 ? money(s.street, bb) : null, cards, tag,
    };
  });

  const heroNet = paid(HERO) - st.seats[HERO]!.total;
  return {
    seats,
    board: [0, 1, 2, 3, 4].map((k) => {
      const card = st.board[k] ?? null;
      return { card, dim: card !== null && played !== null && !played.has(card) };
    }),
    pot: money(potSize(st), bb),
    result: resultLine(st),
    heroWin: over && heroNet > 0 ? `+${money(heroNet, bb)}` : null,
  };
}
