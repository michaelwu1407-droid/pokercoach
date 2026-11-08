import { type Card, rankOf, suitOf } from "../cards/card";
import { categoryOf, evaluate } from "./handRank";

const NAMES = ["Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace"];
const PLURAL = ["Twos", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines", "Tens", "Jacks", "Queens", "Kings", "Aces"];

/** Kicker ranks packed into the score, highest first. */
const kickers = (score: number) => [4, 3, 2, 1, 0].map((i) => Math.floor(score / 16 ** i) % 16);

/** Plain-English name of what the hole cards make with the board. "Pair of Kings", "Ace-King suited". */
export function describeHand(hole: readonly [Card, Card], board: readonly Card[]): string {
  if (board.length < 3) {
    const [a, b] = rankOf(hole[0]) >= rankOf(hole[1]) ? hole : [hole[1], hole[0]];
    if (rankOf(a) === rankOf(b)) return `Pocket ${PLURAL[rankOf(a)]}`;
    return `${NAMES[rankOf(a)]}-${NAMES[rankOf(b)]} ${suitOf(a) === suitOf(b) ? "suited" : "offsuit"}`;
  }
  const score = evaluate([...hole, ...board]);
  const [k1, k2] = kickers(score);
  switch (categoryOf(score)) {
    case "high card": return `${NAMES[k1!]} high`;
    case "pair": return `Pair of ${PLURAL[k1!]}`;
    case "two pair": return `Two pair, ${PLURAL[k1!]} and ${PLURAL[k2!]}`;
    case "trips": return `Three ${PLURAL[k1!]}`;
    case "straight": return `Straight to the ${NAMES[k1!]}`;
    case "flush": return `Flush, ${NAMES[k1!]} high`;
    case "full house": return `Full house, ${PLURAL[k1!]} full of ${PLURAL[k2!]}`;
    case "quads": return `Four ${PLURAL[k1!]}`;
    case "straight flush": return k1 === 12 ? "Royal flush" : `Straight flush to the ${NAMES[k1!]}`;
  }
}
