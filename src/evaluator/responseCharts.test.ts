import { describe, expect, it } from "vitest";
import { FULL_DECK, mulberry32, shuffled } from "../cards/card";
import { apply, start } from "../engine/reduce";
import type { HandState, PlayerAction } from "../engine/types";
import { rangeCombos } from "./ranges";
import { readPreflop } from "./responseCharts";

const table = (): HandState => start({
  type: "start",
  config: { seats: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, stack: 10_000 })), smallBlind: 50, bigBlind: 100, button: 0 },
  deck: shuffled(mulberry32(1), FULL_DECK),
});
const play = (actions: PlayerAction[]) => actions.reduce(apply, table());
const pct = (s: ReadonlySet<string>) => rangeCombos(s).length / 1326;

describe("preflop situations", () => {
  // Button 0: SB 1, BB 2, UTG 3, HJ 4, CO 5.
  it("classifies every kind of preflop decision", () => {
    expect(readPreflop(table(), 3).spot).toBe("rfi");
    expect(readPreflop(play([{ type: "call", seat: 3 }]), 4).spot).toBe("vs-limp");
    expect(readPreflop(play([{ type: "raise", seat: 3, to: 250 }]), 4)).toMatchObject({ spot: "vs-open", opener: "UTG" });
    const threeBet = play([{ type: "raise", seat: 3, to: 250 }, { type: "raise", seat: 4, to: 750 }, { type: "fold", seat: 5 }, { type: "fold", seat: 0 }, { type: "fold", seat: 1 }, { type: "fold", seat: 2 }]);
    expect(readPreflop(threeBet, 3).spot).toBe("vs-3bet");
    expect(readPreflop(play([{ type: "raise", seat: 3, to: 250 }, { type: "raise", seat: 4, to: 750 }]), 5).spot).toBe("vs-4bet");
  });

  it("never lists a hand as both raise and call, and widens where it should", () => {
    const spots = [
      readPreflop(play([{ type: "raise", seat: 3, to: 250 }]), 4),
      readPreflop(play([{ type: "fold", seat: 3 }, { type: "fold", seat: 4 }, { type: "raise", seat: 5, to: 250 }]), 0),
      readPreflop(play([{ type: "raise", seat: 3, to: 250 }, { type: "fold", seat: 4 }, { type: "fold", seat: 5 }, { type: "fold", seat: 0 }, { type: "fold", seat: 1 }]), 2),
      readPreflop(play([{ type: "fold", seat: 3 }, { type: "fold", seat: 4 }, { type: "raise", seat: 5, to: 250 }, { type: "fold", seat: 0 }, { type: "fold", seat: 1 }]), 2),
    ];
    for (const s of spots) for (const h of s.chart.raise) expect(s.chart.call.has(h)).toBe(false);
    const cont = spots.map((s) => pct(s.chart.raise) + pct(s.chart.call));
    expect(cont[0]).toBeLessThan(cont[1]!);
    expect(cont[2]).toBeLessThan(cont[3]!);
    expect(cont[3]).toBeGreaterThan(0.35);
  });
});
