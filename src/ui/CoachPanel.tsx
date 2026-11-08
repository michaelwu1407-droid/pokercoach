import type { Opponents } from "../bots/opponents";
import { describeAction, feedback } from "../coach/feedback";
import type { CoachState } from "../coach/machine";
import type { HandState } from "../engine/types";
import type { Grade } from "../grading/types";
import { HERO } from "../session/session";
import { FeedbackCard } from "./FeedbackCard";
import { ALL_CONCEPTS } from "./store";

interface Props {
  readonly coachState: CoachState;
  readonly st: HandState;
  readonly opponents: Opponents;
  readonly grades: readonly Grade[];
  readonly drilling: boolean;
  readonly onResume: () => void;
  readonly onNext: () => void;
}

const VERDICT_MARK = { good: "✓", small: "≈", mistake: "✗", blunder: "✗✗" } as const;

export function CoachPanel({ coachState: c, st, opponents, grades, drilling, onResume, onNext }: Props) {
  const bb = st.config.bigBlind;
  const handOver = st.phase === "complete";
  const heroNet = handOver ? (st.payouts.find((p) => p.seat === HERO)?.amount ?? 0) - st.seats[HERO]!.total : 0;
  const graded = grades.filter((g) => g.graded);
  const misses = graded.filter((g) => g.graded && (g.verdict === "mistake" || g.verdict === "blunder")).length;
  if (c.kind === "idle" && !handOver) return null;
  return (
    <aside className="coach" data-testid="coach">
      {c.kind === "feedback" && (
        <FeedbackCard f={feedback(c.grade, ALL_CONCEPTS.filter((x) => c.conceptIds.includes(x.id)), opponents, bb)} />
      )}
      {c.kind === "feedback" && c.paused && !drilling && (
        <button className="primary wide" data-testid="continue" onClick={onResume}>Got it, continue</button>
      )}
      {drilling && c.kind === "feedback" && (
        <button className="primary wide" data-testid="next-drill" onClick={onNext}>Next</button>
      )}
      {handOver && !drilling && !(c.kind === "feedback" && c.paused) && (
        <div className="review" data-testid="review">
          <p className="outcome">
            Hand over: {heroNet >= 0 ? "+" : "−"}{Math.abs(heroNet / bb).toFixed(1)}bb.
            {" "}{graded.length === 0 ? "No graded decisions." : misses === 0 ? "No mistakes." : `${misses} mistake${misses > 1 ? "s" : ""}.`}
          </p>
          <p className="muted small">Winning or losing a hand says little. Your decisions are what count.</p>
          {graded.length > 0 && (
            <ol className="review-list">
              {grades.map((g, i) => g.graded && (
                <li key={i} className={`tone-${g.verdict}`}>{VERDICT_MARK[g.verdict]} {g.street}: {describeAction(g.action, bb)}</li>
              ))}
            </ol>
          )}
          <button className="primary wide" data-testid="next-hand" onClick={onNext}>Next hand</button>
        </div>
      )}
    </aside>
  );
}
