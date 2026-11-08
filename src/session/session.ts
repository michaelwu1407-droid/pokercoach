import { mulberry32, shuffled } from "../cards/card";
import { decide } from "../bots/policy";
import { STYLES, type Style } from "../bots/styles";
import { apply, legalActions, reduce } from "../engine/reduce";
import type { HandEvent, HandState, PlayerAction, SeatIndex } from "../engine/types";
import { grade } from "../grading/grade";
import type { Grade } from "../grading/types";
import { applies, type Concept } from "../learn/concepts";
import { spotView } from "../learn/spot";

export const HERO: SeatIndex = 0;
export const STACK_BB = 100;
export const BIG_BLIND = 100;

/** Seats 1..5 around the hero. Every style appears, so every exploit concept can come up. */
export const LINEUP: Readonly<Record<SeatIndex, Style>> = {
  1: STYLES.tag, 2: STYLES.station, 3: STYLES.nit, 4: STYLES.lag, 5: STYLES.tag,
};

export interface Hand {
  readonly seed: number;
  readonly events: readonly HandEvent[];
  readonly grades: readonly Grade[];
  /** Concept ids credited for each graded decision, same order as `grades`. */
  readonly gradeConcepts: readonly (readonly string[])[];
}

export const state = (h: Hand): HandState => reduce(h.events);

/** Each hand rotates the button and resets stacks to 100bb, like a cash table with auto top-up. */
export function newHand(seed: number, handNo: number): Hand {
  const rng = mulberry32(seed);
  const seats = Array.from({ length: 6 }, (_, i) => ({ id: i === HERO ? "You" : LINEUP[i]!.name, stack: STACK_BB * BIG_BLIND }));
  const events: HandEvent[] = [{ type: "start", config: { seats, smallBlind: BIG_BLIND / 2, bigBlind: BIG_BLIND, button: handNo % 6 }, deck: shuffled(rng) }];
  return runBots({ seed, events, grades: [], gradeConcepts: [] });
}

/** Plays bot seats until the hero must act or the hand ends. Bot randomness derives from the seed. */
export function runBots(h: Hand): Hand {
  let st = reduce(h.events);
  const events = [...h.events];
  while (st.phase === "betting" && legalActions(st)!.seat !== HERO) {
    const rng = mulberry32(h.seed * 1000 + events.length);
    const a = decide(st, LINEUP[legalActions(st)!.seat]!, rng);
    events.push(a);
    st = apply(st, a);
  }
  return { ...h, events };
}

export function conceptsAt(st: HandState, concepts: readonly Concept[]): Concept[] {
  if (st.phase !== "betting" || legalActions(st)?.seat !== HERO) return [];
  const view = spotView(st, HERO, LINEUP);
  return concepts.filter((c) => c.graded && applies(c, view));
}

export interface HeroResult {
  readonly hand: Hand;
  readonly grade: Grade;
  readonly concepts: readonly Concept[];
  /** The events before the decision, saved so the spot can be drilled again later. */
  readonly spotEvents: readonly HandEvent[];
}

export function heroAct(h: Hand, action: PlayerAction, concepts: readonly Concept[]): HeroResult {
  const st = reduce(h.events);
  const g = grade({ events: h.events, state: st, action, styles: LINEUP });
  const credited = g.graded ? conceptsAt(st, concepts) : [];
  const next = runBots({
    ...h,
    events: [...h.events, action],
    grades: [...h.grades, g],
    gradeConcepts: [...h.gradeConcepts, credited.map((c) => c.id)],
  });
  return { hand: next, grade: g, concepts: credited, spotEvents: h.events };
}
