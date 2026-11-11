import type { Card } from "../cards/card";
import { evaluate } from "./handRank";

/** The five cards that make the best hand from 5 to 7 cards. Ties keep the first subset found. */
export function bestFive(cards: readonly Card[]): Card[] {
  const target = evaluate(cards);
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const five = [cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!];
            if (evaluate(five) === target) return five;
          }
  throw new Error("bestFive: no five-card subset matches the hand");
}
