import { type GroupKind, groupOf, type HandGroup } from "../evaluator/handGroups";

const LABEL: Record<GroupKind, string> = {
  pair: "pairs", aceBig: "Aces with a Ten or higher", bothBig: "high cards",
  aceSmall: "Aces with a small card", suited: "lower suited hands", other: "weak unsuited hands",
};
const and = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Whether your hand belongs to one of the main types of a list. */
export const inMainGroup = (cls: string, main: readonly HandGroup[]) =>
  main.some((g) => g.kind === groupOf(cls) && (!g.allSuited || cls[2] === "s"));

const A_TYPE: Record<GroupKind, string> = {
  pair: "a pair", aceBig: "an Ace with a Ten or higher", bothBig: "two cards Ten or higher",
  aceSmall: "an Ace with a small card", suited: "a suited hand", other: "an unsuited low hand",
};
/** The type your hand belongs to: "two cards Ten or higher". */
export const typeOf = (cls: string) => A_TYPE[groupOf(cls)];

/** "pairs and Ace with a small card": the main types in someone's range. */
export const kindsText = (kinds: readonly GroupKind[]) => and(kinds.map((k) => LABEL[k]));
