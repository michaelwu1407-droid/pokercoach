import { formatCards, mulberry32 } from "../src/cards/card";
import { decide } from "../src/bots/policy";
import { STYLES } from "../src/bots/styles";
import { describeAction } from "../src/coach/explain";
import { CORE_CONCEPTS } from "../src/learn/concepts";
import { heroAct, newHand, state } from "../src/session/session";

const rng = mulberry32(1);
let shown = 0;
for (let n = 0; n < 60 && shown < 8; n++) {
  let h = newHand(77_000 + n, n);
  while (state(h).phase === "betting") {
    const st = state(h);
    const r = heroAct(h, decide(st, STYLES.tag, rng), CORE_CONCEPTS);
    const g = r.grade;
    if (g.graded && g.basis.kind === "ev" && g.verdict === "blunder") {
      shown++;
      console.log(st.street, formatCards(st.seats[0]!.hole), "|", formatCards(st.board), "pot", st.seats.reduce((a, s) => a + s.total, 0) / 100,
        "eq", g.basis.equity.toFixed(2), "range", g.basis.rangeSize, "chose", describeAction(g.action, 100), "|",
        g.basis.values.map((v) => `${describeAction(v.action, 100)}=${v.evBB.toFixed(1)}`).join(" "));
    }
    h = r.hand;
  }
}
