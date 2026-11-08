import { legalActions } from "../engine/reduce";
import { sizeOptions } from "../grading/sizes";
import type { HandState, PlayerAction } from "../engine/types";

interface Props {
  readonly st: HandState;
  readonly onAct: (a: PlayerAction) => void;
}

const bbText = (chips: number, bb: number) => `${+(chips / bb).toFixed(1)}bb`;

/** Three to five big buttons. Sizes are presets, so there is no slider to fiddle with. */
export function ActionBar({ st, onAct }: Props) {
  const legal = legalActions(st);
  if (!legal || st.phase !== "betting") return null;
  const { seat, raise, callAmount, canCheck } = legal;
  const bb = st.config.bigBlind;
  const sizes = sizeOptions(st);
  return (
    <div className="action-bar" data-testid="action-bar">
      {!canCheck && <button data-testid="act-fold" onClick={() => onAct({ type: "fold", seat })}>Fold</button>}
      {canCheck
        ? <button data-testid="act-check" onClick={() => onAct({ type: "check", seat })}>Check</button>
        : <button data-testid="act-call" onClick={() => onAct({ type: "call", seat })}>Call {bbText(callAmount, bb)}</button>}
      {raise && sizes.map((s, i) => (
        <button key={s.label} className={i === 0 ? "primary" : ""} data-testid={i === 0 ? "act-raise" : `act-size-${i}`}
          onClick={() => onAct({ type: raise.kind, seat, to: s.to })}>
          {s.label} {bbText(s.to, bb)}
        </button>
      ))}
    </div>
  );
}
