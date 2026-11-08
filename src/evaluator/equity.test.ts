import { describe, expect, it } from "vitest";
import { parseCards } from "../cards/card";
import { equityVsCombo, equityVsRange } from "./equity";
import { ALL_CLASSES, classOf, combosOf, parseRange, rangeCombos, type Combo } from "./ranges";
import { RFI } from "./preflopCharts";

const combo = (s: string) => parseCards(s) as unknown as Combo;
const one = (s: string) => [{ combo: combo(s), weight: 1 }];

describe("ranges", () => {
  it("has 169 classes covering 1326 combos", () => {
    expect(ALL_CLASSES).toHaveLength(169);
    expect(ALL_CLASSES.flatMap(combosOf)).toHaveLength(1326);
  });

  it("parses plus, span and unsuffixed notation", () => {
    expect([...parseRange("QQ+")]).toEqual(["QQ", "KK", "AA"]);
    expect([...parseRange("22-44")]).toEqual(["22", "33", "44"]);
    expect([...parseRange("ATs+")]).toEqual(["ATs", "AJs", "AQs", "AKs"]);
    expect([...parseRange("K9o-KJo")]).toEqual(["K9o", "KTo", "KJo"]);
    expect([...parseRange("AK")]).toEqual(["AKs", "AKo"]);
    expect(() => parseRange("KAs")).toThrow();
  });

  it("classifies a combo", () => {
    expect(classOf(combo("Kd As"))).toBe("AKo");
    expect(classOf(combo("7h 8h"))).toBe("87s");
  });

  it("charts widen from early to late position", () => {
    const pct = (p: keyof typeof RFI) => rangeCombos(RFI[p]!.raise).length / 1326;
    expect(pct("UTG")).toBeLessThan(pct("HJ"));
    expect(pct("HJ")).toBeLessThan(pct("CO"));
    expect(pct("CO")).toBeLessThan(pct("BTN"));
    expect(pct("UTG")).toBeGreaterThan(0.12);
    expect(pct("BTN")).toBeLessThan(0.55);
  });
});

describe("equity", () => {
  it("matches outs counting on the turn: 8 outs of 44 cards", () => {
    // 9h8h on 7h 6c 2d Ks vs AcAd. Any five or ten makes a straight. No other river helps.
    const eq = equityVsCombo(combo("9h 8h"), combo("Ac Ad"), parseCards("7h 6c 2d Ks"));
    expect(eq).toBeCloseTo(8 / 44, 12);
  });

  it("is zero when drawing dead on the flop", () => {
    // AhKh on 2h 7h 7c vs 7d7s (quads already). Hero is drawing dead.
    expect(equityVsCombo(combo("Ah Kh"), combo("7d 7s"), parseCards("2h 7h 7c"))).toBe(0);
  });

  it("is exactly half for mirrored hands on the river", () => {
    expect(equityVsCombo(combo("As Ks"), combo("Ad Kd"), parseCards("2c 7h 9d Jc 3s"))).toBe(0.5);
  });

  it("sampling lands within 0.5% of exact enumeration", () => {
    const board = parseCards("Qs 8d 3c");
    const range = rangeCombos(parseRange("TT+, AQs+, AQo+, KQs, QJs"));
    const exact = equityVsRange(combo("Jh Tc"), range, board);
    const sampled = equityVsRange(combo("Jh Tc"), range, board, { exactBudget: 0, samples: 200_000, seed: 7 });
    expect(exact.method).toBe("exact");
    expect(sampled.method).toBe("sampled");
    expect(Math.abs(exact.equity - sampled.equity)).toBeLessThan(0.005);
  }, 60_000);

  it("AA wins about 82% against KK preflop, as widely published", () => {
    const r = equityVsRange(combo("Ah As"), one("Kc Kd"), [], { samples: 200_000, seed: 3 });
    expect(r.equity).toBeGreaterThan(0.81);
    expect(r.equity).toBeLessThan(0.83);
  });
});

describe("the guide's cheat sheet", () => {
  const vs = (a: string, b: string) => equityVsRange(combo(a), one(b), [], { samples: 100_000, seed: 11 }).equity;
  const need = (betShareOfPot: number) => betShareOfPot / (1 + 2 * betShareOfPot);
  it("states matchups and break-even numbers that the evaluator agrees with", () => {
    expect(vs("8h 8c", "As Kd")).toBeCloseTo(0.55, 1);
    expect(vs("Kh Kc", "8s 8d")).toBeCloseTo(0.81, 1);
    expect(vs("As Kd", "Ac Th")).toBeGreaterThan(0.68);
    expect(need(0.5)).toBeCloseTo(0.25, 3);
    expect(need(2 / 3)).toBeCloseTo(0.286, 3);
    expect(need(1)).toBeCloseTo(1 / 3, 3);
    // Flush draw, 9 outs: exact chance to hit by the river from the flop, and on the river from the turn.
    expect(1 - (38 / 47) * (37 / 46)).toBeCloseTo(0.35, 2);
    expect(9 / 46).toBeCloseTo(0.196, 2);
  }, 60_000);
});
