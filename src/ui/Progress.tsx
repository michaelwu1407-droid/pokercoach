import { dollars } from "../coach/words";
import { formatDate } from "./format";
import type { Concept } from "../learn/concepts";
import type { Learner } from "../learn/learner";
import { leaks, weekly } from "../learn/metrics";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** One headline number with a plain line on what it measures. */
function Kpi({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <div className="kpi">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-detail">{detail}</div>
    </div>
  );
}

export function Progress({ learner, concepts }: { learner: Learner; concepts: readonly Concept[] }) {
  const weeks = weekly(learner.log);
  const leakList = leaks(learner.log);
  const title = (id: string) => concepts.find((c) => c.id === id)?.title ?? id;
  const now = weeks[weeks.length - 1];
  const before = weeks[weeks.length - 2];
  const trend = now?.meanEvLossBB != null && before?.meanEvLossBB != null
    ? (now.meanEvLossBB <= before.meanEvLossBB ? `Down from ${dollars(before.meanEvLossBB)} last week.` : `Up from ${dollars(before.meanEvLossBB)} last week.`)
    : "Your trend appears after a second week.";
  return (
    <section className="page" data-testid="progress">
      <h2>Progress</h2>
      <p className="muted">Judge your decisions, not wins and losses. One hand is mostly luck.</p>
      {!now ? <div className="empty">Play some hands to see your numbers.</div> : (
        <>
          <div className="kpis">
            <Kpi value={now.meanEvLossBB === null ? "–" : dollars(now.meanEvLossBB)} label="Lost per decision after the flop"
              detail={`Your average cost this week. Lower is better. ${trend}`} />
            <Kpi value={now.chartAccuracy === null ? "–" : pct(now.chartAccuracy)} label="Before-the-flop decisions right"
              detail={`Out of ${now.chartDecisions} this week.`} />
            <Kpi value={String(now.evDecisions + now.chartDecisions)} label="Decisions graded this week" detail="More decisions make these numbers more reliable." />
          </div>
          {weeks.length > 1 && (
            <table className="grid">
              <thead><tr><th>Week of</th><th>Lost per decision</th><th>Before the flop right</th></tr></thead>
              <tbody>{weeks.map((w) => (
                <tr key={w.weekStart}>
                  <td>{formatDate(w.weekStart)}</td>
                  <td>{w.meanEvLossBB === null ? "–" : dollars(w.meanEvLossBB)}</td>
                  <td>{w.chartAccuracy === null ? "–" : `${pct(w.chartAccuracy)} of ${w.chartDecisions}`}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </>
      )}
      <h3>Your skills, weakest first</h3>
      {leakList.length === 0 ? <p className="muted">None measured yet.</p> : (
        <ol className="skills" data-testid="leaks">{leakList.map((l) => (
          <li key={l.conceptId} className="skill">
            <div className="skill-head">
              <b>{title(l.conceptId)}</b>
              <span className="muted">{Math.round(l.missRate * l.decisions)} mistakes in {l.decisions}</span>
            </div>
            <div className="skill-bar"><span style={{ width: `${Math.max(3, l.missRate * 100)}%` }} /></div>
            {l.meanEvLossBB !== null && <div className="skill-detail">{dollars(l.meanEvLossBB)} lost per decision on average</div>}
          </li>
        ))}</ol>
      )}
    </section>
  );
}
