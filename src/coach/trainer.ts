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
    const where = `You are in the ${seatName(pos)} seat (${SEAT_HINT[pos]}).`;
    if (pos === "UTG" || pos === "HJ") return `${where} Most players act after you, so play only strong hands.`;
    if (pos === "CO" || pos === "BTN") return `${where} Few players act after you and you act late after the flop, so you can play more hands.`;
    return `${where} You will act first after the flop, so play fewer hands than the Dealer.`;
  }
  if (order === "last") return "You act last this round, so you see their moves before you choose: an edge.";
  if (order === "first") return "You act first this round, so you know the least: be careful with medium hands.";
  return `You act ${order} this round, so others still act after you: be careful with medium hands.`;
}

function price(st: HandState): string {
  if (st.phase !== "betting") return "";
  const legal = legalActions(st);
  const pot = potSize(st);
  const bb = st.config.bigBlind;
  const raised = st.street === "preflop" && st.currentBet > bb;
  if (st.street === "preflop" && !raised && legal && legal.callAmount > 0)
    return `Nobody has raised yet. Just calling the ${money(bb, bb)} big blind lets everyone after you in cheaply, so the usual choice is raise or fold.`;
  if (legal && legal.callAmount > 0) {
    const after = pot + legal.callAmount;
    const need = legal.callAmount / after;
    const so = need < 0.2 ? "so even a fair hand or a good draw can call" : "so you need a hand that is often ahead of theirs";
    return `Calling costs ${money(legal.callAmount, bb)} and the pot would be ${money(after, bb)}: you need to win ${pct(need)} of the time, ${so}.`;
  }
  if (st.street === "preflop") return "Nobody raised, so you can check for free in the big blind, or raise your better hands to take the pot.";
  return `Nobody has bet, so checking is free. Bet when worse hands will call or better ones will fold (a half-pot bluff needs ${pct(BLUFF_GUIDE.halfPot)} folds).`;
}

/** Enough hands to say anything about a player. */
const MIN_HANDS = 8;

/** A read from counts, with what it means for you: how often they play, and whether they raise or call. */
function read(name: string, seen: Seen, facing: "bet" | "raise" | "re-raise" | null): string {
  const p = seen[name];
  if (!p || p.hands < MIN_HANDS || p.played === 0) return `Too few hands to judge ${name} yet: watch which hands they play.`;
  const play = p.played / p.hands, raise = p.raised / p.played;
  const how = `${name} plays about 1 hand in ${Math.max(1, Math.round(1 / play))} and ${raise > 0.6 ? "raises most of them" : raise < 0.25 ? "mostly just calls" : "raises some of them"}`;
  if (!facing) return `${how}.`;
  if (play < 0.2) return `${how}, so their ${facing} usually means a strong hand.`;
  if (play > 0.4) return `${how}, so their ${facing} is often not that strong.`;
  return `${how}, so treat their ${facing} as a decent hand.`;
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
  if (live.length > 1) return `${live.length} players are still in, so you need a stronger hand than against one.`;
  return live[0] ? read(live[0], seen, null) : "";
}

export function trainerBrief(st: HandState, hero: SeatIndex, opponents: Opponents, seen: Seen): Brief {
  return { position: position(st, hero), price: price(st), player: player(st, hero, opponents, seen) };
}
