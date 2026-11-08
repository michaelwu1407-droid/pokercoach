import { describe, expect, it } from "vitest";
import { RFI } from "../evaluator/preflopCharts";
import { rowOf } from "../evaluator/responseCharts";
import { handWords, rowLine } from "./chartWords";

const rfi = (pos: "UTG" | "CO") => ({ raise: RFI[pos]!.raise, call: new Set<string>() });

describe("chart rules in a player's words", () => {
  it("names real hands instead of percentages", () => {
    expect(rowLine(rowOf(rfi("CO"), "A6o"), "raise")).toBe("With Ace-high offsuit hands, raise Ace-Eight offsuit or better.");
    expect(rowLine(rowOf(rfi("CO"), "A4s"), "raise")).toBe("With Ace-high suited hands, raise any suited Ace.");
    expect(rowLine(rowOf(rfi("UTG"), "33"), "raise")).toBe("With pairs, raise Fives or better.");
    expect(rowLine(rowOf(rfi("CO"), "85o"), "raise")).toBe("Every one of the Eight-high offsuit hands is a fold here.");
  });

  it("splits raises from calls and keeps gaps", () => {
    const chart = { raise: new Set(["AKs", "AQs", "A5s", "A4s"]), call: new Set(["AJs", "ATs"]) };
    expect(rowLine(rowOf(chart, "A9s"), "re-raise")).toBe("With Ace-high suited hands, re-raise Ace-Four to Ace-Five suited and Ace-Queen suited or better, and call Ace-Ten to Ace-Jack suited.");
  });

  it("uses the same hand names as the table", () => {
    expect(handWords("T3o")).toBe("Ten-Three offsuit");
    expect(handWords("88")).toBe("Pocket Eights");
  });
});
