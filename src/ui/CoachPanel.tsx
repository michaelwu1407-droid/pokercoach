import { useState } from "react";
import type { Opponents } from "../bots/opponents";
import { describeAction, feedback } from "../coach/feedback";
import { money } from "../coach/words";
import { isMiss } from "../grading/types";
import { FeedbackCard } from "./FeedbackCard";
import type { Decision } from "./useGame";

const VERDICT = { good: "Good", small: "Close", mistake: "Mistake", blunder: "Big mistake" } as const;
const ROUND = { preflop: "Before the flop", flop: "Flop", turn: "Turn", river: "River" } as const;

interface Props {
  readonly decisions: readonly Decision[];
  readonly opponents: Opponents;
  readonly bigBlind: number;
  /** "turn": your next decision is waiting, so the last card folds to one line you can open. "review": the hand is over. */
  readonly moment: "watching" | "turn" | "review";
  readonly newTable: boolean;
  /** What changed at the table since the last hand, if anything. */
  readonly news: string | null;
}

/**
 * Your coach. After each decision, its card. While you make the next decision, only a quiet line, so
 * nothing hints at the answer. When the hand ends, every decision of the hand, each one openable.
 */
export function CoachPanel({ decisions, opponents, bigBlind, moment, newTable, news }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const latest = decisions[decisions.length - 1];
  const cardFor = (d: Decision, inList = false) => (d.grade ? <FeedbackCard f={feedback(d.grade, opponents, bigBlind)} showContext={!inList} /> : <p className="muted" data-testid="grading">Looking at your decision…</p>);
  if (!latest) {
    return (
      <aside className="coach coach-empty" data-testid="coach">
        <div className="micro-label">Coach</div>
        <p className="muted" data-testid="table-news">
          {news ?? (newTable ? "New game: five new players, $100 each. Last one with chips wins." : "Your coach shows up here after each decision.")}
        </p>
      </aside>
    );
  }
  if (moment === "turn") {
    const g = latest.grade;
    const line = g && g.graded ? feedback(g, opponents, bigBlind).headline : "Looking at your last decision…";
    // Folded by default so nothing distracts from the new decision; one click brings the full card back.
    return (
      <aside className="coach" data-testid="coach">
        <details className="last-more">
          <summary className="muted small" data-testid="last-line">
            <span className="last-text">Last decision: <b className={g && g.graded ? `tone-${g.verdict}` : ""}>{line}</b> <span className="last-open">Show why</span></span>
            <span className="last-close">Hide last decision</span>
          </summary>
          {cardFor(latest)}
        </details>
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
            const verdict = !g || !g.graded ? "Not graded" : VERDICT[g.verdict];
            return (
              <li key={i}>
                <button className={`review-row${i === shown ? " review-on" : ""} tone-${!g ? "pending" : !g.graded ? "small" : isMiss(g.verdict) ? "mistake" : g.verdict}`} onClick={() => setOpen(i)}>
                  {g ? <><span className="review-what">{ROUND[g.street]}, {d.action.type === "call" && g.graded && g.facing ? `call ${money(g.facing.to, bigBlind)}` : describeAction(d.action, bigBlind)}</span><span className="review-verdict">{verdict}</span></> : "Your last decision: looking at it…"}
                </button>
              </li>
            );
          })}
        </ol>
        {cardFor(decisions[shown]!, true)}
      </aside>
    );
  }
  return <aside className="coach" data-testid="coach">{cardFor(latest)}</aside>;
}
