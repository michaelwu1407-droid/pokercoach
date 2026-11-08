import type { Position } from "../evaluator/preflopCharts";

/** Every number is a threshold the policy compares a 0..1 strength against. */
export interface Style {
  readonly id: "nit" | "tag" | "lag" | "station";
  readonly name: string;
  /** The leak a learner can exploit. Shown in the UI so exploits are teachable. */
  readonly leak: string;
  /** Which RFI chart this style opens from, per seat. `null` means it limps instead. */
  readonly openAs: Readonly<Record<Position, Position | null>>;
  readonly limpTop: number;
  readonly threeBetTop: number;
  readonly callRaiseTop: number;
  readonly valueBet: number;
  readonly bluff: number;
  readonly semiBluff: number;
  readonly callBase: number;
  readonly raiseValue: number;
  /** How much a big bet scares them off. 1 is a sound player, low values call big bets too often. */
  readonly sizeFear: number;
}

const same = { UTG: "UTG", HJ: "HJ", CO: "CO", BTN: "BTN", SB: "SB", BB: null } as const;

export const STYLES: Readonly<Record<Style["id"], Style>> = {
  nit: {
    id: "nit", name: "Tight player",
    leak: "Folds too often. Bets and raises almost only with strong hands, so their aggression means strength.",
    openAs: { UTG: "UTG", HJ: "UTG", CO: "HJ", BTN: "CO", SB: "HJ", BB: null },
    limpTop: 0, threeBetTop: 0.025, callRaiseTop: 0.08,
    valueBet: 0.85, bluff: 0.02, semiBluff: 0.1, callBase: 0.7, raiseValue: 0.95, sizeFear: 1.2,
  },
  tag: {
    id: "tag", name: "Solid player",
    leak: "Plays a sound game with few obvious weaknesses. Folds a little too often to big bets on the last card.",
    openAs: same,
    limpTop: 0, threeBetTop: 0.05, callRaiseTop: 0.16,
    valueBet: 0.72, bluff: 0.12, semiBluff: 0.45, callBase: 0.55, raiseValue: 0.9, sizeFear: 1,
  },
  lag: {
    id: "lag", name: "Wild player",
    leak: "Bets and raises far too often. Their aggression is frequently a bluff, so call down lighter.",
    openAs: { UTG: "CO", HJ: "BTN", CO: "BTN", BTN: "BTN", SB: "BTN", BB: null },
    limpTop: 0, threeBetTop: 0.14, callRaiseTop: 0.35,
    valueBet: 0.55, bluff: 0.35, semiBluff: 0.75, callBase: 0.42, raiseValue: 0.8, sizeFear: 0.6,
  },
  station: {
    id: "station", name: "Loose caller",
    leak: "Calls far too much and rarely bluffs. Bet your medium hands for value and never bluff them.",
    openAs: { UTG: null, HJ: null, CO: null, BTN: null, SB: null, BB: null },
    limpTop: 0.6, threeBetTop: 0.02, callRaiseTop: 0.55,
    valueBet: 0.8, bluff: 0.02, semiBluff: 0.05, callBase: 0.25, raiseValue: 0.96, sizeFear: 0.3,
  },
};
