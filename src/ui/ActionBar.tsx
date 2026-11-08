import { useCallback } from "react";
import { legalActions } from "../engine/reduce";
import { sizeOptions } from "../grading/sizes";
import type { HandState, PlayerAction } from "../engine/types";
import { useKeys } from "./useKeys";
import { money } from "../coach/words";

interface Props {
  readonly st: HandState;
  readonly onAct: (a: PlayerAction) => void;
}

const bbText = (chips: number, bb: number) => money(chips, bb);

interface Option {
  readonly key: string;
  readonly label: string;
  readonly testId: string;
  readonly primary: boolean;
  readonly action: PlayerAction;
}

function optionsFor(st: HandState): Option[] {
  const legal = legalActions(st);
  if (!legal || st.phase !== "betting") return [];
  const { seat, raise, callAmount, canCheck } = legal;
  const bb = st.config.bigBlind;
  const out: Option[] = [];
  if (!canCheck) out.push({ key: "f", label: "Fold", testId: "act-fold", primary: false, action: { type: "fold", seat } });
  out.push(canCheck
    ? { key: "c", label: "Check", testId: "act-check", primary: false, action: { type: "check", seat } }
    : { key: "c", label: `Call ${bbText(callAmount, bb)}`, testId: "act-call", primary: false, action: { type: "call", seat } });
  if (raise) sizeOptions(st).forEach((s, i) => {
    const verb = raise.kind === "bet" ? "Bet" : "Raise to";
    const label = s.label === "All-in" ? `All-in ${bbText(s.to, bb)}` : `${verb} ${bbText(s.to, bb)}${s.label ? ` (${s.label})` : ""}`;
    out.push({ key: i === 0 ? "r" : String(i + 1), label, testId: i === 0 ? "act-raise" : `act-size-${i}`, primary: i === 0, action: { type: raise.kind, seat, to: s.to } });
  });
  return out;
}

/** Three to five big buttons with one-key shortcuts. Sizes are presets, so there is no slider. */
export function ActionBar({ st, onAct }: Props) {
  const options = optionsFor(st);
  const onKey = useCallback((key: string) => {
    const o = options.find((x) => x.key === key);
    if (o) onAct(o.action);
    return o !== undefined;
  }, [st, onAct]);
  useKeys(options.length > 0 ? onKey : null);
  if (options.length === 0) return null;
  return (
    <div className="action-bar" data-testid="action-bar">
      {options.map((o) => (
        <button key={o.testId} className={o.primary ? "primary" : ""} data-testid={o.testId} onClick={() => onAct(o.action)}>
          {o.label} <kbd>{o.key.toUpperCase()}</kbd>
        </button>
      ))}
    </div>
  );
}
