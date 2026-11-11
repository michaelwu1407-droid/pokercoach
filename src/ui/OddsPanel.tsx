import type { OddsStep } from "../coach/liveOdds";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Delta({ d }: { d: number | null }) {
  if (d === null || Math.round(Math.abs(d) * 100) === 0) return null;
  const up = d > 0;
  return <span className={`odds-delta ${up ? "odds-up" : "odds-down"}`}>{up ? "▲" : "▼"} {Math.round(Math.abs(d) * 100)}</span>;
}

/**
 * Your live chance to win, in a pill beside your seat. The odds use only what anyone at the table
 * can see, so they never give away the coach's answer. Once the hand is over the cards are known, so it goes.
 */
export function OddsChance({ folded, over, steps }: { folded: boolean; over: boolean; steps: readonly OddsStep[] }) {
  const last = steps[steps.length - 1];
  if (folded || over || !last) return null;
  return (
    <span className="odds-chance" data-testid="odds-chance">
      <b>{pct(last.chance)}</b> to win <Delta d={last.delta} /> <span className="odds-basis">vs random hands</span>
    </span>
  );
}

/** Under the table, on one line where it fits: why your odds last changed, then how they moved all hand. */
export function OddsPanel({ folded, over, steps }: { folded: boolean; over: boolean; steps: readonly OddsStep[] }) {
  const last = over ? undefined : steps[steps.length - 1];
  return (
    <div className="odds-panel" data-testid="odds">
      {!folded && last && <p className="odds-why" data-testid="odds-why">{last.reason}</p>}
      {steps.length > 1 && (
        <details className="odds-history">
          <summary>How your odds moved</summary>
          <ol>
            {steps.map((s, i) => (
              <li key={i}><b>{pct(s.chance)}</b> <Delta d={s.delta} /> <span>{s.reason}</span></li>
            ))}
          </ol>
          <p className="muted">These odds ignore what their bets tell you. The coach uses their bets after your move.</p>
        </details>
      )}
    </div>
  );
}
