import { describeAction, explain } from "../coach/explain";
import type { CoachState } from "../coach/machine";
import type { HandState } from "../engine/types";
import type { Grade } from "../grading/types";
import type { Concept } from "../learn/concepts";
import { cite } from "../coach/explain";
import { HERO } from "../session/session";

interface Props {
  readonly coachState: CoachState;
  readonly concepts: readonly Concept[];
  readonly related: readonly Concept[];
  readonly st: HandState;
  readonly drilling: boolean;
  readonly drillConceptIds: readonly string[];
  readonly onDismiss: () => void;
  readonly onNextHand: () => void;
}

const byId = (concepts: readonly Concept[], ids: readonly string[]) => concepts.filter((c) => ids.includes(c.id));

function Reveal({ grade, concepts, reason, bigBlind }: { grade: Grade; concepts: readonly Concept[]; reason: string | null; bigBlind: number }) {
  const msg = explain(grade, concepts, bigBlind);
  const tone = grade.graded ? grade.verdict : "ungraded";
  return (
    <div className={`reveal reveal-${tone}`} data-testid="reveal">
      <h3 className="reveal-headline">{msg.headline}</h3>
      <p className="muted">You chose: {describeAction(grade.action, bigBlind)}</p>
      {reason && <p className="your-reason">Your reason: “{reason}”. Compare it with the numbers below.</p>}
      <ul>{msg.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      {msg.citations.length > 0 && (
        <div className="citations" data-testid="citations">
          <div className="micro-label">Sources</div>
          {msg.citations.map((c) => <p key={c}>{c}</p>)}
        </div>
      )}
      {msg.caveats.length > 0 && (
        <details className="caveats"><summary>What this number simplifies</summary>{msg.caveats.map((c) => <p key={c}>{c}</p>)}</details>
      )}
    </div>
  );
}

export function CoachPanel({ coachState: c, concepts, related, st, drilling, drillConceptIds, onDismiss, onNextHand }: Props) {
  const bigBlind = st.config.bigBlind;
  const heroNet = st.phase === "complete"
    ? (st.payouts.find((p) => p.seat === HERO)?.amount ?? 0) - st.seats[HERO]!.total : 0;
  return (
    <aside className="coach" data-testid="coach">
      <div className="micro-label">Coach</div>
      {drilling && c.kind !== "reveal" && (
        <div className="predict" data-testid="drill-prompt">
          <h3>Drill: {byId(concepts, drillConceptIds).map((x) => x.title).join(" · ")}</h3>
          <p>Same spot you missed before. Decide again and say why in one line.</p>
        </div>
      )}
      {c.kind === "predict" && (
        <div className="predict" data-testid="predict">
          <h3>Study spot: {byId(concepts, c.conceptIds).map((x) => x.title).join(" · ")}</h3>
          <p>Decide what you would do, and say why in one line. Then I will show you the numbers.</p>
        </div>
      )}
      {c.kind === "reveal" && (
        <>
          <Reveal grade={c.grade} concepts={byId(concepts, c.conceptIds)} reason={c.reason} bigBlind={bigBlind} />
          <button className="primary" data-testid="dismiss" onClick={onDismiss}>{drilling ? "Next drill" : "Continue"}</button>
        </>
      )}
      {c.kind !== "reveal" && st.phase === "complete" && !drilling && (
        <div className="review" data-testid="review">
          <h3>Hand review</h3>
          <p className="outcome">Result: {heroNet >= 0 ? "+" : ""}{+(heroNet / bigBlind).toFixed(1)}bb. The result does not affect your grades.</p>
          {c.kind === "review" && c.grades.length === 0 && <p className="muted">No decisions this hand.</p>}
          {c.kind === "review" && (
            <ol>{c.grades.map((g, i) => (
              <li key={i} className={`review-${g.graded ? g.verdict : "ungraded"}`}>
                {g.street}: {describeAction(g.action, bigBlind)} · {g.graded ? `${g.verdict}${g.evLossBB !== null && g.evLossBB > 0.05 ? `, −${g.evLossBB.toFixed(1)}bb` : ""}` : "not graded"}
              </li>
            ))}</ol>
          )}
          <button className="primary" data-testid="next-hand" onClick={onNextHand}>Next hand</button>
        </div>
      )}
      {c.kind !== "reveal" && related.length > 0 && (
        <div className="related">
          <div className="micro-label">From your books</div>
          {related.slice(0, 2).map((r) => <p key={r.id}><b>{r.title}.</b> {r.statement} <span className="muted">{r.sources.map(cite).join(" ")}</span></p>)}
        </div>
      )}
    </aside>
  );
}
