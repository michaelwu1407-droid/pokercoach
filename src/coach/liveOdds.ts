import { type Card, RANK_LABELS, rankOf, RANKS, suitOf } from "../cards/card";
import { apply, start } from "../engine/reduce";
import type { HandEvent, HandState, SeatIndex } from "../engine/types";
import { describeHand, NAMES, PLURAL } from "../evaluator/describe";
import { categoryOf, CATEGORIES, evaluate } from "../evaluator/handRank";
import { equityVsRandom } from "../evaluator/randomEquity";
import { classOf } from "../evaluator/ranges";
import { drawOf } from "../grading/outs";

/** One moment your odds moved, with the plain reason. */
export interface OddsStep {
  readonly chance: number;
  /** Change since the step before, in points of chance; null for the first. */
  readonly delta: number | null;
  readonly reason: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const SUIT = ["♣", "♦", "♥", "♠"] as const;
const cardText = (c: Card) => `${RANK_LABELS[rankOf(c)]}${SUIT[suitOf(c)]}`;
const STREET = { flop: "flop", turn: "turn", river: "river" } as const;
const cache = new Map<string, number>();

function odds(hole: readonly [Card, Card], board: readonly Card[], opponents: number): number {
  const key = `${hole.join()}|${board.join()}|${opponents}`;
  if (!cache.has(key)) cache.set(key, equityVsRandom(hole, board, opponents));
  return cache.get(key)!;
}

const opponentsIn = (st: HandState, hero: SeatIndex) => st.seats.filter((s, i) => i !== hero && !s.folded).length;

/** Why a starting hand is strong or weak, in one short phrase. */
function startNote(hole: readonly [Card, Card]): string {
  const cls = classOf(hole);
  const [a, b] = [RANKS.indexOf(cls[0]!), RANKS.indexOf(cls[1]!)];
  const ten = RANKS.indexOf("T");
  if (a === b) return "A pair before the flop is a strong start";
  if (a === 12) return "An Ace can make the best pair";
  if (b >= ten) return "Two high cards make strong pairs";
  if (cls[2] === "s" && a - b <= 2) return "Same suit and close together: it can make a flush or a straight";
  if (a >= ten) return "One high card: it usually needs to pair to win";
  if (cls[2] === "s") return "Same suit gives a small chance of a flush";
  return "Two low cards rarely win";
}

/** The cards still to come that complete your draw: "any Six or Two", "any ♠". */
function outsText(hole: readonly [Card, Card], board: readonly Card[]): string {
  const seen = new Set<Card>([...hole, ...board]);
  const now = CATEGORIES.indexOf(categoryOf(evaluate([...hole, ...board])));
  const straight = CATEGORIES.indexOf("straight");
  const ranks = new Set<number>(), suits = new Set<number>();
  for (let c = 0; c < 52; c++) {
    const card = c as Card;
    if (seen.has(card)) continue;
    const cat = categoryOf(evaluate([...hole, ...board, card]));
    if (CATEGORIES.indexOf(cat) <= Math.max(now, straight - 1)) continue;
    if (cat === "flush") suits.add(suitOf(card)); else if (cat === "straight") ranks.add(rankOf(card));
  }
  const parts = [...[...ranks].sort((x, y) => y - x).map((r) => `${r === 8 ? "Ten" : NAMES[r]}`), ...[...suits].map((u) => SUIT[u]!)];
  return parts.length === 0 ? "" : ` (any ${parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`})`;
}

/** The danger a new card brings for others, named. */
function danger(hole: readonly [Card, Card], before: readonly Card[], after: readonly Card[]): string {
  const suitCount = (b: readonly Card[]) => Math.max(...[0, 1, 2, 3].map((u) => b.filter((c) => suitOf(c) === u).length));
  const mine = categoryOf(evaluate([...hole, ...after]));
  const flushSuit = [0, 1, 2, 3].find((u) => after.filter((c) => suitOf(c) === u).length >= 3);
  if (flushSuit !== undefined && suitCount(before) < 3 && mine !== "flush") return `puts three ${SUIT[flushSuit]} on the board: anyone holding two ${SUIT[flushSuit]} has a flush`;
  const pairRank = mine === "pair" ? (rankOf(hole[0]) === rankOf(hole[1]) ? rankOf(hole[0]) : hole.map(rankOf).find((r) => after.some((c) => rankOf(c) === r))) : undefined;
  const top = Math.max(...after.slice(before.length).map(rankOf));
  if (pairRank !== undefined && top > pairRank) return `is higher than your pair: anyone holding a ${NAMES[top]} now beats you`;
  const ranks = [...new Set(after.map(rankOf))].sort((x, y) => x - y);
  if (ranks.some((r, i) => i >= 2 && r - ranks[i - 2]! <= 4)) return after.length === 3 ? "has cards close in rank, so others can make or draw to a straight" : "puts cards close in rank on the board, so others can make or draw to a straight";
  if (after.length === 3 && suitCount(after) === 2) return "has two cards of one suit, so others may be drawing to a flush";
  return "did not help you, and it gives the others new ways to win";
}

const lowerFirst = (t: string) => t[0]!.toLowerCase() + t.slice(1);

/** What the board alone makes, as a category index: a paired board gives everyone that pair. */
function boardCategory(board: readonly Card[]): number {
  if (board.length >= 5) return CATEGORIES.indexOf(categoryOf(evaluate(board)));
  const counts = [...new Map(board.map((c) => [rankOf(c), board.filter((d) => rankOf(d) === rankOf(c)).length])).values()].sort((x, y) => y - x);
  const kind = counts[0] === 4 ? "quads" : counts[0] === 3 ? "trips" : counts[0] === 2 && counts[1] === 2 ? "two pair" : counts[0] === 2 ? "pair" : "high card";
  return CATEGORIES.indexOf(kind);
}

function streetReason(hole: readonly [Card, Card], before: readonly Card[], after: readonly Card[], street: keyof typeof STREET, delta: number): string {
  const shown = after.slice(before.length).map(cardText).join(" ");
  const cat = (b: readonly Card[]) => CATEGORIES.indexOf(categoryOf(evaluate([...hole, ...b])));
  const startCat = rankOf(hole[0]) === rankOf(hole[1]) ? CATEGORIES.indexOf("pair") : 0;
  const drawBefore = before.length >= 3 ? drawOf(hole, before) : null;
  const drawAfter = after.length < 5 ? drawOf(hole, after) : null;
  const head = `The ${STREET[street]} (${shown})`;
  const river = street === "river";
  const newRank = rankOf(after[after.length - 1]!);
  // A card that pairs the board helps everyone, unless your own card matches it.
  const pairedRank = after.map(rankOf).find((r, i, all) => all.indexOf(r) !== i);
  if (before.length < 3 && pairedRank !== undefined && !hole.some((c) => rankOf(c) === pairedRank) && delta <= 0)
    return `${head} has a pair of ${PLURAL[pairedRank]}: anyone holding a ${NAMES[pairedRank]} has three of a kind.`;
  if (before.length >= 3 && boardCategory(after) > boardCategory(before) && !hole.some((c) => rankOf(c) === newRank))
    return delta > 0 ? `${head} paired the board with a card few players hold: it changes little.` : `${head} paired the board, which helps anyone holding a ${NAMES[newRank]}.`;
  // Only an improvement your own cards take part in counts: a pair on the board belongs to everyone.
  const improved = cat(after) > (before.length >= 3 ? cat(before) : startCat) && cat(after) > boardCategory(after);
  if (improved) return `${head} gave you ${lowerFirst(describeHand(hole, after)).replace(/^pair/, "a pair")}.`;
  if (drawAfter && (!drawBefore || drawAfter.outs > drawBefore.outs)) {
    const outs = outsText(hole, after);
    return cat(after) === 0 ? `${head}: no pair yet, but ${drawAfter.outs} cards make you a ${drawAfter.name.replace(/ draw$/, "")}${outs}.` : `${head} added a ${drawAfter.name}: ${drawAfter.outs} cards complete it${outs}.`;
  }
  if (drawBefore && river) return delta >= -0.02 && cat(after) > 0 ? `${head}: your ${drawBefore.name} missed, but your ${lowerFirst(describeHand(hole, after))} still holds up.` : `${head}: your ${drawBefore.name} missed.`;
  if (delta < -0.02) return `${head} ${danger(hole, before, after)}.`;
  if (delta > 0.02) return `${head} is a safe card: it helps nobody, so your hand holds up more often${river ? ", and no cards are left to come" : ""}.`;
  return `${head} changed little for you.`;
}

/** Every change in your odds this hand, from the deal to now. Stops once you fold. */
export function oddsTimeline(events: readonly HandEvent[], hero: SeatIndex): OddsStep[] {
  const [first, ...actions] = events;
  if (first?.type !== "start") return [];
  let st = start(first);
  const hole = st.seats[hero]!.hole;
  const names = first.config.seats.map((s) => s.id);
  const n0 = opponentsIn(st, hero);
  const c0 = odds(hole, st.board, n0);
  const average = 1 / (n0 + 1);
  const ratio = c0 / average;
  const versus = ratio > 1.4 ? "much better" : ratio > 1.1 ? "a bit better" : ratio < 0.7 ? "much worse" : ratio < 0.9 ? "a bit worse" : "about the same";
  const steps: OddsStep[] = [{
    chance: c0, delta: null,
    reason: `${pct(average)} is a fair share against ${n0} other player${n0 === 1 ? "" : "s"}; ${describeHand(hole, []).replace("Pocket", "pocket")} at ${pct(c0)} is ${versus}. ${startNote(hole)}.`,
  }];
  for (const a of actions) {
    if (a.type === "start") break;
    const before = st;
    st = apply(st, a);
    if (st.seats[hero]!.folded) break;
    const prev = steps[steps.length - 1]!.chance;
    if (a.type === "fold" && a.seat !== hero) {
      const c = odds(hole, before.board, opponentsIn(st, hero));
      steps.push({ chance: c, delta: c - prev, reason: opponentsIn(st, hero) === 0 ? `${names[a.seat]} folded: everyone else is out, so you win the pot.`
        : opponentsIn(st, hero) <= 2 ? `${names[a.seat]} folded: one fewer hand to beat. With few players left, each fold counts for more.` : `${names[a.seat]} folded: one fewer hand to beat.` });
    }
    if (st.board.length > before.board.length && st.phase === "betting") {
      const p = steps[steps.length - 1]!.chance;
      const c = odds(hole, st.board, opponentsIn(st, hero));
      const street = st.street === "preflop" ? "flop" : st.street;
      steps.push({ chance: c, delta: c - p, reason: streetReason(hole, before.board, st.board, street, c - p) });
    }
  }
  return steps;
}
