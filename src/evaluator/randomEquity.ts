import { type Card, FULL_DECK, mulberry32 } from "../cards/card";
import { evaluate } from "./handRank";

/**
 * Your share of the pot against `opponents` players holding random cards, with the rest of the
 * board dealt out. It uses only what anyone at a real table can see: your cards, the board and how
 * many players are left. It never uses a read of what they hold, so it gives no answer away.
 * Sampled with a fixed seed, so the same spot always shows the same number.
 */
export function equityVsRandom(hole: readonly [Card, Card], board: readonly Card[], opponents: number, samples = 3000, seed = 1): number {
  if (opponents <= 0) return 1;
  const dead = new Set<Card>([...hole, ...board]);
  const deck = FULL_DECK.filter((c) => !dead.has(c));
  const rng = mulberry32(seed);
  const need = 5 - board.length + 2 * opponents;
  let share = 0;
  for (let s = 0; s < samples; s++) {
    // Partial Fisher-Yates: only the cards this sample uses are shuffled to the front.
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    const full = [...board, ...deck.slice(0, 5 - board.length)];
    const mine = evaluate([...hole, ...full]);
    let best = mine, tied = 1, beaten = false;
    for (let o = 0; o < opponents; o++) {
      const at = 5 - board.length + 2 * o;
      const theirs = evaluate([deck[at]!, deck[at + 1]!, ...full]);
      if (theirs > best) { beaten = true; break; }
      if (theirs === best) tied++;
    }
    if (!beaten) share += 1 / tied;
  }
  return share / samples;
}
