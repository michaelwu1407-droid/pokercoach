import { describe, expect, it } from "vitest";
import { parseCards, FULL_DECK, type Card } from "../cards/card";
import { apply, legalActions, potSize, reduce, start } from "./reduce";
import { playRandomHand } from "./randomPlay";
import type { HandState, Start } from "./types";

function deckWith(front: string): Card[] {
  const fixed = parseCards(front);
  return [...fixed, ...FULL_DECK.filter((c) => !fixed.includes(c))];
}

const table = (stacks: number[], button: number, front: string): Start => ({
  type: "start",
  config: { seats: stacks.map((stack, i) => ({ id: `p${i}`, stack })), smallBlind: 50, bigBlind: 100, button },
  deck: deckWith(front),
});

const done = (st: HandState) => {
  if (st.phase !== "complete") throw new Error(`expected complete, got ${st.phase}`);
  return st;
};

describe("engine soak", () => {
  it("plays 100k random hands with chips conserved and replay identical", () => {
    for (let seed = 1; seed <= 100_000; seed++) {
      const { events, final } = playRandomHand(seed);
      const st = done(final);
      const before = (events[0] as Start).config.seats.reduce((a, s) => a + s.stack, 0);
      const paid = st.payouts.reduce((a, p) => a + p.amount, 0);
      expect(paid).toBe(potSize(st));
      expect(st.seats.reduce((a, s) => a + s.stack, 0) + paid).toBe(before);
      expect(st.seats.every((s) => s.stack >= 0)).toBe(true);
      expect(st.payouts.every((p) => !st.seats[p.seat]!.folded)).toBe(true);
      if (seed % 1000 === 0) expect(reduce(events)).toEqual(final);
    }
  }, 120_000);
});

describe("engine rules", () => {
  it("heads-up: button posts the small blind and acts first preflop, last postflop", () => {
    let st = start(table([1000, 1000], 0, "AsKs QdQh"));
    expect(st.phase === "betting" && st.toAct).toBe(0);
    st = apply(st, { type: "call", seat: 0 });
    st = apply(st, { type: "check", seat: 1 });
    expect(st.street).toBe("flop");
    expect(st.phase === "betting" && st.toAct).toBe(1);
  });

  it("requires a raise of at least the last raise size", () => {
    let st = start(table([10000, 10000, 10000], 0, ""));
    st = apply(st, { type: "raise", seat: 0, to: 300 });
    expect(legalActions(st)?.raise).toEqual({ kind: "raise", min: 500, max: 10000 });
    expect(() => apply(st, { type: "raise", seat: 1, to: 400 })).toThrow();
  });

  it("an incomplete all-in raise does not reopen raising for a seat that already acted", () => {
    let st = start(table([10000, 350, 10000], 0, ""));
    st = apply(st, { type: "raise", seat: 0, to: 300 });
    st = apply(st, { type: "raise", seat: 1, to: 350 });
    st = apply(st, { type: "call", seat: 2 });
    const legal = legalActions(st)!;
    expect(legal.seat).toBe(0);
    expect(legal.raise).toBeUndefined();
    expect(legal.callAmount).toBe(50);
  });

  it("returns an uncalled bet and builds side pots", () => {
    // Seat order from the button's left: p1, p2, p0. Holes go p1, p2, p0, then second cards.
    const front = "AhKhQhAdKdQd 2c7s9dJc3s";
    let st = start(table([5000, 1000, 3000], 0, front));
    st = apply(st, { type: "raise", seat: 0, to: 5000 });
    st = apply(st, { type: "call", seat: 1 });
    st = apply(st, { type: "call", seat: 2 });
    const final = done(st);
    // p1 holds AA and wins the main pot of 3000. p2 holds KK and wins the 4000 side pot. p0 gets 2000 back.
    expect(final.payouts).toEqual([
      { seat: 0, amount: 2000 },
      { seat: 1, amount: 3000 },
      { seat: 2, amount: 4000 },
    ]);
  });

  it("splits a tied pot and gives the odd chip to the first seat left of the button", () => {
    let st = start(table([1000, 1000, 1000], 0, "2c3c4c2d3d4d AsKsQsJsTs"));
    st = apply(st, { type: "raise", seat: 0, to: 225 });
    st = apply(st, { type: "call", seat: 1 });
    st = apply(st, { type: "call", seat: 2 });
    st = apply(st, { type: "bet", seat: 1, to: 100 });
    st = apply(st, { type: "fold", seat: 2 });
    st = apply(st, { type: "call", seat: 0 });
    for (const seat of [1, 0, 1, 0]) st = apply(st, { type: "check", seat });
    const final = done(st);
    expect(final.showdown).toBe(true);
    // Pot is 325 + 325 + 225 = 875, split two ways. Seat 1 sits left of the button and takes 438.
    expect(final.payouts).toEqual([
      { seat: 0, amount: 437 },
      { seat: 1, amount: 438 },
    ]);
  });

  it("awards the pot without showdown when everyone else folds", () => {
    let st = start(table([1000, 1000, 1000], 0, ""));
    st = apply(st, { type: "fold", seat: 0 });
    st = apply(st, { type: "fold", seat: 1 });
    const final = done(st);
    expect(final.showdown).toBe(false);
    expect(final.payouts).toEqual([{ seat: 2, amount: 150 }]);
  });
});
