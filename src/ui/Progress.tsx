import { dollars } from "../coach/words";
import { formatDate } from "./format";
import type { Concept } from "../learn/concepts";
import type { Learner } from "../learn/learner";
import { leaks, weekly } from "../learn/metrics";

export function Progress({ learner, concepts }: { learner: Learner; concepts: readonly Concept[] }) {
  const weeks = weekly(learner.log);
  const leakList = leaks(learner.log);
  const title = (id: string) => concepts.find((c) => c.id === id)?.title ?? id;
  return (
    <section className="page" data-testid="progress">
      <h2>Progress</h2>
      <p className="muted">The number that matters is how much you lose per decision on average, the same "cost" the coach shows. It should fall week by week. Winning or losing hands is noise.</p>
      {weeks.length === 0 ? <div className="empty">Play some hands to see your trend.</div> : (
        <table className="grid">
          <thead><tr><th>Week of</th><th>Decisions after the flop</th><th>Lost per decision</th><th>Preflop decisions right</th></tr></thead>
          <tbody>{weeks.map((w) => (
            <tr key={w.weekStart}>
              <td>{formatDate(w.weekStart)}</td>
              <td>{w.evDecisions}</td>
              <td>{w.meanEvLossBB === null ? "–" : dollars(w.meanEvLossBB)}</td>
              <td>{w.chartAccuracy === null ? "–" : `${Math.round(w.chartAccuracy * 100)}% of ${w.chartDecisions}`}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <h3>Your skills, weakest first</h3>
      {leakList.length === 0 ? <p className="muted">None measured yet.</p> : (
        <ol data-testid="leaks">{leakList.map((l) => (
          <li key={l.conceptId}>
            <b>{title(l.conceptId)}</b>: {Math.round(l.missRate * l.decisions)} mistakes in {l.decisions}
            {l.meanEvLossBB !== null && `, ${dollars(l.meanEvLossBB)} lost per decision on average`}
          </li>
        ))}</ol>
      )}
    </section>
  );
}
