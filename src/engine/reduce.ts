import type { Card } from "../cards/card";
import { seatsFrom, settle } from "./showdown";
import type {
  HandEvent, HandState, LegalActions, PlayerAction, SeatIndex, SeatState, Start, Street, TableConfig,
} from "./types";

type Betting = Extract<HandState, { phase: "betting" }>;
const NEXT: Record<Street, Street | null> = { preflop: "flop", flop: "turn", turn: "river", river: null };
const BOARD_SIZE: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

export const canAct = (s: SeatState) => !s.folded && s.stack > 0;
export const potSize = (st: HandState) => st.seats.reduce((p, s) => p + s.total, 0);

export function blindSeats(config: TableConfig): { sb: SeatIndex; bb: SeatIndex } {
  const n = config.seats.length;
  return n === 2
    ? { sb: config.button, bb: (config.button + 1) % n }
    : { sb: (config.button + 1) % n, bb: (config.button + 2) % n };
}

function boardFor(st: { config: TableConfig; deck: readonly Card[] }, street: Street): Card[] {
  const start = st.config.seats.length * 2;
  return st.deck.slice(start, start + BOARD_SIZE[street]);
}

export function start(event: Start): HandState {
  const { config, deck } = event;
  const n = config.seats.length;
  if (n < 2 || n > 10) throw new Error("tables seat 2 to 10 players");
  if (new Set(deck).size !== 52) throw new Error("deck must hold 52 distinct cards");
  if (config.seats.some((s) => !Number.isInteger(s.stack) || s.stack <= 0)) throw new Error("stacks must be positive integers");
  const dealOrder = seatsFrom(config.button + 1, n);
  const holes = new Map(dealOrder.map((seat, k) => [seat, [deck[k]!, deck[k + n]!] as const]));
  const { sb, bb } = blindSeats(config);
  const seats = config.seats.map((s, i): SeatState => {
    const blind = i === sb ? config.smallBlind : i === bb ? config.bigBlind : 0;
    const posted = Math.min(blind, s.stack);
    return { id: s.id, hole: holes.get(i)!, stack: s.stack - posted, street: posted, total: posted, folded: false };
  });
  const base = { config, deck, seats, board: [], street: "preflop" as const, history: [] };
  return openRound(base, (bb + 1) % n, config.bigBlind);
}

/** What every state shares, before or between betting rounds. */
type RoundBase = Omit<Betting, "phase" | "toAct" | "currentBet" | "lastRaise" | "pending" | "closedToRaise">;

function openRound(base: RoundBase,
  firstSeat: SeatIndex, currentBet: number): HandState {
  const order = seatsFrom(firstSeat, base.seats.length);
  const pending = order.filter((i) => canAct(base.seats[i]!));
  const outstanding = base.seats.some((s) => canAct(s) && s.street < currentBet);
  if (pending.length < 2 && !outstanding) return closeRound(base);
  return { ...base, phase: "betting", toAct: pending[0]!, currentBet, lastRaise: base.config.bigBlind, pending, closedToRaise: [] };
}

function closeRound(st: RoundBase): HandState {
  const next = NEXT[st.street];
  const live = st.seats.filter(canAct).length;
  if (next === null || live < 2) return showdown({ ...st, board: boardFor(st, "river") });
  const seats = st.seats.map((s) => ({ ...s, street: 0 }));
  const base = { config: st.config, deck: st.deck, seats, board: boardFor(st, next), street: next, history: st.history };
  return openRound(base, (st.config.button + 1) % seats.length, 0);
}

function showdown(st: RoundBase): HandState {
  const { config, deck, seats, board, street, history } = st;
  const payouts = settle(seats, board, config.button);
  return { config, deck, seats, board, street, history, phase: "complete", payouts, showdown: seats.filter((s) => !s.folded).length > 1 };
}

export function legalActions(st: HandState): LegalActions | null {
  if (st.phase !== "betting") return null;
  const seat = st.seats[st.toAct]!;
  const callAmount = Math.min(st.currentBet - seat.street, seat.stack);
  const maxTo = seat.street + seat.stack;
  const othersCanAct = st.seats.some((s, i) => i !== st.toAct && canAct(s));
  const reopened = !st.closedToRaise.includes(st.toAct);
  const legal = { seat: st.toAct, canCheck: callAmount === 0, callAmount };
  if (!reopened || maxTo <= st.currentBet || !othersCanAct) return legal;
  const kind = st.currentBet === 0 ? "bet" : "raise";
  return { ...legal, raise: { kind, min: Math.min(st.currentBet + st.lastRaise, maxTo), max: maxTo } };
}

export function apply(st: HandState, action: PlayerAction): HandState {
  const legal = legalActions(st);
  if (st.phase !== "betting" || !legal || action.seat !== legal.seat) throw new Error(`seat ${action.seat} cannot act now`);
  const me = st.seats[action.seat]!;
  let to = me.street;
  if (action.type === "fold") to = me.street;
  else if (action.type === "check") { if (!legal.canCheck) throw new Error("cannot check facing a bet"); }
  else if (action.type === "call") { if (legal.callAmount === 0) throw new Error("nothing to call"); to = me.street + legal.callAmount; }
  else {
    if (!legal.raise || legal.raise.kind !== action.type) throw new Error(`cannot ${action.type} now`);
    if (!Number.isInteger(action.to) || action.to < legal.raise.min || action.to > legal.raise.max) throw new Error(`${action.type} to ${action.to} is out of range`);
    to = action.to;
  }
  const added = to - me.street;
  const seats = st.seats.map((s, i) => (i !== action.seat ? s
    : { ...s, stack: s.stack - added, street: to, total: s.total + added, folded: action.type === "fold" }));
  const history = [...st.history, action];
  let { currentBet, lastRaise, closedToRaise } = st;
  let pending = st.pending.filter((i) => i !== action.seat);
  if (to > currentBet) {
    const full = to - currentBet >= lastRaise;
    if (full) { lastRaise = to - currentBet; closedToRaise = [action.seat]; }
    else closedToRaise = [...closedToRaise, action.seat];
    currentBet = to;
    pending = seatsFrom(action.seat + 1, seats.length).filter((i) => i !== action.seat);
  } else if (action.type !== "fold") closedToRaise = [...closedToRaise, action.seat];
  pending = pending.filter((i) => canAct(seats[i]!));
  const next: Betting = { ...st, seats, history, currentBet, lastRaise, closedToRaise, pending };
  const inHand = seats.filter((s) => !s.folded);
  if (inHand.length === 1) return showdown({ ...next, board: st.board });
  if (pending.length === 0) return closeRound(next);
  const toAct = seatsFrom(action.seat + 1, seats.length).find((i) => pending.includes(i))!;
  return { ...next, toAct };
}

export function reduce(events: readonly HandEvent[]): HandState {
  const [first, ...rest] = events;
  if (first?.type !== "start") throw new Error("a hand begins with a start event");
  return rest.reduce<HandState>((st, e) => {
    if (e.type === "start") throw new Error("start may appear only once");
    return apply(st, e);
  }, start(first));
}
