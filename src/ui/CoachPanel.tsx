import { useState } from "react";
import type { Opponents } from "../bots/opponents";
import { feedback } from "../coach/feedback";
import { isMiss } from "../grading/types";
import { FeedbackCard } from "./FeedbackCard";
import type { Decision } from "./useGame";

const ROUND = { preflop: "Before the flop", flop: "Flop", turn: "Turn", river: "River" } as const;

interface Props {
  readonly decisions: readonly Decision[];
  readonly opponents: Opponents;
  readonly bigBlind: number;
  /** "turn": your next decision is waiting, so only a quiet line shows. "review": the hand is over. */
  readonly moment: "watching" | "turn" | "review";
  readonly newTable: boolean;
}

/**
 * Your coach. After each decision, its card. While you make the next decision, only a quiet line, so
 * nothing hints at the answer. When the hand ends, every decision of the hand, each one openable.
 */
export function CoachPanel({ decisions, opponents, bigBlind, moment, newTable }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const latest = decisions[decisions.length - 1];
  const cardFor = (d: Decision) => (d.grade ? <FeedbackCard f={feedback(d.grade, opponents, bigBlind)} /> : <p className="muted" data-testid="grading">Looking at your decision…</p>);
  if (!latest) {
    return (
      <aside className="coach coach-empty" data-testid="coach">
        <p className="muted">{newTable ? "New table: five new players. Watch how each one bets." : "Your coach shows up here after each decision."}</p>
      </aside>
    );
  }
  if (moment === "turn") {
    const g = latest.grade;
    const line = g && g.graded ? feedback(g, opponents, bigBlind).headline : "Looking at your last decision…";
    return (
      <aside className="coach" data-testid="coach">
        <p className="muted small" data-testid="last-line">Last decision: <b className={g && g.graded ? `tone-${g.verdict}` : ""}>{line}</b></p>
      </aside>
    );
  }
  if (moment === "review" && decisions.length > 1) {
    const shown = open ?? decisions.length - 1;
    return (
      <aside className="coach" data-testid="coach">
        <ol className="review-list" data-testid="review-list">
          {decisions.map((d, i) => {
            const g = d.grade;
            const label = g && g.graded ? feedback(g, opponents, bigBlind).headline : "Not graded";
            return (
              <li key={i}>
                <button className={`review-row${i === shown ? " review-on" : ""}${g && g.graded && isMiss(g.verdict) ? " tone-mistake" : ""}`} onClick={() => setOpen(i)}>
                  {g ? `${ROUND[g.street]}: ${label}` : "Your last decision: looking at it…"}
                </button>
              </li>
            );
          })}
        </ol>
        {cardFor(decisions[shown]!)}
      </aside>
    );
  }
  return <aside className="coach" data-testid="coach">{cardFor(latest)}</aside>;
}
