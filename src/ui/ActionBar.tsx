import { useCallback, useState } from "react";
import { aggressiveTo } from "../bots/policy";
import { legalActions, potSize } from "../engine/reduce";
import type { HandState, PlayerAction } from "../engine/types";
import { money } from "../coach/words";
import { useKeys } from "./useKeys";

interface Props {
  readonly st: HandState;
  readonly onAct: (a: PlayerAction) => void;
}

interface Preset {
  readonly label: string;
  readonly to: number;
}

/** Three presets, the way most poker apps offer them. Amounts are raise-to totals. */
function presetsFor(st: HandState): Preset[] {
  const legal = legalActions(st);
  if (st.phase !== "betting" || !legal?.raise) return [];
  const { min, max } = legal.raise;
  const clamp = (to: number) => Math.min(max, Math.max(min, Math.round(to / 50) * 50));
  const afterCall = potSize(st) + legal.callAmount;
  const raw: Preset[] = st.street === "preflop"
    ? [{ label: "Standard", to: aggressiveTo(st) }, { label: "Pot", to: st.currentBet + afterCall }, { label: "All-in", to: max }]
    : [{ label: "½ pot", to: st.currentBet + afterCall / 2 }, { label: "Pot", to: st.currentBet + afterCall }, { label: "All-in", to: max }];
  const out: Preset[] = [];
  for (const p of raw) {
    const to = p.label === "All-in" ? max : clamp(p.to);
    if (!out.some((o) => o.to === to)) out.push({ label: p.label, to });
  }
  return out;
}

/**
 * Fold, check or call, and raise. Raise opens a small sizer with three presets and a slider.
 * Keys: F fold, C check or call, R open the sizer then confirm, arrows change the amount, Escape closes it.
 */
export function ActionBar({ st, onAct }: Props) {
  const legal = st.phase === "betting" ? legalActions(st) : null;
  const presets = presetsFor(st);
  const bb = st.config.bigBlind;
  const raise = legal?.raise;
  const [sizing, setSizing] = useState(false);
  const [to, setTo] = useState(presets[0]?.to ?? raise?.min ?? 0);
  const clamp = (x: number) => (raise ? Math.min(raise.max, Math.max(raise.min, Math.round(x))) : 0);
  const seat = legal?.seat ?? 0;
  const raiseAction = raise ? ({ type: raise.kind, seat, to: clamp(to) } as PlayerAction) : null;
  const verb = raise?.kind === "bet" ? "Bet" : "Raise";
  const amountLabel = raise && clamp(to) === raise.max ? `All-in ${money(raise.max, bb)}` : `${verb === "Bet" ? "Bet" : "Raise to"} ${money(clamp(to), bb)}`;

  const onKey = useCallback((key: string) => {
    if (!legal) return false;
    if (key === "f" && !legal.canCheck) return onAct({ type: "fold", seat }), true;
    if (key === "c") return onAct(legal.canCheck ? { type: "check", seat } : { type: "call", seat }), true;
    if (key === "r" && raiseAction) return sizing ? onAct(raiseAction) : setSizing(true), true;
    if (key === "escape" && sizing) return setSizing(false), true;
    if ((key === "arrowup" || key === "arrowdown") && sizing) return setTo((t) => clamp(t + (key === "arrowup" ? bb : -bb))), true;
    return false;
  }, [st, onAct, to, sizing]);
  useKeys(legal ? onKey : null);
  if (!legal) return null;

  if (sizing && raise && raiseAction) {
    return (
      <div className="action-bar" data-testid="action-bar">
        <div className="sizer" data-testid="sizing">
          <div className="presets">
            {presets.map((p) => (
              <button key={p.label} className={`chip${clamp(to) === p.to ? " chip-on" : ""}`} data-testid={`preset-${p.label}`} onClick={() => setTo(p.to)}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="range" aria-label="Amount" min={raise.min} max={raise.max} step={bb / 2} value={clamp(to)}
            onChange={(e) => setTo(Number(e.target.value))} data-testid="slider" />
        </div>
        <div className="main-actions">
          <button data-testid="sizing-cancel" onClick={() => setSizing(false)}>Back</button>
          <button className="primary" data-testid="act-raise-confirm" onClick={() => onAct(raiseAction)}>{amountLabel}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="action-bar" data-testid="action-bar">
      <div className="main-actions">
        {!legal.canCheck && <button data-testid="act-fold" onClick={() => onAct({ type: "fold", seat })}>Fold</button>}
        {legal.canCheck
          ? <button data-testid="act-check" onClick={() => onAct({ type: "check", seat })}>Check</button>
          : <button data-testid="act-call" onClick={() => onAct({ type: "call", seat })}>Call {money(legal.callAmount, bb)}</button>}
        {raise && <button className="primary" data-testid="act-raise" onClick={() => setSizing(true)}>{verb}…</button>}
      </div>
    </div>
  );
}
