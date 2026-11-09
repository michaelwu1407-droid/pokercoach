import { chipsAfter, HERO, type Hand, type Table } from "../session/session";

/** What changed since the last hand, for the coach panel at the start of a hand. */
export function tableNews(t: Table): string | null {
  if (t.ended === "won") return "You won the last game: everyone else ran out of chips. New game: five new players, $100 each.";
  if (t.ended === "lost") return "You ran out of chips, so the game starts again: five new players, $100 each.";
  if (t.left.length === 0) return null;
  const who = t.left.length === 1 ? `${t.left[0]} ran out of chips and left` : `${t.left.join(" and ")} ran out of chips and left`;
  return `${who}. ${t.stacks.length - 1} opponent${t.stacks.length === 2 ? "" : "s"} remain.`;
}

/** How the game stands once a hand is over: still going, you are out, or you won. */
export function gameOutcome(h: Hand): "playing" | "lost" | "won" {
  const chips = chipsAfter(h);
  if (chips[HERO]! <= 0) return "lost";
  return chips.every((c, seat) => seat === HERO || c <= 0) ? "won" : "playing";
}
