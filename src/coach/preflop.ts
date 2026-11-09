import type { Opponents } from "../bots/opponents";
import type { PlayerAction } from "../engine/types";
import { NAMES, PLURAL } from "../evaluator/describe";
import type { HandGroup } from "../evaluator/handGroups";
import type { ChartRow, Run } from "../evaluator/responseCharts";
import { aggressive, type Graded } from "../grading/types";
import { handWords, runWords } from "./chartWords";
import { inMainGroup, kindsText, typeOf } from "./handTypes";
import { seatName } from "./words";

type Chart = Extract<Graded["basis"], { kind: "chart" }>;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const and = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** A hand type with its cut-off, as you would say it at the table: "pairs of Sevens or better". */
function playPhrase(g: HandGroup): string {
  const suited = g.allSuited ? " suited" : "";
  switch (g.kind) {
    case "pair": return g.lowRank === 0 ? "any pair" : g.lowRank === 12 ? "a pair of Aces" : `pairs of ${PLURAL[g.lowRank]} or better`;
    case "aceBig": return g.lowRank <= 8 ? `Aces with a Ten or higher${suited}` : g.lowRank === 11 ? `Ace-King${suited}` : `Ace-${NAMES[g.lowRank]}${suited} or better`;
    case "bothBig": return `two cards Ten or higher${g.allSuited ? " of the same suit" : ""}`;
    case "aceSmall": return g.allSuited ? "suited Aces" : "any Ace";
    case "suited": return "good suited hands";
    case "other": return "most other hands";
  }
}
/** "Any Ace" already covers Aces with a big card, so that type is not named twice. */
const typesToPlay = (main: readonly HandGroup[]) => {
  const anyAce = main.some((g) => g.kind === "aceSmall" && !g.allSuited);
  return and(main.filter((g) => !(anyAce && g.kind === "aceBig")).map(playPhrase));
};
const noneOf = (main: readonly HandGroup[]) => (main.length === 1 ? "not one" : main.length === 2 ? "neither" : "none of these");

const RAISE = { "rfi": "raise", "vs-limp": "raise", "vs-open": "re-raise", "vs-3bet": "raise again", "vs-4bet": "raise again" } as const;

