import { RANKS } from "../cards/card";
import { type HandClass, rangeCombos } from "./ranges";

/**
 * Starting hands sorted into the few types a player can spot at a glance. A chart is then
 * "78 pairs, 52 Ace with a Ten or higher, ..." instead of 174 hands to memorise.
 */
export type GroupKind = "pair" | "aceBig" | "bothBig" | "aceSmall" | "suited" | "other";
export const GROUP_ORDER: readonly GroupKind[] = ["pair", "aceBig", "bothBig", "aceSmall", "suited", "other"];
const TEN = RANKS.indexOf("T");
const ACE = RANKS.indexOf("A");

export function groupOf(cls: HandClass): GroupKind {
  const [a, b] = [RANKS.indexOf(cls[0] ?? ""), RANKS.indexOf(cls[1] ?? "")];
  if (a === b) return "pair";
  if (a === ACE) return b >= TEN ? "aceBig" : "aceSmall";
  if (b >= TEN) return "bothBig";
  return cls[2] === "s" ? "suited" : "other";
}

export interface HandGroup {
  readonly kind: GroupKind;
  /** Hands in this group, counting every suit combination. */
  readonly combos: number;
  /** Every hand in the group is suited. */
  readonly allSuited: boolean;
  /** The lowest second card in the group (the pair's rank for pairs): "Ace-Jack or better" when it is a Jack. */
  readonly lowRank: number;
}

export function groupsOf(set: Iterable<HandClass>): HandGroup[] {
  const classes = [...set];
  return GROUP_ORDER.flatMap((kind) => {
    const inKind = classes.filter((c) => groupOf(c) === kind);
    if (inKind.length === 0) return [];
    const lowRank = Math.min(...inKind.map((c) => RANKS.indexOf(c[1] ?? "")));
    return [{ kind, combos: rangeCombos(inKind).length, allSuited: kind !== "pair" && inKind.every((c) => c[2] === "s"), lowRank }];
  });
}

/** A type is part of the quick check when it is always strong (pairs, Ace with a big card) or common in the list. */
const MAIN_SHARE = 0.15;
const ALWAYS: readonly GroupKind[] = ["pair", "aceBig"];

/** The types to check for at the table, and how many listed hands fall outside them. */
export function summarise(set: Iterable<HandClass>): { readonly main: readonly HandGroup[]; readonly others: number } {
  const all = groupsOf(set);
  const size = all.reduce((t, g) => t + g.combos, 0);
  const main = all.filter((g) => ALWAYS.includes(g.kind) || g.combos >= MAIN_SHARE * size);
  return { main, others: size - main.reduce((t, g) => t + g.combos, 0) };
}
