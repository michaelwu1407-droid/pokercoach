import { describe, expect, it } from "vitest";
import { chunkPages } from "./chunk";
import { check, isRejection, toConcept } from "./validate";

const page = {
  location: "p. 12",
  text: "Position is power.\n\nWhen you act last you see what everyone else did. That information lets you play more hands profitably from the button than from early seats.\n\nA second paragraph about bet sizing.",
};

describe("chunking", () => {
  it("keeps page locations and respects the size target", () => {
    const chunks = chunkPages([page, { location: "p. 13", text: "x ".repeat(3000) }], 400);
    expect(chunks[0]!.location).toBe("p. 12");
    expect(chunks.every((c) => c.text.length <= 600)).toBe(true);
    expect(chunks.some((c) => c.location === "p. 13")).toBe(true);
  });
});

describe("candidate checks", () => {
  const [chunk] = chunkPages([page]);
  const good = {
    title: "Play more hands in position",
    statement: "Open more hands from the button than from early seats.",
    quote: "lets you play more hands profitably from the button than from early seats",
    appliesWhen: ["preflop-raise-first-in", "late-position"],
  };

  it("accepts a verbatim quote with known situation tests, ignoring whitespace and case", () => {
    const r = check({ ...good, quote: good.quote.toUpperCase().replace(/ /g, "  ") }, chunk!, "book");
    expect(isRejection(r)).toBe(false);
    if (!isRejection(r)) expect(toConcept(r, "My Book").sources[0]).toMatchObject({ kind: "book", location: "p. 12" });
  });

  it("rejects an invented quote", () => {
    expect(check({ ...good, quote: "always 3-bet the button with any two cards" }, chunk!, "book")).toMatchObject({ reason: "quote not found in the source text" });
  });

  it("rejects unknown situation tests", () => {
    expect(check({ ...good, appliesWhen: ["late-position", "vs-whale"] }, chunk!, "book")).toMatchObject({ reason: "unknown situation tests: vs-whale" });
  });
});
