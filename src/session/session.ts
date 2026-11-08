import { FULL_DECK, mulberry32, shuffled } from "../cards/card";
import { type Opponents, randomOpponents, stylesOf } from "../bots/opponents";
import { decide } from "../bots/policy";
import { apply, legalActions, reduce } from "../engine/reduce";
import type { HandEvent, HandState, PlayerAction, SeatIndex } from "../engine/types";
import { grade } from "../grading/grade";
import type { Grade } from "../grading/types";
import { applies, type Concept } from "../learn/concepts";
import { spotView } from "../learn/spot";

export const HERO: SeatIndex = 0;
export const STACK_BB = 100;
export const BIG_BLIND = 100;
/** After this many hands the table changes, so reads have to be made again. */
export const HANDS_PER_TABLE = 25;
const OPPONENT_SEATS = [1, 2, 3, 4, 5];

export interface Hand {
  readonly seed: number;
  readonly opponents: Opponents;
  readonly events: readonly HandEvent[];
}

export const state = (h: Hand): HandState => reduce(h.events);

export const newTable = (seed: number): Opponents => randomOpponents(mulberry32(seed ^ 0x9e3779b9), OPPONENT_SEATS);

/** Each hand rotates the button and resets stacks to 100bb, like a cash table with auto top-up. */
export function newHand(seed: number, handNo: number, opponents: Opponents): Hand {
  const rng = mulberry32(seed);
  const seats = Array.from({ length: 6 }, (_, i) => ({ id: i === HERO ? "You" : opponents[i]!.name, stack: STACK_BB * BIG_BLIND }));
  const events: HandEvent[] = [{ type: "start", config: { seats, smallBlind: BIG_BLIND / 2, bigBlind: BIG_BLIND, button: handNo % 6 }, deck: shuffled(rng, FULL_DECK) }];
  return runBots({ seed, opponents, events });
}

/** Plays bot seats until the hero must act or the hand ends. Bot randomness derives from the seed. */
export function runBots(h: Hand): Hand {
  let st = reduce(h.events);
  const events = [...h.events];
  while (st.phase === "betting" && legalActions(st)!.seat !== HERO) {
    const rng = mulberry32(h.seed * 1000 + events.length);
    const a = decide(st, h.opponents[legalActions(st)!.seat]!.style, rng);
    events.push(a);
    st = apply(st, a);
  }
  return { ...h, events };
}

export function conceptsAt(st: HandState, opponents: Opponents, concepts: readonly Concept[]): Concept[] {
  if (st.phase !== "betting" || legalActions(st)?.seat !== HERO) return [];
  const view = spotView(st, HERO, stylesOf(opponents));
  return concepts.filter((c) => applies(c, view));
}

export interface HeroResult {
  readonly hand: Hand;
  readonly grade: Grade;
  readonly concepts: readonly Concept[];
  /** The hand before the decision, saved so the spot can be drilled again later. */
  readonly before: Hand;
}

/** Your action, then the opponents until it is your turn again or the hand ends. Grading is separate. */
export const advance = (h: Hand, action: PlayerAction): Hand => runBots({ ...h, events: [...h.events, action] });

/** Grades your decision in the hand as it stood. Pure, so it can run in a worker. */
export function gradeDecision(before: Hand, action: PlayerAction): Grade {
  return grade({ events: before.events, state: reduce(before.events), action, styles: stylesOf(before.opponents) });
}

export function heroAct(h: Hand, action: PlayerAction, concepts: readonly Concept[]): HeroResult {
  const g = gradeDecision(h, action);
  const credited = g.graded ? conceptsAt(reduce(h.events), h.opponents, concepts) : [];
  return { hand: advance(h, action), grade: g, concepts: credited, before: h };
}
