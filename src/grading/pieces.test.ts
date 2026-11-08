import { describe, expect, it } from "vitest";
import { type Card, FULL_DECK, parseCards } from "../cards/card";
import { start } from "../engine/reduce";
import { describeHand } from "../evaluator/describe";
import type { Combo } from "../evaluator/ranges";
import { drawOf } from "./outs";
import { classify } from "./rangeMix";
import { CHIP_STEP, sizeOptions } from "./sizes";
import { verdictForChoice } from "./types";

const hole = (s: string) => parseCards(s) as unknown as [Card, Card];

describe("outs", () => {
  it("claims no draw once the hand is already made", () => {
    expect(drawOf(hole("Ah Kh"), parseCards("Qh Jh 2h"))).toBeNull();
  });
});

describe("what they likely have", () => {
  it("counts two pair made with a board pair as one pair", () => {
    expect(classify(hole("2c 2d") as unknown as Combo, parseCards("Ks Kd 5h"))).toBe("Smaller pair");
    expect(classify(hole("Kc 5d") as unknown as Combo, parseCards("Ks 5h 9d"))).toBe("Two pair or better");
  });
});

describe("hand names", () => {
  it("says when the board plays", () => {
    expect(describeHand(hole("2c 3d"), parseCards("As Ks Qs Js Ts"))).toMatch(/^The board plays/);
    expect(describeHand(hole("Jd 9c"), parseCards("Ac 8c 2d 4s"))).toBe("No pair, Jack high");
  });
});

describe("bet sizes", () => {
  const st = start({ type: "start", config: { seats: [0, 1, 2, 3, 4, 5].map((i) => ({ id: `p${i}`, stack: 10_000 })), smallBlind: 50, bigBlind: 100, button: 0 }, deck: FULL_DECK });
  it("offers distinct, rounded, legal presets ending in all-in", () => {
    const opts = sizeOptions(st);
    expect(opts.map((o) => o.label)).toEqual(["Usual raise", "Pot", "All-in"]);
    expect(new Set(opts.map((o) => o.to)).size).toBe(opts.length);
    for (const o of opts.slice(0, -1)) expect(o.to % CHIP_STEP).toBe(0);
    expect(opts.at(-1)!.to).toBe(10_000);
  });
});

describe("verdicts", () => {
  const bet = { type: "bet", seat: 0, to: 300 } as const;
  const bigger = { type: "bet", seat: 0, to: 600 } as const;
  const fold = { type: "fold", seat: 0 } as const;
  it("treats the right action at the wrong size as a sizing slip", () => {
    expect(verdictForChoice(bet, bigger, 0.1)).toBe("good");
    expect(verdictForChoice(bet, bigger, 2.5)).toBe("small");
    expect(verdictForChoice(bet, bigger, 10)).toBe("mistake");
    expect(verdictForChoice(fold, bigger, 10)).toBe("blunder");
  });
});
