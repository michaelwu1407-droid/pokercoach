import { describe, expect, it } from "vitest";
import { mulberry32 } from "../cards/card";
import { decide } from "../bots/policy";
import { STYLES } from "../bots/styles";
import { advance, chipsAfter, freshStacks, HERO, newHand, newTable, nextTable, START_STACK, state, type Table } from "./session";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Plays a hand to the end with you playing a loose style. */
function playOut(t: Table, seed: number) {
  const rng = mulberry32(seed);
  let h = newHand(seed, t.handNo, t.opponents, t.stacks);
  while (state(h).phase === "betting") h = advance(h, decide(state(h), STYLES.lag, rng));
  return h;
}

describe("the table between hands", () => {
  it("carries every player's chips into the next hand and adds up your result", () => {
    let t: Table = { handNo: 0, opponents: newTable(1), stacks: freshStacks(), net: 0, arrivals: [] };
    for (let n = 0; n < 20; n++) {
      const h = playOut(t, 100 + n);
      const chips = chipsAfter(h);
      expect(sum(chips)).toBe(sum(t.stacks));
      const next = nextTable(t, h, n);
      expect(next.net).toBe(t.net + chips[HERO]! - t.stacks[HERO]!);
      chips.forEach((c, i) => expect(next.stacks[i]).toBe(c > 0 ? c : START_STACK));
      t = next;
    }
  });

  it("seats a new random player when an opponent runs out of chips, and lets you buy back in", () => {
    const opponents = newTable(2);
    // An unfinished hand keeps the starting chips, so seats 0 (you) and 1 start the next hand broke.
    const unfinished = newHand(5, 0, opponents);
    expect(state(unfinished).phase).toBe("betting");
    const broke = [0, 0, START_STACK, START_STACK, START_STACK, START_STACK];
    const next = nextTable({ handNo: 0, opponents, stacks: broke, net: 0, arrivals: [] }, unfinished, 9);
    expect(next.stacks).toEqual(freshStacks());
    expect(next.opponents[1]!.name).not.toBe(opponents[1]!.name);
    expect(Object.values(next.opponents).map((o) => o.name)).toHaveLength(new Set(Object.values(next.opponents).map((o) => o.name)).size);
    expect(next.arrivals).toEqual([{ name: next.opponents[1]!.name, replaced: opponents[1]!.name }]);
    expect(next.opponents[2]).toBe(opponents[2]);
  });
});
