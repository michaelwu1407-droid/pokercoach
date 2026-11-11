import { apply, start } from "../engine/reduce";
import type { HandEvent } from "../engine/types";

/** What anyone at the table could count about a player this game: no hidden cards, only actions. */
export interface PlayerSeen {
  readonly hands: number;
  /** Hands where they put money in before the flop by choice (a call or a raise, not a blind). */
  readonly played: number;
  /** Hands where they raised before the flop. */
  readonly raised: number;
}

export type Seen = Readonly<Record<string, PlayerSeen>>;

/** Adds one hand's actions to the counts, for every player but you (seat 0). */
export function recordHand(seen: Seen, events: readonly HandEvent[]): Seen {
  const [first, ...actions] = events;
  if (first?.type !== "start") return seen;
  const ids = first.config.seats.map((s) => s.id);
  const played = new Set<number>(), raised = new Set<number>();
  let st = start(first);
  for (const a of actions) {
    if (a.type === "start" || st.phase !== "betting") break;
    if (st.street === "preflop" && (a.type === "call" || a.type === "raise")) played.add(a.seat);
    if (st.street === "preflop" && a.type === "raise") raised.add(a.seat);
    st = apply(st, a);
  }
  const out: Record<string, PlayerSeen> = { ...seen };
  ids.forEach((id, seat) => {
    if (seat === 0) return;
    const was = out[id] ?? { hands: 0, played: 0, raised: 0 };
    out[id] = { hands: was.hands + 1, played: was.played + (played.has(seat) ? 1 : 0), raised: was.raised + (raised.has(seat) ? 1 : 0) };
  });
  return out;
}
