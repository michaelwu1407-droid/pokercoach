import { useState } from "react";
import type { Feedback } from "../coach/feedback";

const MIX_CLASS = ["mix-strong", "mix-top", "mix-weak", "mix-draw", "mix-air"] as const;

const KEY = "pokercoach.moreDetail";
const readOpen = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Verdict and one line up front. The full explanation is one click away, and stays open once you open it. */
export function FeedbackCard({ f }: { f: Feedback }) {
  const [open, setOpen] = useState(readOpen);
  const remember = (o: boolean) => {
    setOpen(o);
    try {
      localStorage.setItem(KEY, o ? "1" : "0");
    } catch {
      // Storage may be blocked. The choice then lasts for this page only.
    }
  };
  return (
    <div className={`feedback tone-${f.tone}`} data-testid="feedback">
      <div className="context">{f.context}</div>
      <h3 className="feedback-headline"><span className="verdict-dot" aria-hidden="true" />{f.headline}</h3>
      {f.lead && <p className="lead" data-testid="lead">{f.lead}</p>}
      <p className="summary" data-testid="summary">{f.summary}</p>
      <details className="more" data-testid="more" open={open} onToggle={(e) => remember((e.target as HTMLDetailsElement).open)}>
        <summary>More detail</summary>
        <div className="more-body">
          {f.stats.length > 0 && (
            <ul className="stats" data-testid="stats">
              {f.stats.map((s) => (
                <li key={s.label} className="stat">
                  <b className="stat-value">{s.value}</b>
                  <span className="stat-text"><span className="stat-label">{s.label}</span><span className="stat-detail">{s.detail}</span></span>
                </li>
              ))}
            </ul>
          )}
          {f.mix && (
            <div className="mix" data-testid="range-mix">
              <div className="micro-label">What they likely have</div>
              <div className="mix-bar">
                {f.mix.map((m, i) => m.share > 0.005 && <span key={m.label} className={MIX_CLASS[i]} style={{ width: `${m.share * 100}%` }} />)}
              </div>
              <ul className="mix-legend">
                {f.mix.map((m, i) => m.share >= 0.05 && (
                  <li key={m.label}><i className={MIX_CLASS[i]} />{m.label} {Math.round(m.share * 100)}%</li>
                ))}
              </ul>
            </div>
          )}
          {f.read && <p className="read" data-testid="read">{f.read}</p>}
          <div className="key-point" data-testid="key-point">
            <span className="key-tag">{f.keyLabel}</span>
            <p>{f.keyPoint}</p>
          </div>
          {f.draw && <p className="draw-line" data-testid="draw-line">{f.draw}</p>}
          {f.details.length > 0 && (
            <details className="details">
              <summary>How this was worked out</summary>
              {f.details.map((d) => <p key={d}>{d}</p>)}
              {f.caveats.map((c) => <p key={c} className="muted">{c}</p>)}
            </details>
          )}
        </div>
      </details>
    </div>
  );
}
