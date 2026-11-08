import { useCallback } from "react";
import type { Opponents } from "../bots/opponents";
import { describeAction, feedback } from "../coach/feedback";
import type { CoachState } from "../coach/machine";
import type { HandState } from "../engine/types";
import type { Grade } from "../grading/types";
import { HERO } from "../session/session";
import { FeedbackCard } from "./FeedbackCard";
import { ALL_CONCEPTS } from "./store";
import { useKeys } from "./useKeys";
import { signedMoney } from "../coach/words";

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
  const showContinue = c.kind === "feedback" && c.paused && !drilling;
  const showNextDrill = drilling && c.kind === "feedback";
  const showReview = handOver && !drilling && !(c.kind === "feedback" && c.paused);
  const onKey = useCallback((key: string) => {
    if (key !== "enter" && key !== " ") return false;
    if (showContinue) onResume();
    else if (showNextDrill || showReview) onNext();
    else return false;
    return true;
  }, [showContinue, showNextDrill, showReview, onResume, onNext]);
  useKeys(showContinue || showNextDrill || showReview ? onKey : null);
  if (c.kind === "idle" && !handOver) return null;
  return (
    <aside className="coach" data-testid="coach">
      {c.kind === "feedback" && (
        <FeedbackCard f={feedback(c.grade, ALL_CONCEPTS.filter((x) => c.conceptIds.includes(x.id)), opponents, bb)} />
      )}
      {showContinue && (
        <button className="primary wide" data-testid="continue" onClick={onResume}>Got it, continue <kbd>Space</kbd></button>
      )}
      {showNextDrill && (
        <button className="primary wide" data-testid="next-drill" onClick={onNext}>Next <kbd>Space</kbd></button>
      )}
      {showReview && (
        <div className="review" data-testid="review">
          <p className="outcome">
            Hand over: {signedMoney(heroNet, bb)}.
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
          <button className="primary wide" data-testid="next-hand" onClick={onNext}>Next hand <kbd>Space</kbd></button>
        </div>
      )}
    </aside>
  );
}
