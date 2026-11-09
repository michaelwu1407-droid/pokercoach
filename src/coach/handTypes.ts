import { RANKS } from "../cards/card";
import { type GroupKind, groupOf, type HandGroup } from "../evaluator/handGroups";

const LABEL: Record<GroupKind, string> = {
  pair: "pairs", aceBig: "Ace with a Ten or higher", bothBig: "two cards Ten or higher",
  aceSmall: "Ace with a small card", suited: "other suited hands", other: "other unsuited hands",
};
const ASK: Record<GroupKind, string> = {
  pair: "a pair", aceBig: "an Ace with a Ten or higher", bothBig: "two cards Ten or higher",
  aceSmall: "any Ace", suited: "suited", other: "anything else",
};
const list = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

/** "78 pairs, 52 Ace with a Ten or higher, 28 two cards Ten or higher and 16 others". */
export function breakdown(main: readonly HandGroup[], rest: number): string {
  const parts = main.map((g) => `${g.combos} ${LABEL[g.kind]}`);
  if (rest > 0) parts.push(`${rest} others`);
  return parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The question to ask yourself at the table: "Is it a pair, an Ace with a Ten or higher, or two cards Ten or higher?" */
export function liveCheck(main: readonly HandGroup[]): string {
  return `is it ${list(main.map((g) => (g.allSuited && g.kind !== "suited" ? `${ASK[g.kind]} of the same suit` : ASK[g.kind])))}?`;
}

/** What a player sees in two cards: "no Ace, no card Ten or higher, different suits". */
export function features(cls: string): string {
  const [a, b] = [RANKS.indexOf(cls[0] ?? ""), RANKS.indexOf(cls[1] ?? "")];
  if (a === b) return "a pair";
  const ten = RANKS.indexOf("T");
  const big = (a >= ten ? 1 : 0) + (b >= ten ? 1 : 0);
  return [
    a === RANKS.indexOf("A") ? "an Ace" : "no Ace",
    big === 2 ? "both cards Ten or higher" : big === 1 ? "one card Ten or higher" : "no card Ten or higher",
    cls[2] === "s" ? "same suit" : "different suits",
  ].join(", ");
}

/** Whether your hand belongs to one of the types in the live check. */
export const inMainGroup = (cls: string, main: readonly HandGroup[]) =>
  main.some((g) => g.kind === groupOf(cls) && (!g.allSuited || cls[2] === "s"));

/** The type your hand belongs to, as asked in the live check: "two cards Ten or higher". */
const A_TYPE: Record<GroupKind, string> = {
  pair: "a pair", aceBig: "an Ace with a Ten or higher", bothBig: "two cards Ten or higher",
  aceSmall: "an Ace with a small card", suited: "a suited hand", other: "an unsuited low hand",
};
export const typeOf = (cls: string) => A_TYPE[groupOf(cls)];

/** "pairs and Ace with a small card": the main types in someone's range. */
export const kindsText = (kinds: readonly GroupKind[]) => list(kinds.map((k) => LABEL[k])).replace(/ or ([^,]+)$/, " and $1");
