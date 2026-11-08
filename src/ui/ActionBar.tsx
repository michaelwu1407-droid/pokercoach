import { useCallback, useState } from "react";
import { legalActions } from "../engine/reduce";
import type { HandState, LegalActions, PlayerAction } from "../engine/types";
import { allInLabel, money } from "../coach/words";
import { CHIP_STEP, sizeOptions } from "../grading/sizes";
import { useKeys } from "./useKeys";

interface Props {
  readonly st: HandState;
  readonly onAct: (a: PlayerAction) => void;
}

type Raise = NonNullable<LegalActions["raise"]>;

/** Every amount the slider can land on: the minimum, each small-blind step, and exactly all-in. */
function amounts(raise: Raise): number[] {
  const out = [raise.min];
  for (let x = Math.ceil((raise.min + 1) / CHIP_STEP) * CHIP_STEP; x < raise.max; x += CHIP_STEP) out.push(x);
  if (raise.max !== raise.min) out.push(raise.max);
  return out;
}

/**
 * Fold, check or call, and raise. Raise opens a small sizer: the shared presets and a slider.
 * Keys: F fold, C check or call, R open the sizer then confirm, arrows change the amount, Escape closes it.
 */
export function ActionBar({ st, onAct }: Props) {
  const legal = legalActions(st);
  const bb = st.config.bigBlind;
  const raise = legal?.raise;
  const presets = sizeOptions(st);
  const steps = raise ? amounts(raise) : [];
  const [sizing, setSizing] = useState(false);
  const [index, setIndex] = useState(() => Math.max(0, steps.indexOf(presets[0]?.to ?? -1)));
  const to = steps[Math.min(index, steps.length - 1)] ?? 0;
  const seat = legal?.seat ?? -1;
  const nudge = (by: number) => setIndex((i) => Math.min(steps.length - 1, Math.max(0, i + by)));

  const raiseAction: PlayerAction | null = raise ? { type: raise.kind, seat, to } : null;
  const fold: PlayerAction = { type: "fold", seat };
  const passive: PlayerAction = legal?.canCheck ? { type: "check", seat } : { type: "call", seat };
  const raiseLabel = raise && to === raise.max ? allInLabel(raise.max, bb) : `${raise?.kind === "bet" ? "Bet" : "Raise to"} ${money(to, bb)}`;

  const onKey = useCallback((key: string) => {
    if (!legal) return false;
    if (sizing) {
      if (key === "r" || key === "enter") return raiseAction ? (onAct(raiseAction), true) : false;
      if (key === "escape") return setSizing(false), true;
      if (key === "arrowup" || key === "arrowright") return nudge(bb / CHIP_STEP), true;
      if (key === "arrowdown" || key === "arrowleft") return nudge(-bb / CHIP_STEP), true;
      return false;
    }
    if (key === "f" && !legal.canCheck) return onAct(fold), true;
    if (key === "c") return onAct(passive), true;
    if (key === "r" && raise) return setSizing(true), true;
    return false;
  }, [st, onAct, sizing, to]);
  useKeys(legal ? onKey : null);
  if (!legal) return null;

  if (sizing && raise && raiseAction) {
    return (
      <div className="action-bar" data-testid="action-bar">
        <div className="sizer" data-testid="sizing">
          <div className="presets">
            {presets.map((p) => (
              <button key={p.label} className={`chip${to === p.to ? " chip-on" : ""}`} data-testid={`preset-${p.label}`}
                onClick={() => setIndex(steps.indexOf(p.to))}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="range" aria-label="Amount" min={0} max={steps.length - 1} step={1} value={index}
            onChange={(e) => setIndex(Number(e.target.value))} data-testid="slider" />
        </div>
        <div className="main-actions">
          <button data-testid="sizing-cancel" onClick={() => setSizing(false)}>Back</button>
          <button className="primary" data-testid="act-raise-confirm" onClick={() => onAct(raiseAction)}>{raiseLabel}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="action-bar" data-testid="action-bar">
      <div className="main-actions">
        {!legal.canCheck && <button data-testid="act-fold" onClick={() => onAct(fold)}>Fold</button>}
        {legal.canCheck
          ? <button data-testid="act-check" onClick={() => onAct(passive)}>Check</button>
          : <button data-testid="act-call" onClick={() => onAct(passive)}>Call {money(legal.callAmount, bb)}</button>}
        {raise && <button className="primary" data-testid="act-raise" onClick={() => setSizing(true)}>{raise.kind === "bet" ? "Bet" : "Raise"}…</button>}
      </div>
    </div>
  );
}
