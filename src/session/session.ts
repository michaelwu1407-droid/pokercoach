import { FULL_DECK, mulberry32, shuffled } from "../cards/card";
import { newcomer, type Opponents, randomOpponents, stylesOf } from "../bots/opponents";
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

export const START_STACK = STACK_BB * BIG_BLIND;
export const freshStacks = (): number[] => Array.from({ length: 6 }, () => START_STACK);

/** Each hand rotates the button. Stacks carry over from the last hand; default is everyone at 100bb. */
export function newHand(seed: number, handNo: number, opponents: Opponents, stacks: readonly number[] = freshStacks()): Hand {
  const rng = mulberry32(seed);
  const seats = Array.from({ length: 6 }, (_, i) => ({ id: i === HERO ? "You" : opponents[i]!.name, stack: stacks[i]! }));
  const events: HandEvent[] = [{ type: "start", config: { seats, smallBlind: BIG_BLIND / 2, bigBlind: BIG_BLIND, button: handNo % 6 }, deck: shuffled(rng, FULL_DECK) }];
  return runBots({ seed, opponents, events });
}

/** Everyone's chips once a hand is over, winnings included. */
export function chipsAfter(h: Hand): number[] {
  const st = state(h);
  if (st.phase !== "complete") throw new Error("chipsAfter needs a finished hand");
  return st.seats.map((seat, i) => seat.stack + st.payouts.filter((p) => p.seat === i).reduce((t, p) => t + p.amount, 0));
}

/** The table you sit at: chips carry from hand to hand, and your result adds up. */
export interface Table {
  readonly handNo: number;
  readonly opponents: Opponents;
  /** Everyone's chips at the start of the current hand. */
  readonly stacks: readonly number[];
  /** Your result since you sat down, before the current hand. */
  readonly net: number;
  /** Players who sat down this hand, in place of someone who ran out of chips. */
  readonly arrivals: readonly { readonly name: string; readonly replaced: string }[];
}

/**
 * The table for the next hand. A finished hand pays out; an unfinished one (you left for practice)
 * is dropped, so chips stay where they were. You buy back in when broke. An opponent who goes broke
 * leaves and a new random player takes the seat. Every 25 hands a new table sits down; you keep your chips.
 */
export function nextTable(t: Table, hand: Hand, seed: number): Table {
  const handNo = t.handNo + 1;
  const chips = state(hand).phase === "complete" ? chipsAfter(hand) : [...t.stacks];
  const net = t.net + chips[HERO]! - t.stacks[HERO]!;
  if (handNo % HANDS_PER_TABLE === 0) {
    const stacks = freshStacks().map((c, i) => (i === HERO && chips[HERO]! > 0 ? chips[HERO]! : c));
    return { handNo, opponents: newTable(seed), stacks, net, arrivals: [] };
  }
  let opponents = t.opponents;
  const arrivals: { name: string; replaced: string }[] = [];
  const rng = mulberry32(seed);
  chips.forEach((c, seat) => {
    if (c > 0 || seat === HERO) return;
    const replaced = opponents[seat]!.name;
    opponents = newcomer(opponents, seat, rng);
    arrivals.push({ name: opponents[seat]!.name, replaced });
  });
  return { handNo, opponents, stacks: chips.map((c) => (c > 0 ? c : START_STACK)), net, arrivals };
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
