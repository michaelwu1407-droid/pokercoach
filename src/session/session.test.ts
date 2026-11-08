import { describe, expect, it } from "vitest";
import { mulberry32 } from "../cards/card";
import { decide } from "../bots/policy";
import { STYLES } from "../bots/styles";
import { allowedNumbers, explain, ungroundedNumbers } from "../coach/explain";
import { coach, initialCoach } from "../coach/machine";
import type { Grade } from "../grading/types";
import { CORE_CONCEPTS } from "../learn/concepts";
import { emptyLearner, learnFrom, type Learner } from "../learn/learner";
import { BIG_BLIND, heroAct, newHand, state } from "./session";

function playSession(hands: number) {
  const rng = mulberry32(9);
  const results: { grade: Grade; conceptIds: string[] }[] = [];
  let decisions = 0;
  let learner: Learner = emptyLearner;
  for (let n = 0; n < hands; n++) {
    let h = newHand(5000 + n, n);
    while (state(h).phase === "betting") {
      const action = decide(state(h), STYLES.lag, rng);
      decisions++;
      const r = heroAct(h, action, CORE_CONCEPTS);
      results.push({ grade: r.grade, conceptIds: r.concepts.map((c) => c.id) });
      learner = learnFrom(learner, r.grade, r.concepts.map((c) => c.id), r.spotEvents, "play", n * 60_000);
      h = r.hand;
    }
    expect(h.grades).toHaveLength(h.events.filter((e) => e.type !== "start" && e.seat === 0).length);
  }
  return { results, decisions, learner };
}

describe("session", () => {
  const { results, decisions, learner } = playSession(150);

  it("produces a grade object for every hero decision", () => {
    expect(results).toHaveLength(decisions);
    const graded = results.filter((r) => r.grade.graded);
    expect(graded.length).toBeGreaterThan(decisions * 0.4);
    for (const r of results) if (!r.grade.graded) expect(r.grade.reason.length).toBeGreaterThan(0);
  });

  it("only prints numbers the grader produced, and cites a source for every concept", () => {
    for (const { grade, conceptIds } of results) {
      const concepts = CORE_CONCEPTS.filter((c) => conceptIds.includes(c.id));
      const msg = explain(grade, concepts, BIG_BLIND);
      const text = [msg.headline, ...msg.lines, ...msg.citations, ...msg.caveats].join(" ");
      expect(ungroundedNumbers(text, allowedNumbers(grade, concepts, BIG_BLIND))).toEqual([]);
      if (concepts.length > 0) expect(msg.citations.length).toBeGreaterThan(0);
    }
  });

  it("the number guard rejects an invented figure", () => {
    const g = results.find((r) => r.grade.graded && r.grade.basis.kind === "ev")!.grade;
    expect(ungroundedNumbers("You had 97.3% equity here.", allowedNumbers(g, [], BIG_BLIND))).toContain("97.3");
  });

  it("saves wrong decisions as drillable spots and tracks mastery per concept", () => {
    expect(learner.spots.length).toBeGreaterThan(0);
    expect(Object.keys(learner.mastery).length).toBeGreaterThan(2);
    for (const s of learner.spots) expect(s.events[0]!.type).toBe("start");
  });
});

describe("coach state machine", () => {
  const good = { graded: true, verdict: "good", evLossBB: 0 } as unknown as Grade;
  const blunder = { graded: true, verdict: "blunder", evLossBB: 5 } as unknown as Grade;

  it("pauses for a studied concept at most once per hand, then reveals", () => {
    let s = coach(initialCoach, { type: "heroTurn", studiedConceptIds: ["pot-odds"] });
    expect(s.kind).toBe("predict");
    s = coach(s, { type: "heroActed", grade: good, conceptIds: ["pot-odds"], reason: "pot odds" });
    expect(s.kind).toBe("reveal");
    s = coach(s, { type: "dismiss" });
    s = coach(s, { type: "heroTurn", studiedConceptIds: ["pot-odds"] });
    expect(s.kind).toBe("idle");
  });

  it("stays quiet on small errors and interrupts on big ones", () => {
    expect(coach(initialCoach, { type: "heroActed", grade: good, conceptIds: [], reason: null }).kind).toBe("idle");
    expect(coach(initialCoach, { type: "heroActed", grade: blunder, conceptIds: [], reason: null }).kind).toBe("reveal");
  });
});
