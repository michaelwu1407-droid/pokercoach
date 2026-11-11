import type { CSSProperties } from "react";
import { type Card, formatCard, RANK_LABELS, rankOf, suitOf } from "../cards/card";
import { potSize } from "../engine/reduce";
import type { HandEvent, HandState } from "../engine/types";
import { lastActions, resultLine } from "./actionLabels";
import { positionOf } from "../evaluator/preflopCharts";
import { HERO } from "../session/session";
import { money, seatName } from "../coach/words";

const SUIT_GLYPH = ["♣", "♦", "♥", "♠"] as const;
const bbOf = (st: HandState, chips: number) => money(chips, st.config.bigBlind);

export function CardView({ card, hidden = false, empty = false }: { card?: Card; hidden?: boolean; empty?: boolean }) {
  if (empty) return <span className="card card-empty" aria-hidden="true" />;
  if (hidden || card === undefined) return <span className="card card-back" aria-label="hidden card" />;
  const red = suitOf(card) === 1 || suitOf(card) === 2;
  return (
    <span className={`card${red ? " card-red" : ""}${rankOf(card) === 8 ? " card-ten" : ""}`} data-card={formatCard(card)}>
      {RANK_LABELS[rankOf(card)]}
      {SUIT_GLYPH[suitOf(card)]}
    </span>
  );
}

export function Table({ st, events, onSkip }: { st: HandState; events: readonly HandEvent[]; onSkip: () => void }) {
  const showdown = st.phase === "complete" && st.showdown;
  const n = st.seats.length;
  const labels = lastActions(events);
  const result = resultLine(st);
  return (
    <div className="table" data-testid="table" onClick={onSkip}>
      <div className="felt">
        <div className="board" data-testid="board">
          {[0, 1, 2, 3, 4].map((i) => <CardView key={i} {...(st.board[i] !== undefined ? { card: st.board[i] } : { empty: true })} />)}
        </div>
        <div className="pot" data-testid="pot">Pot {bbOf(st, potSize(st))}</div>
        {result && <div className="result" data-testid="result">{result}</div>}
      </div>
      {st.seats.map((s, i) => {
        const angle = ((i - HERO) / n) * 2 * Math.PI;
        // The CSS places the seat on an oval; the reach of the oval shrinks on narrow screens.
        const style = { "--sx": -Math.sin(angle), "--sy": Math.cos(angle) } as CSSProperties;
        const toAct = st.phase === "betting" && st.toAct === i;
        const show = i === HERO || (showdown && !s.folded);
        const won = st.phase === "complete" ? st.payouts.find((p) => p.seat === i)?.amount ?? 0 : 0;
        const label = labels.get(i);
        const pos = positionOf(st.config, i);
        return (
          <div key={i} title={`${s.id}, ${seatName(pos)} seat`} className={`seat${s.folded ? " seat-folded" : ""}${toAct ? " seat-active" : ""}${won > 0 ? " seat-winner" : ""}`} style={style} data-testid={`seat-${i}`}>
            {pos === "BTN" && <span className="dealer-button" title="Dealer">D</span>}
            <div className="seat-name">
              {s.id}{i === HERO && <span className="seat-pos"> · {seatName(pos)}</span>}
            </div>
            <div className="seat-cards">
              {!s.folded && <CardView card={s.hole[0]} hidden={!show} />}
              {!s.folded && <CardView card={s.hole[1]} hidden={!show} />}
            </div>
            <div className="seat-stack">{bbOf(st, s.stack)}</div>
            {label ? <div className={`seat-action action-${label.kind}`}>{label.text}</div>
              : s.street > 0 && <div className="seat-action action-blind">{st.street === "preflop" && (pos === "SB" || pos === "BB") ? `${seatName(pos)} ` : ""}{bbOf(st, s.street)}</div>}
          </div>
        );
      })}
    </div>
  );
}
