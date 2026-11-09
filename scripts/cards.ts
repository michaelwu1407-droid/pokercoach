/**
 * Prints a batch of real feedback cards from one game, one per kind of spot, for a beginner's read.
 * Usage: npm run cards -- <seed> <count>. Review them as a learner before shipping coach-text changes.
 */
import { mulberry32 } from "../src/cards/card";
import { decide } from "../src/bots/policy";
import { STYLES } from "../src/bots/styles";
import { feedback } from "../src/coach/feedback";
import { describeHand } from "../src/evaluator/describe";
import { advance, freshGame, gradeDecision, newHand, state } from "../src/session/session";
const rng = mulberry32(Number(process.argv[2] ?? 4));
const seen = new Map<string, number>();
const out: string[] = [];
const game = freshGame(Number(process.argv[2] ?? 4));
for (let n = 0; n < 200 && out.length < Number(process.argv[3] ?? 16); n++) {
  const t = game;
  let h = newHand(700 + n, n, t.opponents);
  while (state(h).phase === "betting") {
    const st = state(h);
    const a = decide(st, n % 2 ? STYLES.lag : STYLES.station, rng);
    const g = gradeDecision(h, a);
    const key = g.graded ? `${g.street}-${g.basis.kind === "chart" ? g.basis.spot : g.basis.opponents}-${g.verdict}` : "ungraded";
    if ((seen.get(key) ?? 0) < 1) {
      seen.set(key, 1);
      const f = feedback(g, h.opponents, 100);
      out.push(`### ${f.context}\nYou have: ${describeHand(st.seats[0]!.hole, st.board)}\n**${f.headline}**\n${f.lead ? `_${f.lead}_\n` : ""}${f.summary}\n${f.stats.map((s) => `- ${s.value} | ${s.label} | ${s.detail}`).join("\n")}\n${f.mix ? `What they likely have: ${f.mix.filter((m) => m.share > 0.01).map((m) => `${m.label} ${Math.round(m.share * 100)}%`).join(", ")}\n` : ""}> [${f.keyLabel}] ${f.keyPoint}\n${f.draw ? f.draw + "\n" : ""}${f.read ? f.read + "\n" : ""}`);
    }
    h = advance(h, a);
  }
}
console.log(out.join("\n"));
