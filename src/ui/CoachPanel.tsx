import type { Opponents } from "../bots/opponents";
import { feedback } from "../coach/feedback";
import type { CoachState } from "../coach/machine";
import { FeedbackCard } from "./FeedbackCard";
import { ALL_CONCEPTS } from "./store";

interface Props {
  readonly coachState: CoachState;
  readonly opponents: Opponents;
  readonly bigBlind: number;
}

/** The feedback card for your last decision, and nothing else. Buttons live under the table. */
export function CoachPanel({ coachState: c, opponents, bigBlind }: Props) {
  if (c.kind !== "feedback") return null;
  return (
    <aside className="coach" data-testid="coach">
      <FeedbackCard f={feedback(c.grade, ALL_CONCEPTS.filter((x) => c.conceptIds.includes(x.id)), opponents, bigBlind)} />
    </aside>
  );
}
