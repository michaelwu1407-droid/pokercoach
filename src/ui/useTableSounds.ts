import { useEffect, useRef } from "react";
import type { HandEvent, HandState } from "../engine/types";
import { HERO } from "../session/session";
import { play } from "./sound";

/** Plays a sound for what just appeared on the table: chips going in, cards dealt, your win. */
export function useTableSounds(st: HandState, events: readonly HandEvent[]) {
  const prev = useRef({ start: events[0], count: events.length, board: st.board.length, over: st.phase === "complete" });
  useEffect(() => {
    const before = prev.current;
    const over = st.phase === "complete";
    prev.current = { start: events[0], count: events.length, board: st.board.length, over };
    // A new hand starts quietly; only changes within the same hand make a sound.
    if (before.start !== events[0] || events.length <= before.count) return;
    const added = events.slice(before.count);
    if (added.some((e) => e.type === "bet" || e.type === "raise" || e.type === "call")) play("chip");
    if (st.board.length > before.board) play("card");
    if (over && !before.over && st.payouts.some((p) => p.seat === HERO && p.amount > st.seats[HERO]!.total)) play("win");
  }, [st, events]);
}
