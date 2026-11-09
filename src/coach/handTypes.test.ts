import { describe, expect, it } from "vitest";
import { summarise } from "../evaluator/handGroups";
import { parseRange } from "../evaluator/ranges";
import { breakdown, features, inMainGroup, liveCheck } from "./handTypes";

// Facing a raise from a late seat: 174 hands.
const list = parseRange("TT+, AJs+, KQs, AQo+, A5s-A4s, 22-99, ATs, KJs, QJs, JTs, T9s, 98s, AJo, KQo");

describe("what a percentage is made of", () => {
  const { main, others } = summarise(list);
  it("splits the list into types a player can spot", () => {
    expect(breakdown(main, others)).toBe("78 pairs, 52 Ace with a Ten or higher, 28 two cards Ten or higher and 16 others");
  });

  it("turns the types into one question to ask at the table", () => {
    expect(liveCheck(main)).toBe("is it a pair, an Ace with a Ten or higher or two cards Ten or higher?");
    expect(inMainGroup("83o", main)).toBe(false);
    expect(inMainGroup("KJo", main)).toBe(true);
  });

  it("describes two cards the way you look at them", () => {
    expect(features("83o")).toBe("no Ace, no card Ten or higher, different suits");
    expect(features("77")).toBe("a pair");
  });
});
