import type { OddsStep } from "../coach/liveOdds";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Delta({ d }: { d: number | null }) {
  if (d === null || Math.round(Math.abs(d) * 100) === 0) return null;
  const up = d > 0;
  return <span className={`odds-delta ${up ? "odds-up" : "odds-down"}`}>{up ? "▲" : "▼"} {Math.round(Math.abs(d) * 100)}</span>;
}

/**
 * Your hand and your live chance to win, beside your cards. Each change comes with one plain reason.
 * The odds use only what anyone at the table can see, so they never give away the coach's answer.
 */
export function OddsPanel({ hand, folded, over, steps }: { hand: string; folded: boolean; over: boolean; steps: readonly OddsStep[] }) {
  // Once the hand is over the cards are known, so only the history stays.
  const last = over ? undefined : steps[steps.length - 1];
  return (
    <div className="odds-panel" data-testid="odds">
      <div className="odds-row">
        <span className="odds-hand" data-testid="you-have">{folded ? "You folded" : "You have"}: <b>{hand}</b></span>
        {!folded && last && (
          <span className="odds-chance" data-testid="odds-chance">
            <b>{pct(last.chance)}</b> to win <Delta d={last.delta} /> <span className="odds-basis">vs random hands</span>
          </span>
        )}
      </div>
      {!folded && last && <p className="odds-why" data-testid="odds-why">{last.reason}</p>}
      {steps.length > 1 && (
        <details className="odds-history">
          <summary>How your odds moved</summary>
          <ol>
            {steps.map((s, i) => (
              <li key={i}><b>{pct(s.chance)}</b> <Delta d={s.delta} /> <span>{s.reason}</span></li>
            ))}
          </ol>
          <p className="muted">These odds treat everyone else's cards as random. After your move, the coach also uses what their bets tell you.</p>
        </details>
      )}
    </div>
  );
}
