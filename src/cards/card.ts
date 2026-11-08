declare const cardBrand: unique symbol;
export type Card = number & { readonly [cardBrand]: true };

export const RANKS = "23456789TJQKA";
export const SUITS = "cdhs";
/** How a rank is shown to people. "T" is shorthand players learn later, so the screen says "10". */
export const RANK_LABELS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

/** "T3o" becomes "10-3 offsuit", "AKs" becomes "A-K suited", "88" becomes "8-8". */
export function prettyClass(cls: string): string {
  const label = (ch: string) => RANK_LABELS[RANKS.indexOf(ch)] ?? ch;
  const pair = `${label(cls[0] ?? "")}-${label(cls[1] ?? "")}`;
  return cls[2] === "s" ? `${pair} suited` : cls[2] === "o" ? `${pair} offsuit` : pair;
}

export const rankOf = (c: Card): number => c >> 2;
export const suitOf = (c: Card): number => c & 3;

export function makeCard(rank: number, suit: number): Card {
  if (!Number.isInteger(rank) || rank < 0 || rank > 12) throw new Error(`bad rank ${rank}`);
  if (!Number.isInteger(suit) || suit < 0 || suit > 3) throw new Error(`bad suit ${suit}`);
  return ((rank << 2) | suit) as Card;
}

export function parseCard(text: string): Card {
  const rank = RANKS.indexOf(text[0] ?? "");
  const suit = SUITS.indexOf(text[1] ?? "");
  if (text.length !== 2 || rank < 0 || suit < 0) throw new Error(`bad card "${text}"`);
  return makeCard(rank, suit);
}

export function parseCards(text: string): Card[] {
  const compact = text.replace(/\s+/g, "");
  if (compact.length % 2 !== 0) throw new Error(`bad cards "${text}"`);
  const out: Card[] = [];
  for (let i = 0; i < compact.length; i += 2) out.push(parseCard(compact.slice(i, i + 2)));
  return out;
}

export const formatCard = (c: Card): string => `${RANKS[rankOf(c)]}${SUITS[suitOf(c)]}`;
export const formatCards = (cs: readonly Card[]): string => cs.map(formatCard).join(" ");

export const FULL_DECK: readonly Card[] = Array.from({ length: 52 }, (_, i) => i as Card);

/** Deterministic PRNG so a hand replays from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(rng: () => number, deck: readonly Card[] = FULL_DECK): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
