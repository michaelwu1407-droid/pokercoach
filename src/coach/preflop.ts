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
    case "suited": return "suited hands like Nine-Eight";
    case "other": return "most other hands";
  }
}
/** "Any Ace" already covers Aces with a big card, so that type is not named twice. */
const typesToPlay = (main: readonly HandGroup[]) => {
  const anyAce = main.some((g) => g.kind === "aceSmall" && !g.allSuited);
  return main.filter((g) => !(anyAce && g.kind === "aceBig")).map((g) => capital(playPhrase(g)));
};
const noneOf = (_main: readonly HandGroup[]) => "not on this list";

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

/** What happened, then the hands to play as a list: "Against Jun's raise, play:" + ["Any pair", "Ace-Jack or better"]. */
function lead(b: Chart, g: Graded, o: Opponents): { intro: string; list: string[] } {
  const raiser = nameOf(o, g.facing?.by) ?? "the raiser";
  const list = typesToPlay(b.groups);
  switch (b.spot) {
    case "rfi": return { intro: `Nobody has raised. From the ${seatName(b.position)} seat, raise:`, list };
    case "vs-limp": {
      const callers = g.win.against.map((seat) => nameOf(o, seat) ?? "a player");
      return { intro: `${callers.length ? and(callers) : "Players"} only called. From the ${seatName(b.position)} seat, raise:`, list };
    }
    case "vs-open": return { intro: `Against ${raiser}'s raise, play:`, list };
    case "vs-3bet": return { intro: `After ${raiser}'s re-raise, keep playing:`, list };
    case "vs-4bet": return { intro: `After ${raiser} raised again, keep playing:`, list };
  }
}

/** Your hand against the rule, ending in the move. */
function handLine(b: Chart, g: Graded, describe: (a: PlayerAction) => string): string {
  const hand = handWords(b.handClass);
  if (b.oversized) return `Right idea, wrong size. ${capital(describe(g.best))}, not ${describe(g.action)}. Only better hands call a raise that big.`;
  if (b.borderline) return `${hand} is just outside the list. Close call. From a later seat it is a raise.`;
  const fold = b.position === "BB" && b.spot === "vs-limp" ? "Check" : "Fold";
  const play = b.bestMove === "raise" ? RAISE[b.spot] : "call";
  const main = inMainGroup(b.handClass, b.groups);
  if (b.bestMove === "fold") {
    if (!main) return `${hand} is ${noneOf(b.groups)}. ${fold}.`;
    const c = cut(b.row);
    return c ? `${hand} is too weak. Here you need ${c}. ${fold}.` : `${hand} is too weak here. ${fold}.`;
  }
  const chose = aggressive(g.action) ? "raise" : g.action.type === "call" ? "call" : "fold";
  if (chose !== "fold" && chose !== b.bestMove) {
    return b.bestMove === "raise" ? `${hand} is strong enough to ${play}, not just call.` : `${hand} is worth a call here, not a ${RAISE[b.spot]}.`;
  }
  return main ? `${hand} is ${typeOf(b.handClass)}. ${capital(play)}.` : `${hand} is one of the few extras on the list. ${capital(play)}.`;
}

/** The rule for this spot (lead) and your hand against it (summary). */
export function preflopText(g: Graded, o: Opponents, describe: (a: PlayerAction) => string): { lead: string; leadList: string[]; summary: string } {
  if (g.basis.kind !== "chart") return { lead: "", leadList: [], summary: "" };
  const l = lead(g.basis, g, o);
  return { lead: l.intro, leadList: l.list, summary: handLine(g.basis, g, describe) };
}

/** Why the list is that size, in one or two sentences, with its tag. */
export function preflopWhy(g: Graded, o: Opponents): { label: string; text: string } {
  if (g.basis.kind !== "chart") return { label: "", text: "" };
  const b = g.basis;
  const raiser = nameOf(o, g.facing?.by) ?? "the raiser";
  switch (b.spot) {
    case "rfi": {
      const early = b.ladder[0]!, dealer = b.ladder.find((l) => l.position === "BTN")!;
      const many = b.behind <= 2;
      const text = many ? `Only ${b.behind} act after you. A better hand is less likely.` : `${b.behind} players act after you. Any of them may have a better hand.`;
      return { label: many ? "Why so many" : "Why so few", text: `${text} Rule: play about ${early.roughPct}% of hands from the Early seat, up to ${dealer.roughPct}% from the Dealer.` };
    }
    case "vs-limp": return { label: "Why", text: "Players who just call usually have medium hands. Raise the hands that beat them." };
    case "vs-open": return looseRaiser(g)
      ? { label: "Why so few", text: `Most players raise here with only their top ${b.openerShare !== null ? pct(b.openerShare) : "few"} of hands. ${capital(raiser)} raises more. Your hand still trails.` }
      : { label: "Why so few", text: `A raise from the ${b.opener ? seatName(b.opener) : ""} seat usually means a top ${b.openerShare !== null ? pct(b.openerShare) : ""} hand. You need a hand that beats most of those.` };
    case "vs-3bet": return { label: "Why so few", text: "A re-raise usually means a very strong hand." };
    case "vs-4bet": return { label: "Why so few", text: "A third raise means a huge pot. Only the very best hands are worth it." };
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
  const detail = names.length === 0 ? "Against one random hand. Nobody else is in yet."
    : names.length === 1 && g.win.theirs ? `${names[0]} ${b.spot === "vs-limp" ? "calls" : "raises"} here with mostly ${kindsText(g.win.theirs.mostly)}.`
    : "Against the hands each of them usually plays here.";
  return [list, { value: pct(g.win.chance), label, detail }];
}
