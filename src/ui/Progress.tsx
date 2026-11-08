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
      <p className="muted">The number that matters is EV lost per decision. It should fall week by week. Wins and losses are noise.</p>
      {weeks.length === 0 ? <div className="empty">Play some hands to see your trend.</div> : (
        <table className="grid">
          <thead><tr><th>Week of</th><th>EV-graded decisions</th><th>EV lost per decision</th><th>Preflop chart accuracy</th></tr></thead>
          <tbody>{weeks.map((w) => (
            <tr key={w.weekStart}>
              <td>{formatDate(w.weekStart)}</td>
              <td>{w.evDecisions}</td>
              <td>{w.meanEvLossBB === null ? "–" : `${w.meanEvLossBB.toFixed(2)}bb`}</td>
              <td>{w.chartAccuracy === null ? "–" : `${Math.round(w.chartAccuracy * 100)}% of ${w.chartDecisions}`}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <h3>Biggest leaks</h3>
      {leakList.length === 0 ? <p className="muted">None measured yet.</p> : (
        <ol>{leakList.map((l) => <li key={l.conceptId}>{title(l.conceptId)}: {l.meanEvLossBB.toFixed(2)}bb per decision over {l.decisions}</li>)}</ol>
      )}
    </section>
  );
}
