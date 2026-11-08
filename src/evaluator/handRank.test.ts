import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { type Card, FULL_DECK, parseCards } from "../cards/card";
import { categoryOf, evaluate, type HandScore } from "./handRank";

const ev = (s: string) => evaluate(parseCards(s));

describe("evaluate", () => {
  it("matches the known 5-card category counts and 7462 distinct ranks", () => {
    const counts: Record<string, number> = {};
    const distinct = new Set<number>();
    const d = FULL_DECK;
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let e = c + 1; e < 52; e++)
            for (let f = e + 1; f < 52; f++) {
              const s = evaluate([d[a]!, d[b]!, d[c]!, d[e]!, d[f]!]);
              distinct.add(s);
              const cat = categoryOf(s);
              counts[cat] = (counts[cat] ?? 0) + 1;
            }
    expect(counts).toEqual({
      "straight flush": 40,
      quads: 624,
      "full house": 3744,
      flush: 5108,
      straight: 10200,
      trips: 54912,
      "two pair": 123552,
      pair: 1098240,
      "high card": 1302540,
    });
    expect(distinct.size).toBe(7462);
  }, 60_000);

  it("orders hands across and within categories", () => {
    expect(ev("As Ks Qs Js Ts")).toBeGreaterThan(ev("9h 9c 9d 9s 2c"));
    expect(ev("5d 4c 3h 2s Ac")).toBeLessThan(ev("6d 5c 4h 3s 2c"));
    expect(categoryOf(ev("5d 4c 3h 2s Ac"))).toBe("straight");
    expect(ev("Ah Ad Kc Kd 2s")).toBeGreaterThan(ev("Ah Ad Qc Qd Js"));
    expect(ev("Ah Ad Kc Kd 2s")).toBe(ev("As Ac Kh Ks 2d"));
  });

  it("picks the best five from seven", () => {
    expect(categoryOf(ev("Ah Kh 2h 7h 9h Kd Ks"))).toBe("flush");
    expect(categoryOf(ev("Ah Ad Ac Kd Ks Kc 2s"))).toBe("full house");
    expect(ev("Ah Ad Ac Kd Ks Kc 2s")).toBe(ev("Ah Ad Ac Kd Ks 3c 2s"));
    expect(categoryOf(ev("2h 3h 4h 5h Ah Kd Ks"))).toBe("straight flush");
  });

  it("scores seven cards as the max over all 21 five-card subsets", () => {
    const sevenCards = fc.shuffledSubarray([...FULL_DECK], { minLength: 7, maxLength: 7 });
    fc.assert(
      fc.property(sevenCards, (cards: Card[]) => {
        let best = -1;
        for (let i = 0; i < 7; i++)
          for (let j = i + 1; j < 7; j++) {
            const five = cards.filter((_, k) => k !== i && k !== j);
            best = Math.max(best, evaluate(five));
          }
        expect(evaluate(cards)).toBe(best as HandScore);
      }),
      { numRuns: 20_000 },
    );
  });
});
