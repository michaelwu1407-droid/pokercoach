import { type Card, rankOf, suitOf } from "../cards/card";
import { categoryOf, evaluate, type HandScore, scoreRanks } from "./handRank";

export const NAMES = ["Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace"];
export const PLURAL = ["Twos", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines", "Tens", "Jacks", "Queens", "Kings", "Aces"];


/** Plain-English name of what the hole cards make with the board. "Pair of Kings", "Ace-King suited". */
export function describeHand(hole: readonly [Card, Card], board: readonly Card[]): string {
  if (board.length < 3) {
    const [a, b] = rankOf(hole[0]) >= rankOf(hole[1]) ? hole : [hole[1], hole[0]];
    if (rankOf(a) === rankOf(b)) return `Pocket ${PLURAL[rankOf(a)]}`;
    return `${NAMES[rankOf(a)]}-${NAMES[rankOf(b)]} ${suitOf(a) === suitOf(b) ? "suited" : "offsuit"}`;
  }
  const score = evaluate([...hole, ...board]);
  if (board.length === 5 && evaluate(board) === score) return `${handName(score)} on the board (everyone still in has it)`;
  return handName(score, hole);
}

/** The hand's name. With your cards given, a pair that is only on the board is called out as shared. */
export function handName(score: HandScore, hole?: readonly [Card, Card]): string {
  const [k1, k2] = scoreRanks(score);
  const category = categoryOf(score);
  const holeRanks = hole ? hole.map(rankOf) : [];
  const made = category === "pair" || category === "trips" ? [k1!] : category === "two pair" ? [k1!, k2!] : null;
  if (hole && made && !made.some((r) => holeRanks.includes(r))) {
    const shared = category === "pair" ? `pair of ${PLURAL[k1!]}` : category === "trips" ? `three ${PLURAL[k1!]}` : `two pair`;
    return shared === "two pair" ? `${NAMES[Math.max(...holeRanks)]} high (the board has two pairs)` : `${NAMES[Math.max(...holeRanks)]} high (the ${shared} is on the board)`;
  }
  // Ace high when the Ace is on the board tells you nothing; your own best card is what matters.
  if (hole && category === "high card" && !holeRanks.includes(k1!)) return `No pair, ${NAMES[Math.max(...holeRanks)]} high`;
  switch (category) {
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
