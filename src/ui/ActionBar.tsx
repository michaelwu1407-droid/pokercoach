import { useState } from "react";
import { legalActions, potSize } from "../engine/reduce";
import type { HandState, PlayerAction } from "../engine/types";

interface Props {
  readonly st: HandState;
  readonly askReason: boolean;
  readonly onAct: (a: PlayerAction, reason: string | null) => void;
}

export function ActionBar({ st, askReason, onAct }: Props) {
  const legal = legalActions(st);
  // The parent remounts this bar for every new decision, so these start fresh each time.
  const [to, setTo] = useState(() => legal?.raise?.min ?? 0);
  const [reason, setReason] = useState("");
  if (!legal || st.phase !== "betting") return null;
  const { seat, raise } = legal;
  const bb = st.config.bigBlind;
  const send = (a: PlayerAction) => onAct(a, reason.trim() === "" ? null : reason.trim());
  const pot = potSize(st);
  const presets = raise
    ? [
        { label: "½ pot", to: st.currentBet + Math.round((pot + legal.callAmount) / 2) },
        { label: "⅔ pot", to: st.currentBet + Math.round(((pot + legal.callAmount) * 2) / 3) },
        { label: "Pot", to: st.currentBet + pot + legal.callAmount },
        { label: "All-in", to: raise.max },
      ].map((p) => ({ ...p, to: Math.min(raise.max, Math.max(raise.min, p.to)) }))
    : [];
  return (
    <div className="action-bar" data-testid="action-bar">
      {askReason && (
        <input className="reason" data-testid="reason" placeholder="Why? One line, optional. Saying it helps it stick."
          value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} />
      )}
      <div className="action-row">
        {!legal.canCheck && <button data-testid="act-fold" onClick={() => send({ type: "fold", seat })}>Fold</button>}
        {legal.canCheck
          ? <button data-testid="act-check" onClick={() => send({ type: "check", seat })}>Check</button>
          : <button data-testid="act-call" onClick={() => send({ type: "call", seat })}>Call {+(legal.callAmount / bb).toFixed(1)}bb</button>}
        {raise && (
          <button className="primary" data-testid="act-raise" onClick={() => send({ type: raise.kind, seat, to })}>
            {raise.kind === "bet" ? "Bet" : "Raise to"} {+(to / bb).toFixed(1)}bb
          </button>
        )}
      </div>
      {raise && (
        <div className="sizing">
          {presets.map((p) => <button key={p.label} className="chip" onClick={() => setTo(p.to)}>{p.label}</button>)}
          <input type="range" aria-label="bet size" min={raise.min} max={raise.max} step={Math.max(1, Math.round(bb / 10))}
            value={to} onChange={(e) => setTo(Number(e.target.value))} />
        </div>
      )}
    </div>
  );
}
