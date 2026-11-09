import { describe, expect, it } from "vitest";
import { mulberry32 } from "../cards/card";
import { decide } from "../bots/policy";
import { STYLES } from "../bots/styles";
import { advance, chipsAfter, freshGame, freshStacks, HERO, newHand, nextTable, START_STACK, state, type Table } from "./session";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

function playOut(t: Table, seed: number) {
  const rng = mulberry32(seed);
  let h = newHand(seed, t.handNo, t.opponents, t.stacks);
  while (state(h).phase === "betting") h = advance(h, decide(state(h), STYLES.lag, rng));
  return h;
}

describe("a knockout game", () => {
  it("carries chips over, removes broke opponents, and keeps every chip in play", () => {
    let t = freshGame(1);
    for (let n = 0; n < 60; n++) {
      const h = playOut(t, 100 + n);
      const chips = chipsAfter(h);
      const next = nextTable(t, h, n);
      if (next.ended) {
        expect(next.ended).toBe(chips[HERO]! <= 0 ? "lost" : "won");
        expect(next.stacks).toEqual(freshStacks());
        break;
      }
      expect(next.stacks).toEqual(chips.filter((c) => c > 0));
      expect(sum(next.stacks)).toBe(sum(t.stacks));
      expect(Object.keys(next.opponents)).toHaveLength(next.stacks.length - 1);
      expect(next.net).toBe(t.net + chips[HERO]! - t.stacks[HERO]!);
      t = next;
    }
  });

  it("drops a broke opponent and renumbers the seats", () => {
    const t = freshGame(2);
    const unfinished = newHand(5, 0, t.opponents);
    const broke = [START_STACK, START_STACK, 0, START_STACK, START_STACK, START_STACK];
    const next = nextTable({ ...t, stacks: broke }, unfinished, 9);
    expect(next.stacks).toHaveLength(5);
    expect(next.left).toEqual([t.opponents[2]!.name]);
    expect(next.opponents[2]).toBe(t.opponents[3]);
  });

  it("starts a new game when you are broke, and when you are the last one left", () => {
    const t = freshGame(3);
    const h = newHand(5, 0, t.opponents);
    expect(nextTable({ ...t, stacks: [0, 1, 1, 1, 1, 1] }, h, 9).ended).toBe("lost");
    expect(nextTable({ ...t, stacks: [600 * 100, 0, 0, 0, 0, 0] }, h, 9).ended).toBe("won");
  });
});
