import type { Opponents } from "../bots/opponents";
import { describeAction, feedback } from "../coach/feedback";
import type { Brief } from "../coach/trainer";
import type { Trainer } from "./useTrainer";

const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/**
 * The live trainer, shown on your turn when it is switched on. First the three checks, which only
 * use what anyone at the table can see. The hint and the answer stay hidden until you ask.
 */
export function TrainerPanel({ trainer, brief, opponents, bigBlind }: { trainer: Trainer; brief: Brief; opponents: Opponents; bigBlind: number }) {
  const best = trainer.best && trainer.best.graded ? trainer.best : null;
  const f = best ? feedback(best, opponents, bigBlind) : null;
  // The Position and Price checks already say your seat and that nobody raised, so the hint is just the rule.
  const hint = f ? (f.lead ?? f.keyPoint).replace(/^Nobody has raised\. From the \w+ seat, raise/, "Raise").replace(/ From the \w+ seat, raise/, " Raise") : null;
  return (
    <aside className="coach trainer" data-testid="trainer">
      <div className="micro-label">Live trainer · your three checks</div>
      <p className="muted small trainer-lead">Poker has no single perfect move like chess, and their cards are hidden. These checks use only what you can see at the table.</p>
      <ol className="checklist">
        <li><b>Position</b><span>{brief.position}</span></li>
        <li><b>Price</b><span>{brief.price}</span></li>
        {brief.player && <li><b>Player</b><span>{brief.player}</span></li>}
      </ol>
      {trainer.hint && hint
        ? <div className="key-point" data-testid="trainer-hint"><span className="key-tag">Hint</span><p>{hint}</p></div>
        : <button data-testid="trainer-hint-button" disabled={!hint} onClick={trainer.showHint}>{hint ? "Hint" : "Thinking…"}</button>}
      {trainer.answer && best && f
        ? (
          <div className="key-point trainer-answer" data-testid="trainer-answer">
            <span className="key-tag">Best move: {describeAction(best.action, bigBlind, best.allInTo)}</span>
            <p>{f.summary}</p>
          </div>
        )
        : <button data-testid="trainer-answer-button" disabled={!best} onClick={trainer.showAnswer}>Show best move</button>}
      {trainer.answer && <p className="muted small">This decision counts as assisted, so it stays out of your progress numbers.</p>}
      <details className="trainer-why">
        <summary>Why a poker trainer works differently from a chess one</summary>
        <ul>
          <li>The same hand can be a call against a wild player and a fold against a tight one, so the trainer tracks how each player has played this game.</li>
          <li>A good poker decision can lose and a bad one can win. Judge yourself by the decision, never by the result.</li>
        </ul>
      </details>
    </aside>
  );
}

/** The "think again" box that replaces the action buttons when your move looks like a mistake. */
export function TrainerWarning({ trainer, opponents, bigBlind }: { trainer: Trainer; opponents: Opponents; bigBlind: number }) {
  if (!trainer.warn) return null;
  const f = feedback(trainer.warn.grade, opponents, bigBlind);
  const cost = trainer.warn.grade.graded && trainer.warn.grade.evLossBB !== null ? f.stats.find((s) => s.label === "Cost of this choice") : undefined;
  return (
    <div className="trainer-warning" data-testid="trainer-warning" role="alertdialog" aria-label="Think again">
      <b>Think again: {capital(describeAction(trainer.warn.action, bigBlind))} looks like a mistake{cost ? ` (it costs about ${cost.value.replace("−", "")} on average)` : ""}.</b>
      <p>{f.summary}</p>
      <div className="trainer-warning-actions">
        <button className="primary" data-testid="trainer-take-back" onClick={trainer.takeBack}>Take it back</button>
        <button data-testid="trainer-play-anyway" onClick={trainer.playAnyway}>Play it anyway</button>
      </div>
    </div>
  );
}
