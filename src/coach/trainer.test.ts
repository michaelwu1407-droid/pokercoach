import { describe, expect, it } from "vitest";
import { FULL_DECK } from "../cards/card";
import { newTable } from "../session/session";
import { reduce } from "../engine/reduce";
import type { HandEvent, Start } from "../engine/types";
import { recordHand } from "../learn/seen";
import { trainerBrief } from "./trainer";

const opponents = newTable(4);
const ids = ["You", ...[1, 2, 3, 4, 5].map((i) => opponents[i]!.name)];
const start: Start = { type: "start", config: { seats: ids.map((id) => ({ id, stack: 10000 })), smallBlind: 50, bigBlind: 100, button: 0 }, deck: [...FULL_DECK] };
// Seat 3 raises, seat 4 calls, seat 5 folds, the blinds fold, so seat 0 (you, the Dealer) is next.
const raiseThenCall: HandEvent[] = [start, { type: "raise", seat: 3, to: 250 }, { type: "call", seat: 4 }, { type: "fold", seat: 5 }];

describe("what anyone at the table could count", () => {
  it("counts hands played and raised before the flop, never blinds", () => {
    const seen = recordHand(recordHand({}, raiseThenCall), raiseThenCall);
    expect(seen[ids[3]!]).toEqual({ hands: 2, played: 2, raised: 2 });
    expect(seen[ids[4]!]).toEqual({ hands: 2, played: 2, raised: 0 });
    expect(seen[ids[1]!]).toEqual({ hands: 2, played: 0, raised: 0 });
    expect(seen.You).toBeUndefined();
  });
});

describe("the trainer's three checks", () => {
  const st = reduce(raiseThenCall);
  it("names your seat, the price of calling, and who raised", () => {
    const b = trainerBrief(st, 0, opponents, {});
    expect(b.position).toBe("Dealer seat. Only the blinds act after you. Play more hands.");
    expect(b.price).toBe("Your $2.50 call makes the pot $9. You need to win 28% of the time.");
    expect(b.player).toBe(`${ids[3]} raised. Too few hands to read ${ids[3]} yet.`);
  });

  it("reads a player from counts once there are enough hands", () => {
    const b = trainerBrief(st, 0, opponents, { [ids[3]!]: { hands: 10, played: 6, raised: 4 } });
    expect(b.player).toBe(`${ids[3]} raised. ${ids[3]} plays 1 hand in 2 and raises most. This raise is often weak.`);
  });
});
