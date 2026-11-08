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

/** The preset row every poker client has: Min, pot fractions, Pot, All-in. Amounts are raise-to totals. */
function presetsFor(st: HandState): Preset[] {
  const legal = legalActions(st);
  if (st.phase !== "betting" || !legal?.raise) return [];
  const { min, max } = legal.raise;
  const clamp = (to: number) => Math.min(max, Math.max(min, Math.round(to / 50) * 50));
  const afterCall = potSize(st) + legal.callAmount;
  const raw: Preset[] = st.street === "preflop"
    ? [{ label: "Min", to: min }, { label: "Standard", to: aggressiveTo(st) }, { label: "Pot", to: st.currentBet + afterCall }, { label: "All-in", to: max }]
    : [
        { label: "Min", to: min },
        { label: "½ pot", to: st.currentBet + afterCall / 2 },
        { label: "¾ pot", to: st.currentBet + afterCall * 0.75 },
        { label: "Pot", to: st.currentBet + afterCall },
        { label: "All-in", to: max },
      ];
  const out: Preset[] = [];
  for (const p of raw) {
    const to = p.label === "All-in" ? max : clamp(p.to);
    if (!out.some((o) => o.to === to)) out.push({ label: p.label, to });
  }
  return out;
}

/**
 * Fold, check or call, and a raise you size yourself: presets, a slider, or a typed amount.
 * Keys: F fold, C check or call, R bet or raise, arrow keys change the amount by the big blind.
 */
export function ActionBar({ st, onAct }: Props) {
  const legal = st.phase === "betting" ? legalActions(st) : null;
  const presets = presetsFor(st);
  const bb = st.config.bigBlind;
  const raise = legal?.raise;
  const defaultTo = presets.find((p) => p.label === "Standard" || p.label === "½ pot")?.to ?? raise?.min ?? 0;
  const [to, setTo] = useState(defaultTo);
  const [typed, setTyped] = useState<string | null>(null);
  const clamp = (x: number) => (raise ? Math.min(raise.max, Math.max(raise.min, Math.round(x))) : 0);
  const seat = legal?.seat ?? 0;
  const raiseAction = raise ? ({ type: raise.kind, seat, to: clamp(to) } as PlayerAction) : null;

  const onKey = useCallback((key: string) => {
    if (!legal) return false;
    if (key === "f" && !legal.canCheck) return onAct({ type: "fold", seat }), true;
    if (key === "c") return onAct(legal.canCheck ? { type: "check", seat } : { type: "call", seat }), true;
    if (key === "r" && raiseAction) return onAct(raiseAction), true;
    if ((key === "arrowup" || key === "arrowdown") && raise) return setTo((t) => clamp(t + (key === "arrowup" ? bb : -bb))), true;
    return false;
  }, [st, onAct, to]);
  useKeys(legal ? onKey : null);
  if (!legal) return null;

  const commitTyped = () => {
    if (typed === null) return;
    const dollars = Number(typed.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(dollars) && dollars > 0) setTo(clamp(dollars * bb));
    setTyped(null);
  };
  const verb = raise?.kind === "bet" ? "Bet" : "Raise to";
  const allIn = raise !== undefined && clamp(to) === raise.max;
  return (
    <div className="action-bar" data-testid="action-bar">
      {raise && (
        <div className="sizing" data-testid="sizing">
          <div className="presets">
            {presets.map((p) => (
              <button key={p.label} className={`chip${clamp(to) === p.to ? " chip-on" : ""}`} data-testid={`preset-${p.label}`} onClick={() => setTo(p.to)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="amount-row">
            <input type="range" aria-label="Bet amount" min={raise.min} max={raise.max} step={bb / 2} value={clamp(to)}
              onChange={(e) => setTo(Number(e.target.value))} data-testid="slider" />
            <label className="amount-box">
              <span>$</span>
              <input id="bet-amount" inputMode="decimal" aria-label="Bet amount in dollars" data-testid="amount"
                value={typed ?? (Number.isInteger(clamp(to) / bb) ? String(clamp(to) / bb) : (clamp(to) / bb).toFixed(2))} onChange={(e) => setTyped(e.target.value)}
                onBlur={commitTyped} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())} />
            </label>
          </div>
        </div>
      )}
      <div className="main-actions">
        {!legal.canCheck && <button data-testid="act-fold" onClick={() => onAct({ type: "fold", seat })}>Fold <kbd>F</kbd></button>}
        {legal.canCheck
          ? <button data-testid="act-check" onClick={() => onAct({ type: "check", seat })}>Check <kbd>C</kbd></button>
          : <button data-testid="act-call" onClick={() => onAct({ type: "call", seat })}>Call {money(legal.callAmount, bb)} <kbd>C</kbd></button>}
        {raiseAction && (
          <button className="primary" data-testid="act-raise" onClick={() => onAct(raiseAction)}>
            {allIn ? `All-in ${money(raise!.max, bb)}` : `${verb} ${money(clamp(to), bb)}`} <kbd>R</kbd>
          </button>
        )}
      </div>
    </div>
  );
}
