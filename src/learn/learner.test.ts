import { describe, expect, it } from "vitest";
import { isMiss } from "../grading/types";
import { parseLearner } from "../ui/store";
import { gradeDecision, HERO, newHand, newTable, state } from "../session/session";
import { drillQueue, emptyLearner, learnFrom, PRACTICE_DELAY_MS, spotId } from "./learner";

/** The first dealt hand where folding before the flop is a real mistake. */
function foldMistake() {
  const opponents = newTable(3);
  for (let seed = 0; seed < 500; seed++) {
    const hand = newHand(seed, 0, opponents);
    const st = state(hand);
    if (st.phase !== "betting" || st.toAct !== HERO || st.currentBet === 0) continue;
    const fold = { type: "fold", seat: HERO } as const;
    const g = gradeDecision(hand, fold);
    if (g.graded && isMiss(g.verdict)) return { hand, g, right: gradeDecision(hand, g.best) };
  }
  throw new Error("no fold mistake in 500 hands");
}

describe("practice", () => {
  const { hand, g, right } = foldMistake();
  const ids = ["preflop-charts"];

  it("saves a mistake once, however often it is repeated", () => {
    const once = learnFrom(emptyLearner, g, ids, hand, "play", 0);
    const twice = learnFrom(once, g, ids, hand, "play", 1000);
    expect(twice.spots.map((s) => s.id)).toEqual([spotId(hand)]);
    expect(twice.log).toHaveLength(2);
  });

  it("brings a mistake back only after the delay", () => {
    const l = learnFrom(emptyLearner, g, ids, hand, "play", 0);
    expect(drillQueue(l, PRACTICE_DELAY_MS - 1)).toEqual([]);
    expect(drillQueue(l, PRACTICE_DELAY_MS).map((s) => s.id)).toEqual([spotId(hand)]);
  });

  it("retires a spot answered right in practice, and keeps one answered wrong", () => {
    const l = learnFrom(emptyLearner, g, ids, hand, "play", 0);
    expect(right.graded && isMiss(right.verdict)).toBe(false);
    expect(learnFrom(l, right, ids, hand, "drill", PRACTICE_DELAY_MS).spots).toEqual([]);
    const again = learnFrom(l, g, ids, hand, "drill", PRACTICE_DELAY_MS);
    expect(again.spots[0]!.dueAt).toBe(2 * PRACTICE_DELAY_MS);
  });

  it("a right answer at the table does not touch other saved spots", () => {
    const l = learnFrom(emptyLearner, g, ids, hand, "play", 0);
    expect(learnFrom(l, right, ids, hand, "play", 5).spots).toHaveLength(1);
  });
});

describe("saved progress", () => {
  it("keeps good entries and drops malformed ones", () => {
    const good = { at: 1, origin: "play", verdict: "good", evLossBB: 0, conceptIds: ["x"] };
    const parsed = parseLearner({ log: [good, { ...good, verdict: "great" }, { ...good, at: "1" }, null], spots: [{ id: 1 }] });
    expect(parsed).toEqual({ log: [good], spots: [] });
    expect(parseLearner("junk")).toEqual(emptyLearner);
    expect(parseLearner(null)).toEqual(emptyLearner);
  });
});
