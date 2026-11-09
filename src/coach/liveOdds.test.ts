import { describe, expect, it } from "vitest";
import { type Card, FULL_DECK, parseCards } from "../cards/card";
import type { HandEvent, Start } from "../engine/types";
import { oddsTimeline } from "./liveOdds";

// Six players, button 0: seat 1 is dealt deck[0] and deck[6], seat 0 (you) deck[5] and deck[11].
function hand(front: string, actions: HandEvent[]): HandEvent[] {
  const fixed = parseCards(front);
  const deck = [...fixed, ...FULL_DECK.filter((c) => !fixed.includes(c))] as Card[];
  const s: Start = { type: "start", config: { seats: ["You", "Ash", "Bo", "Cleo", "Dev", "Eli"].map((id) => ({ id, stack: 10000 })), smallBlind: 50, bigBlind: 100, button: 0 }, deck };
  return [s, ...actions];
}

describe("live odds", () => {
  // You hold Ace-Ace. Board: 2c 7d 9h then Ac, Kd.
  const deck = "2s3s4s5s6sAh 8s9sTsJsQsAd 2c7d9hAcKd";
  const folds: HandEvent[] = [3, 4, 5].map((seat) => ({ type: "fold", seat }));

  it("starts with your odds against everyone, compared with an average hand", () => {
    const [first] = oddsTimeline(hand(deck, []), 0);
    expect(first!.delta).toBeNull();
    expect(first!.chance).toBeGreaterThan(0.4);
    expect(first!.reason).toMatch(/^17% is a fair share against 5 other players; pocket Aces at \d+% is much better/);
  });

  it("goes up with each fold and says who folded", () => {
    const steps = oddsTimeline(hand(deck, folds), 0);
    expect(steps.map((s) => s.reason.split(":")[0])).toEqual([expect.any(String), "Cleo folded", "Dev folded", "Eli folded"]);
    for (const s of steps.slice(1)) expect(s.delta!).toBeGreaterThan(0);
  });

  it("names what a new card gave you, and stops when you fold", () => {
    const toFlop: HandEvent[] = [...folds, { type: "call", seat: 0 }, { type: "call", seat: 1 }, { type: "check", seat: 2 }];
    const steps = oddsTimeline(hand(deck, toFlop), 0);
    expect(steps.at(-1)!.reason).toMatch(/^The flop \(2♣ 7♦ 9♥\)/);
    const folded = oddsTimeline(hand(deck, [...folds, { type: "fold", seat: 0 }]), 0);
    expect(folded).toHaveLength(4);
  });
});
