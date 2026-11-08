import { mulberry32 } from "../src/cards/card";
import { decide } from "../src/bots/policy";
import { STYLES } from "../src/bots/styles";
import { CORE_CONCEPTS } from "../src/learn/concepts";
import { heroAct, newHand, newTable, state } from "../src/session/session";

// Plays the hero as each bot style and reports how decisions grade. A sanity check on the grader.
for (const id of ["tag", "nit", "lag", "station"] as const) {
  const rng = mulberry32(1);
  const tally: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  let loss = 0, evCount = 0;
  const t0 = Date.now();
  for (let n = 0; n < 300; n++) {
    let h = newHand(77_000 + n, n, newTable(3 + Math.floor(n / 25)));
    while (state(h).phase === "betting") {
      const r = heroAct(h, decide(state(h), STYLES[id], rng), CORE_CONCEPTS);
      const g = r.grade;
      const k = g.graded ? `${g.basis.kind}:${g.verdict}` : "ungraded";
      tally[k] = (tally[k] ?? 0) + 1;
      if (!g.graded) reasons[g.reason] = (reasons[g.reason] ?? 0) + 1;
      if (g.graded && g.evLossBB !== null) (loss += g.evLossBB, evCount++);
      h = r.hand;
    }
  }
  console.log(id, `${Date.now() - t0}ms`, tally, `mean EV loss ${(loss / evCount).toFixed(2)}bb over ${evCount}`, reasons);
}
