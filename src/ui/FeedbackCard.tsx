import type { Feedback } from "../coach/feedback";

const MIX_CLASS = ["mix-strong", "mix-top", "mix-weak", "mix-draw", "mix-air"] as const;

export function FeedbackCard({ f }: { f: Feedback }) {
  return (
    <div className={`feedback tone-${f.tone}`} data-testid="feedback">
      <div className="context">{f.context}</div>
      <h3 className="feedback-headline">{f.headline}</h3>
      {f.stats.length > 0 && (
        <div className="stats">
          {f.stats.map((s) => (
            <div key={s.label} className="stat">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}
      {f.mix && (
        <div className="mix" data-testid="range-mix">
          <div className="micro-label">What they likely have</div>
          <div className="mix-bar">
            {f.mix.map((m, i) => m.share > 0.005 && <span key={m.label} className={MIX_CLASS[i]} style={{ width: `${m.share * 100}%` }} />)}
          </div>
          <ul className="mix-legend">
            {f.mix.map((m, i) => m.share >= 0.005 && (
              <li key={m.label}><i className={MIX_CLASS[i]} />{m.label} {Math.round(m.share * 100)}%</li>
            ))}
          </ul>
        </div>
      )}
      <p className="key-point" data-testid="key-point">{f.keyPoint}</p>
      {f.read && <p className="read" data-testid="read">{f.read}</p>}
      {f.details.length > 0 && (
        <details className="details">
          <summary>How this was worked out</summary>
          {f.details.map((d) => <p key={d}>{d}</p>)}
          {f.caveats.map((c) => <p key={c} className="muted">{c}</p>)}
        </details>
      )}
    </div>
  );
}
