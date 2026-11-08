import { describe, expect, it } from "vitest";
import { FULL_DECK, mulberry32, shuffled } from "../cards/card";
import { apply, legalActions, start } from "../engine/reduce";
import type { HandState, PlayerAction } from "../engine/types";
import { decide, moveDist, moveOf } from "./policy";
import { STYLES, type Style } from "./styles";

const order: Style["id"][] = ["nit", "tag", "lag", "station", "tag", "nit"];

function simulate(hands: number) {
  const rng = mulberry32(42);
  const stats = Object.fromEntries(order.map((id) => [id, { hands: 0, vpip: 0, agg: 0, passive: 0 }]));
  for (let h = 0; h < hands; h++) {
    const button = h % 6;
    let st: HandState = start({
      type: "start",
      config: { seats: order.map((id, i) => ({ id: `${id}${i}`, stack: 10_000 })), smallBlind: 50, bigBlind: 100, button },
      deck: shuffled(rng, FULL_DECK),
    });
    const voluntary = new Set<number>();
    while (st.phase === "betting") {
      const seat = legalActions(st)!.seat;
      const style = STYLES[order[seat]!];
      const d = moveDist(st, seat, st.seats[seat]!.hole, style);
      expect(d.fold + d.passive + d.aggressive).toBeCloseTo(1, 9);
      const a: PlayerAction = decide(st, style, rng);
      const m = moveOf(a);
      const s = stats[order[seat]!]!;
      if (st.street === "preflop" && a.type !== "check" && m !== "fold") voluntary.add(seat);
      if (st.street !== "preflop") m === "aggressive" ? s.agg++ : a.type === "call" && s.passive++;
      st = apply(st, a);
    }
    order.forEach((id, seat) => {
      stats[id]!.hands++;
      if (voluntary.has(seat)) stats[id]!.vpip++;
    });
  }
  return stats;
}

describe("bots", () => {
  it("play thousands of hands legally and show their named styles", () => {
    const s = simulate(3000);
    const vpip = (id: string) => s[id]!.vpip / s[id]!.hands;
    const af = (id: string) => s[id]!.agg / Math.max(1, s[id]!.passive);
    expect(vpip("nit")).toBeLessThan(vpip("tag"));
    expect(vpip("tag")).toBeLessThan(vpip("lag"));
    expect(vpip("station")).toBeGreaterThan(vpip("tag"));
    expect(af("lag")).toBeGreaterThan(af("tag"));
    expect(af("station")).toBeLessThan(af("tag"));
  }, 120_000);
});
