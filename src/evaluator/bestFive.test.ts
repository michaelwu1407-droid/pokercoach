import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { FULL_DECK, formatCard, parseCards } from "../cards/card";
import { bestFive } from "./bestFive";
import { evaluate } from "./handRank";

const best = (s: string) => bestFive(parseCards(s)).map(formatCard).sort();
const sorted = (s: string) => s.split(" ").sort();

describe("bestFive", () => {
  it("picks the five flush cards, highest first", () => {
    expect(best("Ah 9h 2h 5h Kh Jh 3c")).toEqual(sorted("Ah 9h 5h Kh Jh"));
  });

  it("finds a straight that uses the board", () => {
    expect(best("9c 2d Td Js Qh Kc 3s")).toEqual(sorted("9c Td Js Qh Kc"));
  });

  it("plays two pair with the board's pair and the best kicker", () => {
    expect(best("Ac 7d 7s 4h 4c Kd 2s")).toEqual(sorted("Ac 7d 7s 4h 4c"));
  });

  it("makes the biggest full house from two sets", () => {
    expect(best("8c 8d 8s 3h 3c 3d Kd")).toEqual(sorted("8c 8d 8s 3h 3c"));
  });

  it("always scores the same as the whole hand", () => {
    fc.assert(
      fc.property(fc.shuffledSubarray([...FULL_DECK], { minLength: 7, maxLength: 7 }), (cards) => {
        const five = bestFive(cards);
        expect(five).toHaveLength(5);
        expect(five.every((c) => cards.includes(c))).toBe(true);
        expect(evaluate(five)).toBe(evaluate(cards));
      }),
    );
  });
});
