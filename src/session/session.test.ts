import { describe, expect, it } from "vitest";
import { mulberry32 } from "../cards/card";
import { decide } from "../bots/policy";
import { STYLES } from "../bots/styles";
import { feedback, feedbackText } from "../coach/feedback";
import { allowedNumbers, ungroundedNumbers } from "../coach/grounding";
import type { Grade } from "../grading/types";
import { CORE_CONCEPTS } from "../learn/concepts";
import { emptyLearner, learnFrom, type Learner } from "../learn/learner";
import { BIG_BLIND, heroAct, newHand, newTable, state } from "./session";

function playSession(hands: number) {
  const rng = mulberry32(9);
  const results: { grade: Grade; conceptIds: string[]; opponents: ReturnType<typeof newTable> }[] = [];
  let decisions = 0;
  let learner: Learner = emptyLearner;
  for (let n = 0; n < hands; n++) {
    const opponents = newTable(100 + Math.floor(n / 25));
    let h = newHand(5000 + n, n, opponents);
    while (state(h).phase === "betting") {
      const r = heroAct(h, decide(state(h), STYLES.lag, rng), CORE_CONCEPTS);
      decisions++;
      results.push({ grade: r.grade, conceptIds: r.concepts.map((c) => c.id), opponents });
      learner = learnFrom(learner, r.grade, r.concepts.map((c) => c.id), r.before, "play", n * 60_000);
      h = r.hand;
    }
  }
  return { results, decisions, learner };
}

describe("opponents", () => {
  it("seat random styles that differ by table and repeat for the same seed", () => {
    const seen = new Set<string>();
    for (let t = 0; t < 30; t++) Object.values(newTable(t)).forEach((o) => seen.add(o.style.id));
    expect(seen).toEqual(new Set(["nit", "tag", "lag", "station"]));
    expect(newTable(7)).toEqual(newTable(7));
    expect(Object.values(newTable(1)).map((o) => o.style.id)).not.toEqual(Object.values(newTable(2)).map((o) => o.style.id));
  });

  it("give two players of the same style their own thresholds", () => {
    const all = Array.from({ length: 20 }, (_, t) => Object.values(newTable(t))).flat();
    const lags = all.filter((o) => o.style.id === "lag").map((o) => o.style.bluff);
    expect(new Set(lags).size).toBeGreaterThan(1);
  });
});

describe("session", () => {
  const { results, decisions, learner } = playSession(150);

  it("grades every hero decision", () => {
    expect(results).toHaveLength(decisions);
    expect(results.filter((r) => !r.grade.graded)).toEqual([]);
    expect(results.some((r) => r.grade.graded && r.grade.basis.kind === "ev" && r.grade.basis.opponents > 1)).toBe(true);
  });

  it("gives every graded decision a short, specific, number-grounded lesson", () => {
    for (const { grade, conceptIds, opponents } of results.filter((r) => r.grade.graded)) {
      const f = feedback(grade, opponents, BIG_BLIND);
      expect(f.stats.length).toBeLessThanOrEqual(3);
      expect(f.keyPoint.length).toBeGreaterThan(20);
      const bad = ungroundedNumbers(feedbackText(f), allowedNumbers(grade, BIG_BLIND));
      expect(bad).toEqual([]);
      if (f.mix) expect(f.mix.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1, 6);
      if (grade.graded && grade.basis.kind === "ev") expect(f.read).toMatch(/plays like a/);
    }
  });

  it("the number guard rejects an invented figure", () => {
    const g = results.find((r) => r.grade.graded && r.grade.basis.kind === "ev")!.grade;
    expect(ungroundedNumbers("You had 97.3% equity here.", allowedNumbers(g, BIG_BLIND))).toContain("97.3");
  });

  it("saves wrong decisions with their opponents so drills replay exactly", () => {
    expect(learner.spots.length).toBeGreaterThan(0);
    for (const s of learner.spots) {
      expect(state(s.hand).phase).toBe("betting");
      expect(Object.keys(s.hand.opponents)).toHaveLength(5);
    }
  });
});
