import type { CSSProperties } from "react";
import { type Card, formatCard, RANK_LABELS, rankOf, suitOf } from "../cards/card";
import type { HandEvent, HandState } from "../engine/types";
import "./table.css";
import { HERO } from "../session/session";
import { type SeatView, tableView } from "./tableView";

const SUIT_GLYPH = ["♣", "♦", "♥", "♠"] as const;

export function CardView({ card, hidden = false, dim = false }: { card: Card | null; hidden?: boolean; dim?: boolean }) {
  if (card === null) return <span className="card card-empty" aria-hidden="true" />;
  if (hidden) return <span className="card card-back" aria-label="hidden card" />;
  const red = suitOf(card) === 1 || suitOf(card) === 2;
  return (
    <span className={`card${red ? " card-red" : ""}${rankOf(card) === 8 ? " card-ten" : ""}${dim ? " card-dim" : ""}`} data-card={formatCard(card)}>
      <span className="card-rank">{RANK_LABELS[rankOf(card)]}</span>
      <span className="card-suit">{SUIT_GLYPH[suitOf(card)]}</span>
    </span>
  );
}

/** Where a seat sits on the oval. The CSS turns these into seat and chip positions. */
function place(i: number, n: number): CSSProperties {
  const angle = ((i - HERO) / n) * 2 * Math.PI;
  const sy = Math.cos(angle);
  // How far a seat's chips move toward the middle vertically. Seats above the middle push theirs well
  // below the name; seats beside it keep theirs level with their cards, clear of the board.
  const cy = sy < 0 ? -(sy * sy) : sy ** 3;
  // --sd lets narrow screens drop the lower seats further, below the board.
  return { "--sx": -Math.sin(angle), "--sy": sy, "--cy": cy, "--sd": Math.max(sy, 0) } as CSSProperties;
}

function Seat({ v, heroWin }: { v: SeatView; heroWin: string | null }) {
  const cls = ["seat", v.isHero && "seat-hero", v.folded && "seat-folded", v.toAct && "seat-active", v.winner && "seat-winner"];
  return (
    <div className={cls.filter(Boolean).join(" ")} title={`${v.name}, ${v.seat} seat`} data-testid={`seat-${v.index}`}>
      <div className="seat-cards">
        {v.cards.map((c, k) => <CardView key={k} card={c.card} hidden={c.hidden} dim={c.dim} />)}
        {v.tag && (
          <span className={`hand-tag tag-${v.tag.tone}`} data-testid={v.isHero ? "you-have" : `hand-tag-${v.index}`}>{v.tag.text}</span>
        )}
      </div>
      <div className="seat-plate">
        {v.isDealer && <span className="dealer-button" title="Dealer">D</span>}
        <div className="seat-name">{v.name}{v.isHero && <span className="seat-pos"> · {v.seat}</span>}</div>
        <div className="seat-stack">{v.stack}</div>
      </div>
      {v.bubble && (
        <div className={`bubble bubble-${v.bubble.kind}${v.bubble.latest ? " bubble-latest" : ""}`} data-testid={`bubble-${v.index}`}>{v.bubble.text}</div>
      )}
      {v.isHero && heroWin && <div className="win-float" aria-hidden="true">{heroWin}</div>}
    </div>
  );
}

export function Table({ st, events, onSkip }: { st: HandState; events: readonly HandEvent[]; onSkip: () => void }) {
  const view = tableView(st, events);
  const n = view.seats.length;
  return (
    <div className="table" data-testid="table" onClick={onSkip}>
      <div className="felt">
        <div className="pot" data-testid="pot">
          <span className="pot-label">Pot</span> <span key={view.pot} className="pot-amount">{view.pot}</span>
        </div>
        <div className="board" data-testid="board">
          {view.board.map((b, k) => <CardView key={k} card={b.card} dim={b.dim} />)}
        </div>
        {view.result && <div className="result" data-testid="result">{view.result}</div>}
      </div>
      {view.seats.map((v) => v.bet && (
        <div key={`${v.index}:${v.bet}`} className={`bet-chip${v.isHero ? " bet-hero" : ""}`} style={place(v.index, n)} data-testid={`bet-${v.index}`}>
          <span className="chip-dot" aria-hidden="true" />{v.bet}
        </div>
      ))}
      {view.seats.map((v) => (
        <div key={v.index} className={`seat-spot${v.isHero ? " spot-hero" : ""}`} style={place(v.index, n)}>
          <Seat v={v} heroWin={view.heroWin} />
        </div>
      ))}
    </div>
  );
}
