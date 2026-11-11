import type { Opponents } from "../bots/opponents";
import { legalActions, potSize } from "../engine/reduce";
import type { HandState, SeatIndex } from "../engine/types";
import { seatsFrom } from "../engine/showdown";
import { positionOf } from "../evaluator/preflopCharts";
import { BLUFF_GUIDE } from "../grading/types";
import type { Seen } from "../learn/seen";
import { money, seatName } from "./words";

/**
 * The live trainer's checklist before you act. A chess coach can show the best move because the
 * whole board is visible. In poker the cards that decide the hand are hidden, so the trainer gives
 * you the three checks a good player runs every time (where you sit, what it costs, who you are up
 * against) and leaves the decision to you. Everything here is something anyone at the table could see.
 */
export interface Brief {
  readonly position: string;
  readonly price: string;
  readonly player: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const SEAT_HINT = {
  UTG: "first to act after the blinds", HJ: "second to act after the blinds", CO: "just before the Dealer",
  BTN: "last to act after the flop", SB: "the small blind", BB: "the big blind",
} as const;

function afterFlopOrder(st: HandState, hero: SeatIndex): string {
  const live = seatsFrom(st.config.button + 1, st.seats.length).filter((i) => !st.seats[i]!.folded);
  const at = live.indexOf(hero);
  if (at === live.length - 1) return "last";
  if (at === 0) return "first";
  return `after ${at} player${at === 1 ? "" : "s"}`;
}

function position(st: HandState, hero: SeatIndex): string {
  const order = afterFlopOrder(st, hero);
  if (st.street === "preflop") {
    const pos = positionOf(st.config, hero);
    const where = `${seatName(pos)} seat, ${SEAT_HINT[pos]}.`;
    if (pos === "UTG" || pos === "HJ") return `${where} Most players act after you. Play only strong hands.`;
    if (pos === "BTN") return "Dealer seat. Only the blinds act after you. Play more hands.";
    if (pos === "CO") return `${where} Few players act after you. Play more hands.`;
    return `${seatName(pos)} seat. You act first after the flop. Play fewer hands.`;
  }
  if (order === "last") return "You act last. You see their moves before you choose.";
  if (order === "first") return "You act first. You know the least, so be careful.";
  return "Others act after you. Be careful with medium hands.";
}

function price(st: HandState): string {
  if (st.phase !== "betting") return "";
  const legal = legalActions(st);
  const pot = potSize(st);
  const bb = st.config.bigBlind;
  const raised = st.street === "preflop" && st.currentBet > bb;
  if (st.street === "preflop" && !raised && legal && legal.callAmount > 0)
    return "Nobody has raised. Just calling lets everyone in cheaply. Raise or fold.";
  if (legal && legal.callAmount > 0) {
    const after = pot + legal.callAmount;
    const need = legal.callAmount / after;
    return `Your ${money(legal.callAmount, bb)} call makes the pot ${money(after, bb)}. You need to win ${pct(need)} of the time.`;
  }
  if (st.street === "preflop") return "Nobody raised. Check for free, or raise good hands.";
  return `Nobody has bet. Checking is free. A half-pot bluff needs ${pct(BLUFF_GUIDE.halfPot)} folds.`;
}

/** Enough hands to say anything about a player. */
const MIN_HANDS = 8;

/** A read from counts, with what it means for you: how often they play, and whether they raise or call. */
function read(name: string, seen: Seen, facing: "bet" | "raise" | "re-raise" | null): string {
  const p = seen[name];
  if (!p || p.hands < MIN_HANDS || p.played === 0) return `Too few hands to read ${name} yet.`;
  const play = p.played / p.hands, raise = p.raised / p.played;
  const how = `${name} plays 1 hand in ${Math.max(1, Math.round(1 / play))}${raise > 0.6 ? " and raises most" : raise < 0.25 ? " and mostly calls" : ""}.`;
  if (!facing) return play < 0.2 ? `${how} When ${name} stays in, expect a real hand.` : play > 0.4 ? `${how} Bet your good hands.` : `${how} If ${name} stays in, expect a real hand.`;
  if (play < 0.2) return `${how} This ${facing} likely means a strong hand.`;
  if (play > 0.4) return `${how} This ${facing} is often weak.`;
  return `${how} This ${facing} is likely a real hand.`;
}

function player(st: HandState, hero: SeatIndex, opponents: Opponents, seen: Seen): string {
  if (st.phase !== "betting") return "";
  const legal = legalActions(st);
  const raises = st.history.filter((a) => a.type === "raise" || a.type === "bet");
  const bettor = [...raises].reverse().find((a) => a.to === st.currentBet && a.seat !== hero);
  if (bettor && legal && legal.callAmount > 0) {
    const name = opponents[bettor.seat]?.name ?? "They";
    const verb = bettor.type === "bet" ? "bet" : raises.length > 1 && st.street === "preflop" ? "re-raised" : "raised";
    return `${name} ${verb}. ${read(name, seen, verb === "bet" ? "bet" : verb === "re-raised" ? "re-raise" : "raise")}`;
  }
  const live = st.seats.flatMap((s, i) => (i !== hero && !s.folded ? [opponents[i]?.name] : [])).filter((n): n is string => !!n);
  if (st.street === "preflop") {
    // Before anyone has put chips in by choice there is nobody to read; only who is left to act matters.
    const after = st.pending.filter((p) => p !== hero).length;
    return after <= 2 ? `Only ${after} left to act after you. Raise more hands.` : "Nobody has acted yet.";
  }
  if (live.length > 1) return `${live.length} players are in. You need a stronger hand.`;
  return live[0] ? read(live[0], seen, null) : "";
}

export function trainerBrief(st: HandState, hero: SeatIndex, opponents: Opponents, seen: Seen): Brief {
  return { position: position(st, hero), price: price(st), player: player(st, hero, opponents, seen) };
}
