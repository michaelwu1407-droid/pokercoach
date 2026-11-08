import type { SeatIndex } from "../engine/types";
import { STYLES, type Style } from "./styles";

export interface Opponent {
  readonly name: string;
  /** Hidden from the learner at the table. Feedback reveals it, so reads are learned, not given. */
  readonly style: Style;
}

export type Opponents = Readonly<Record<SeatIndex, Opponent>>;

const NAMES = ["Ash", "Bo", "Cleo", "Dev", "Eli", "Fern", "Gus", "Hana", "Ivo", "Jun", "Kit", "Lou", "Mae", "Nico", "Oli", "Pia"];
const STYLE_IDS = Object.keys(STYLES) as Style["id"][];
const TUNABLE = ["limpTop", "threeBetTop", "callRaiseTop", "valueBet", "bluff", "semiBluff", "callBase", "raiseValue", "sizeFear"] as const;

/** Each player keeps their style's character but gets their own thresholds, within 15%. */
function individual(style: Style, rng: () => number): Style {
  const out: Record<string, unknown> = { ...style };
  for (const k of TUNABLE) out[k] = Math.max(0, style[k] * (0.85 + 0.3 * rng()));
  return out as unknown as Style;
}

/** Five opponents with random styles. Repeats are allowed, so a table can be all maniacs. */
export function randomOpponents(rng: () => number, seats: readonly SeatIndex[]): Opponents {
  const names = [...NAMES].sort(() => rng() - 0.5);
  return Object.fromEntries(seats.map((seat, i) => {
    const style = STYLES[STYLE_IDS[Math.floor(rng() * STYLE_IDS.length)]!];
    return [seat, { name: names[i]!, style: individual(style, rng) }];
  }));
}

export const stylesOf = (o: Opponents): Readonly<Record<SeatIndex, Style>> =>
  Object.fromEntries(Object.entries(o).map(([seat, op]) => [Number(seat), op.style]));
