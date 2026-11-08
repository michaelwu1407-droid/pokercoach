import { type Card, formatCard, rankOf, suitOf } from "../cards/card";
import { potSize } from "../engine/reduce";
import type { HandState } from "../engine/types";
import { positionOf } from "../evaluator/preflopCharts";
import { HERO } from "../session/session";

const SUIT_GLYPH = ["♣", "♦", "♥", "♠"] as const;
const bbOf = (st: HandState, chips: number) => `${+(chips / st.config.bigBlind).toFixed(1)}bb`;

export function CardView({ card, hidden = false }: { card?: Card; hidden?: boolean }) {
  if (hidden || card === undefined) return <span className="card card-back" aria-label="hidden card" />;
  const red = suitOf(card) === 1 || suitOf(card) === 2;
  return (
    <span className={`card${red ? " card-red" : ""}`} data-card={formatCard(card)}>
      {"23456789TJQKA"[rankOf(card)]}
      {SUIT_GLYPH[suitOf(card)]}
    </span>
  );
}

export function Table({ st }: { st: HandState }) {
  const showdown = st.phase === "complete" && st.showdown;
  const n = st.seats.length;
  return (
    <div className="table" data-testid="table">
      <div className="felt">
        <div className="board" data-testid="board">
          {[0, 1, 2, 3, 4].map((i) => <CardView key={i} {...(st.board[i] !== undefined ? { card: st.board[i] } : { hidden: true })} />)}
        </div>
        <div className="pot" data-testid="pot">Pot {bbOf(st, potSize(st))}</div>
      </div>
      {st.seats.map((s, i) => {
        const angle = ((i - HERO) / n) * 2 * Math.PI;
        const style = { left: `${50 - 42 * Math.sin(angle)}%`, top: `${50 + 40 * Math.cos(angle)}%` };
        const toAct = st.phase === "betting" && st.toAct === i;
        const show = i === HERO || (showdown && !s.folded);
        const won = st.phase === "complete" ? st.payouts.find((p) => p.seat === i)?.amount ?? 0 : 0;
        return (
          <div key={i} className={`seat${s.folded ? " seat-folded" : ""}${toAct ? " seat-active" : ""}`} style={style} data-testid={`seat-${i}`}>
            <div className="seat-name">
              {s.id} <span className="seat-pos">{positionOf(st.config, i)}</span>
            </div>
            <div className="seat-cards">
              <CardView card={s.hole[0]} hidden={!show} />
              <CardView card={s.hole[1]} hidden={!show} />
            </div>
            <div className="seat-stack">{bbOf(st, s.stack)}</div>
            {s.street > 0 && <div className="seat-bet">{bbOf(st, s.street)}</div>}
            {won > 0 && <div className="seat-won">Wins {bbOf(st, won)}</div>}
          </div>
        );
      })}
    </div>
  );
}
