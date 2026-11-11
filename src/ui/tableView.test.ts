import { describe, expect, it } from "vitest";
import { FULL_DECK, parseCard, parseCards, type Card } from "../cards/card";
import { reduce } from "../engine/reduce";
import type { HandEvent, PlayerAction } from "../engine/types";
import { handOverLine, tableView } from "./tableView";

// Six seats, button on seat 5, so seat 0 (you) is the small blind and seat 1 the big blind.
// Deal order is seat 0 to 5, twice; the board follows at deck position 12.
const FRONT = "As Kd 4c 5c 6c 7c 2c Qd 4d 5d 6d 7d Ah Ad 9s 8c 3h";
const fixed = parseCards(FRONT);
const deck: Card[] = [...fixed, ...FULL_DECK.filter((c) => !fixed.includes(c))];
const start: HandEvent = {
  type: "start", deck,
  config: { seats: ["You", "Bo", "Cy", "Di", "Ed", "Fi"].map((id) => ({ id, stack: 10_000 })), smallBlind: 50, bigBlind: 100, button: 5 },
};
const act = (type: "fold" | "check" | "call", seat: number): PlayerAction => ({ type, seat });
const folds = [2, 3, 4, 5].map((s) => act("fold", s));
const preflop = [...folds, act("call", 0), act("check", 1)];
const quiet = [act("check", 0), act("check", 1)];
const river: PlayerAction[] = [{ type: "bet", seat: 0, to: 200 }, act("call", 1)];

const view = (actions: PlayerAction[]) => {
  const events = [start, ...actions];
  return tableView(reduce(events), events);
};

describe("tableView", () => {
  it("names only the action in a bubble while the chips show the amount", () => {
    const v = view([{ type: "raise", seat: 2, to: 300 }]);
    expect(v.seats[2]!.bet).toBe("$3");
    expect(v.seats[2]!.bubble?.text).toBe("Raise");
  });

  it("puts the amount back in the bubble once the chips are gone", () => {
    const v = view([...preflop, ...quiet, ...quiet, ...river]);
    expect(v.seats[0]!.bet).toBeNull();
    expect(v.seats[0]!.bubble?.text).toBe("Bet $2");
  });

  it("at showdown dims a winner's hole card outside the best five, and all of a loser's", () => {
    const v = view([...preflop, ...quiet, ...quiet, ...river]);
    const dim = (seat: number) => Object.fromEntries(v.seats[seat]!.cards.map((c) => [String(c.card), c.dim]));
    // You win with three Aces, Nine and Eight: the Two plays no part.
    expect(v.seats[0]!.winner).toBe(true);
    expect(dim(0)).toEqual({ [parseCard("As")]: false, [parseCard("2c")]: true });
    expect(Object.values(dim(1))).toEqual([true, true]);
    expect(v.seats[1]!.showing).toBe(true);
    expect(v.seats[0]!.showing).toBe(false);
    // Folded opponents show no cards.
    expect(v.seats[2]!.cards).toEqual([]);
  });
});

describe("handOverLine", () => {
  it("says won, lost or broke even, then where the game stands", () => {
    expect(handOverLine(400, 400, 100)).toEqual(["Won $4 this hand", "Up $4 this game"]);
    expect(handOverLine(-5050, -4650, 100)).toEqual(["Lost $50.50 this hand", "Down $46.50 this game"]);
    expect(handOverLine(0, 0, 100)).toEqual(["Broke even this hand", "Even this game"]);
  });
});