/** The weakest hands like yours that still make the list: "Queen-Ten offsuit or better". */
function cut(row: ChartRow): string | null {
  const ranks = [...row.raise, ...row.call].flatMap(([lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).sort((a, b) => a - b);
  if (ranks.length === 0) return null;
  let lo = ranks[ranks.length - 1]!;
  while (ranks.includes(lo - 1)) lo--;
  const run: Run = [lo, ranks[ranks.length - 1]!];
  return runWords(row, run);
}

/** Where each seat is, counted the way you would at a real table. */
const SEAT_HINT = {
  UTG: "first to act after the blinds", HJ: "second to act after the blinds", CO: "just before the Dealer",
  BTN: "last to act after the flop", SB: "the small blind", BB: "the big blind",
} as const;

const nameOf = (o: Opponents, seat: number | null | undefined) => (seat === null || seat === undefined ? undefined : o[seat]?.name);

function situation(b: Chart, g: Graded, o: Opponents): string {
  const raiser = nameOf(o, g.facing?.by) ?? "A player";
  switch (b.spot) {
    case "rfi": return `Nobody has raised yet and you are in the ${seatName(b.position)} seat (${SEAT_HINT[b.position]})`;
    case "vs-limp": {
      const callers = g.win.against.map((seat) => nameOf(o, seat) ?? "a player");
      return `${callers.length ? and(callers) : "Players"} only called the big blind, and you are in the ${seatName(b.position)} seat (${SEAT_HINT[b.position]})`;
    }
    case "vs-open": return `${raiser} raised${b.opener ? ` from the ${seatName(b.opener)} seat` : ""}, and you are in the ${seatName(b.position)} seat (${SEAT_HINT[b.position]})`;
    case "vs-3bet": return `${raiser} re-raised you`;
    case "vs-4bet": return `${raiser} raised your re-raise`;
  }
}

function rule(b: Chart): string {
  const types = typesToPlay(b.groups);
  switch (b.spot) {
    case "rfi": return `From there, raise ${types}`;
    case "vs-limp": return `Raise ${types}`;
    case "vs-open": return `Against a raise, play ${types}`;
    case "vs-3bet": case "vs-4bet": return `Now keep playing only ${types}`;
  }
}

/** Your hand against the rule, ending in the move. */
function handLine(b: Chart, g: Graded, describe: (a: PlayerAction) => string): string {
  const hand = handWords(b.handClass);
  if (b.oversized) return `Right idea, wrong size: ${describe(g.best)}, not ${describe(g.action)}. A raise that big only gets called by hands that beat you.`;
  if (b.borderline) return `${hand} is just outside the list here, so this is close. It becomes a raise from a later seat.`;
  const fold = b.position === "BB" && b.spot === "vs-limp" ? "check" : "fold";
  const play = b.bestMove === "raise" ? RAISE[b.spot] : "call";
  const main = inMainGroup(b.handClass, b.groups);
  if (b.bestMove === "fold") {
    if (!main) return `${hand} is ${noneOf(b.groups)}: ${fold}.`;
    const c = cut(b.row);
    return `${hand} is below the cut here${c ? ` (${c})` : ""}: ${fold}.`;
  }
  const chose = aggressive(g.action) ? "raise" : g.action.type === "call" ? "call" : "fold";
  if (chose !== "fold" && chose !== b.bestMove) {
    return b.bestMove === "raise" ? `${hand} is strong enough to ${play}, not just call.` : `${hand} is worth a call here, but not a ${RAISE[b.spot]}.`;
  }
  return main ? `${hand} is ${typeOf(b.handClass)}: ${play}.` : `${hand} is one of the few extra hands that make the list here: ${play}.`;
}

/** Two short sentences anyone can follow: what happened and the rule, then your hand against it. */
export function preflopSummary(g: Graded, o: Opponents, describe: (a: PlayerAction) => string): string {
  if (g.basis.kind !== "chart") return "";
  return `${situation(g.basis, g, o)}. ${rule(g.basis)}. ${handLine(g.basis, g, describe)}`;
}

/** Why the list is that short, in one or two sentences. */
export function preflopWhy(g: Graded, o: Opponents): string {
  if (g.basis.kind !== "chart") return "";
  const b = g.basis;
  const raiser = nameOf(o, g.facing?.by) ?? "The raiser";
  switch (b.spot) {
    case "rfi": {
      const early = b.ladder[0]!, dealer = b.ladder.find((l) => l.position === "BTN")!;
      const behind = `${b.behind} player${b.behind === 1 ? "" : "s"}`;
      const few = b.behind <= 2 ? `Why so many: only ${behind} still act after you, so a better hand behind you is less likely.` : `Why so few: ${behind} still act after you, and any of them may hold a better hand.`;
      return `${few} The later your seat, the more you can play: about ${early.roughPct}% of hands from the Early seat, ${dealer.roughPct}% from the Dealer.`;
    }
    case "vs-limp": return "Why: players who only call usually have medium hands. Raise the hands that beat those and take the pot.";
    case "vs-open": return `Why so few: a raise from the ${b.opener ? `${seatName(b.opener)} seat (${SEAT_HINT[b.opener]})` : "seat they sit in"} usually means one of the best ${b.openerShare !== null ? `${pct(b.openerShare)} of hands` : "hands"}, so you need a hand that is often ahead of ${raiser}'s. The list depends on both seats, theirs and yours.`;
    case "vs-3bet": return "Why so few: a re-raise usually means a very strong hand.";
    case "vs-4bet": return "Why so few: by the third raise the pot is huge, so only hands that are well ahead of what they raise with are worth it.";
  }
}

/** What the percentage counts, then what the chance to win is measured against. */
export function preflopStats(g: Graded, o: Opponents): { value: string; means: string }[] {
  if (g.basis.kind !== "chart") return [];
  const b = g.basis;
  const hand = handWords(b.handClass);
  const list = { value: pct(b.continueShare), means: `of all starting hands make the list here (${b.listSize} of ${b.allHands.toLocaleString("en-US")}).` };
  const names = g.win.against.map((s) => nameOf(o, s) ?? "a player");
  const against = names.length === 0 ? "one random hand, since nobody else has put chips in yet"
    : names.length === 1 && g.win.theirs ? `the hands ${names[0]} usually ${b.spot === "vs-limp" ? "calls" : "raises"} with here, mostly ${kindsText(g.win.theirs.mostly)}`
    : `${and(names)} at once, each holding the hands they usually play this way`;
  // A wild player's raises are mostly weak hands: say so, or "best 20%" in the why line reads as a contradiction.
  const loose = names.length === 1 && g.win.theirs && !g.win.theirs.mostly.includes("pair") && b.spot !== "vs-limp"
    ? ` ${names[0]} raises with far more hands than most players.` : "";
  return [list, { value: pct(g.win.chance), means: `how often ${hand} wins if all five cards are dealt, against ${against}.${loose}` }];
}
