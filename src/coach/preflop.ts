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

/** What happened and the rule for it, in one line: "Against Jun's raise, play any pair and Ace-Jack or better." */
function lead(b: Chart, g: Graded, o: Opponents): string {
  const raiser = nameOf(o, g.facing?.by) ?? "the raiser";
  const types = typesToPlay(b.groups);
  switch (b.spot) {
    case "rfi": return `Nobody has raised. From the ${seatName(b.position)} seat (${SEAT_HINT[b.position]}), raise ${types}.`;
    case "vs-limp": {
      const callers = g.win.against.map((seat) => nameOf(o, seat) ?? "a player");
      return `${callers.length ? and(callers) : "Players"} only called. From the ${seatName(b.position)} seat, raise ${types}.`;
    }
    case "vs-open": return `Against ${raiser}'s raise, play ${types}.`;
    case "vs-3bet": return `After ${raiser}'s re-raise, keep playing only ${types}.`;
    case "vs-4bet": return `After ${raiser} raised again, keep playing only ${types}.`;
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

/** The rule for this spot (lead) and your hand against it (summary). */
export function preflopText(g: Graded, o: Opponents, describe: (a: PlayerAction) => string): { lead: string; summary: string } {
  if (g.basis.kind !== "chart") return { lead: "", summary: "" };
  return { lead: lead(g.basis, g, o), summary: handLine(g.basis, g, describe) };
}

/** Why the list is that size, in one or two sentences, with its tag. */
export function preflopWhy(g: Graded, o: Opponents): { label: string; text: string } {
  if (g.basis.kind !== "chart") return { label: "", text: "" };
  const b = g.basis;
  const raiser = nameOf(o, g.facing?.by) ?? "the raiser";
  switch (b.spot) {
    case "rfi": {
      const early = b.ladder[0]!, dealer = b.ladder.find((l) => l.position === "BTN")!;
      const behind = `${b.behind} player${b.behind === 1 ? "" : "s"}`;
      const text = b.behind <= 2 ? `Only ${behind} still act after you, so a better hand behind you is less likely.` : `${capital(behind)} still act after you, and any of them may hold a better hand.`;
      return { label: b.behind <= 2 ? "Why so many" : "Why so few", text: `${text} The later your seat, the more you play: about ${early.roughPct}% of hands from the Early seat, ${dealer.roughPct}% from the Dealer.` };
    }
    case "vs-limp": return { label: "Why", text: "Players who only call usually have medium hands. Raise the hands that beat those and take the pot." };
    case "vs-open": return looseRaiser(g) ? {
      label: "Why so few",
      text: `Most players raise from the ${b.opener ? `${seatName(b.opener)} seat` : "seat"} with only their best ${b.openerShare !== null ? `${pct(b.openerShare)} of hands` : "hands"}. ${raiser} raises more than that, but your hand still trails the hands ${raiser} raises with.`,
    } : {
      label: "Why so few",
      text: `A raise from the ${b.opener ? `${seatName(b.opener)} seat (${SEAT_HINT[b.opener]})` : "seat they sit in"} usually means one of the best ${b.openerShare !== null ? `${pct(b.openerShare)} of hands` : "hands"}, so you need hands often ahead of ${raiser}'s.`,
    };
    case "vs-3bet": return { label: "Why so few", text: "A re-raise usually means a very strong hand." };
    case "vs-4bet": return { label: "Why so few", text: "By the third raise the pot is huge, so only hands well ahead of what they raise with are worth it." };
  }
}

const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** One raiser whose raises are mostly not pairs: a wild player raising far wider than the usual list. */
const looseRaiser = (g: Graded) => g.win.against.length === 1 && g.win.theirs !== null && !g.win.theirs.mostly.includes("pair");

/** The list's size, then your chance against whoever has put chips in. */
export function preflopStats(g: Graded, o: Opponents): { value: string; label: string; detail: string }[] {
  if (g.basis.kind !== "chart") return [];
  const b = g.basis;
  const list = { value: pct(b.continueShare), label: "Hands worth playing here", detail: `${b.listSize} of the ${b.allHands.toLocaleString("en-US")} possible starting hands.` };
  const names = g.win.against.map((s) => nameOf(o, s) ?? "a player");
  const label = names.length === 0 ? "Your chance vs one random hand" : `Your chance vs ${and(names)}`;
  const mostly = names.length === 1 && g.win.theirs
    ? ` ${names[0]}'s ${b.spot === "vs-limp" ? "calls" : "raises"} here are mostly ${kindsText(g.win.theirs.mostly)}.` : "";
  // A wild player's raises are mostly weak hands: say so, or "best 20%" in the why line reads as a contradiction.
  const loose = names.length === 1 && g.win.theirs && !g.win.theirs.mostly.includes("pair") && b.spot !== "vs-limp"
    ? ` ${names[0]} raises far more hands than most players.` : "";
  const detail = names.length === 0 ? "If all five cards are dealt. Nobody else has put chips in yet." : `If all five cards are dealt.${mostly}${loose}`;
  return [list, { value: pct(g.win.chance), label, detail }];
}
