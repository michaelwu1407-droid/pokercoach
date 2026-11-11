import { useCallback, useEffect, useState } from "react";
import { legalActions } from "../engine/reduce";
import type { PlayerAction } from "../engine/types";
import { type Grade, isMiss } from "../grading/types";
import { HERO, type Hand, state } from "../session/session";
import { gradeLater } from "./grader";
import type { Game } from "./useGame";

interface Spot {
  readonly key: string;
  /** The grade of the best move, so "Show best move" can explain it. Null while it is worked out. */
  readonly best: Grade | null;
  readonly hint: boolean;
  readonly answer: boolean;
  /** The trainer helped with this decision: it showed the answer or warned you. */
  readonly assisted: boolean;
  readonly warn: { readonly action: PlayerAction; readonly grade: Grade } | null;
  readonly checking: boolean;
}

const keyOf = (h: Hand) => `${h.seed}:${h.events.length}`;
const fresh = (key: string): Spot => ({ key, best: null, hint: false, answer: false, assisted: false, warn: null, checking: false });

/**
 * The live trainer for one decision. It works out the best move in the background as soon as it is
 * your turn, but shows it only when asked. When you act it checks your move first, like a chess
 * coach's "think again", and lets you take it back or play it anyway.
 */
export function useTrainer(game: Game, on: boolean, spot: Hand | null) {
  const key = spot ? keyOf(spot) : "";
  const [s, setS] = useState<Spot>(fresh(key));
  const cur = s.key === key ? s : fresh(key);
  const patch = useCallback((p: Partial<Spot>) => setS((x) => ({ ...(x.key === key ? x : fresh(key)), ...p })), [key]);

  useEffect(() => {
    if (!on || !spot || state(spot).phase !== "betting") return;
    let live = true;
    const legal = legalActions(state(spot));
    if (!legal || legal.seat !== HERO) return;
    const probe: PlayerAction = legal.canCheck ? { type: "check", seat: HERO } : { type: "fold", seat: HERO };
    void gradeLater(spot, probe).then((g) => (g.graded ? gradeLater(spot, g.best) : g)).then((best) => {
      if (live) patch({ best });
    });
    return () => { live = false; };
  }, [on, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = useCallback((action: PlayerAction) => {
    if (!on || !spot) return game.act(action);
    patch({ checking: true });
    void gradeLater(spot, action).then((g) => {
      if (g.graded && isMiss(g.verdict) && !cur.warn) patch({ checking: false, warn: { action, grade: g } });
      else { patch({ checking: false }); game.act(action, { grade: g, assisted: cur.assisted }); }
    });
  }, [on, spot, game, cur.assisted, cur.warn, patch]);

  return {
    on,
    best: cur.best,
    hint: cur.hint,
    answer: cur.answer,
    warn: cur.warn,
    checking: cur.checking,
    act,
    showHint: () => patch({ hint: true }),
    showAnswer: () => patch({ answer: true, hint: true, assisted: true }),
    takeBack: () => patch({ warn: null, assisted: true }),
    playAnyway: () => {
      if (!cur.warn) return;
      const { action, grade } = cur.warn;
      patch({ warn: null });
      game.act(action, { grade, assisted: true });
    },
  };
}

export type Trainer = ReturnType<typeof useTrainer>;
