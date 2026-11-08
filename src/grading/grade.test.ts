import { describe, expect, it } from "vitest";
import { type Card, FULL_DECK, parseCards } from "../cards/card";
import { STYLES } from "../bots/styles";
import { apply, reduce } from "../engine/reduce";
import type { HandEvent, PlayerAction, Start } from "../engine/types";
import { grade } from "./grade";

function deck(front: string, tail?: Card[]): Card[] {
  const fixed = parseCards(front);
  const rest = FULL_DECK.filter((c) => !fixed.includes(c));
  return [...fixed, ...(tail ?? rest)];
}

function hand(stacks: number[], button: number, d: Card[], actions: PlayerAction[]): HandEvent[] {
  const s: Start = { type: "start", config: { seats: stacks.map((stack, i) => ({ id: `p${i}`, stack })), smallBlind: 50, bigBlind: 100, button }, deck: d };
  return [s, ...actions];
}

const at = (events: HandEvent[], action: PlayerAction, styles = { 1: STYLES.tag, 0: STYLES.tag }) =>
  grade({ events, state: reduce(events), action, styles });

describe("preflop chart grading", () => {
  // Six seats, button 0, so seat 3 is UTG and acts first. Seat 3 is dealt the 3rd and 9th cards.
  const six = (holes: string) => hand([10000, 10000, 10000, 10000, 10000, 10000], 0, deck(holes), []);

  it("rewards opening a chart hand and folding a non-chart hand from UTG", () => {
    const aa = six("2c3cAs4c5c6c 2d3dAh4d5d6d");
    expect(at(aa, { type: "raise", seat: 3, to: 250 })).toMatchObject({ graded: true, verdict: "good" });
    const trash = six("2c3c7s4c5c6c 2d3d2h4d5d6d");
    expect(at(trash, { type: "raise", seat: 3, to: 250 })).toMatchObject({ graded: true, verdict: "mistake" });
    expect(at(trash, { type: "fold", seat: 3 })).toMatchObject({ graded: true, verdict: "good" });
  });

  it("does not grade spots it has no basis for", () => {
    const events = six("2c3cAs4c5c6c 2d3dAh4d5d6d");
    const opened = [...events, { type: "raise", seat: 3, to: 250 } as const];
    expect(at(opened, { type: "fold", seat: 4 })).toMatchObject({ graded: false });
  });
});

describe("postflop EV grading", () => {
  // Heads-up, button 0 posts SB. Holes: seat 1 gets cards 1 and 3, seat 0 gets cards 2 and 4.
  const toRiver: PlayerAction[] = [
    { type: "call", seat: 0 }, { type: "check", seat: 1 },
    { type: "check", seat: 1 }, { type: "check", seat: 0 },
    { type: "check", seat: 1 }, { type: "check", seat: 0 },
    { type: "bet", seat: 1, to: 100 },
  ];

  it("calling with the nuts on the river is worth exactly the pot", () => {
    // Seat 0 holds AhKh on Qh Jh Th 2c 3d, a royal flush.
    const events = hand([10000, 10000], 0, deck("9sAh9dKh QhJhTh2c3d"), toRiver);
    const g = at(events, { type: "fold", seat: 0 });
    if (!g.graded || g.basis.kind !== "ev") throw new Error("expected an EV grade");
    expect(g.best.type).not.toBe("fold");
    const call = g.basis.values.find((v) => v.action.type === "call")!;
    expect(call.evBB).toBeCloseTo(3, 9);
    expect(g.basis.approximations).not.toContain("Later streets are treated as checked down, so future bets and implied odds are ignored.");
  });

  it("folding air to a nit's river bet is right", () => {
    const events = hand([10000, 10000], 0, deck("As7c Ad2c KsQs4h9dJd"), toRiver.slice(0, 6).concat([{ type: "bet", seat: 1, to: 200 }]));
    const g = at(events, { type: "fold", seat: 0 }, { 1: STYLES.nit, 0: STYLES.tag });
    expect(g).toMatchObject({ graded: true, verdict: "good" });
  });

  it("never depends on cards that have not been dealt yet", () => {
    const flopBet: PlayerAction[] = [{ type: "call", seat: 0 }, { type: "check", seat: 1 }, { type: "bet", seat: 1, to: 150 }];
    const front = "9s8h9d7h QhJh2c";
    const rest = FULL_DECK.filter((c) => !parseCards(front).includes(c));
    const a = hand([10000, 10000], 0, deck(front, rest), flopBet);
    const b = hand([10000, 10000], 0, deck(front, [...rest].reverse()), flopBet);
    const ga = at(a, { type: "call", seat: 0 });
    const gb = at(b, { type: "call", seat: 0 });
    expect(ga).toEqual(gb);
    expect(apply(reduce(a), { type: "call", seat: 0 }).board).not.toEqual(apply(reduce(b), { type: "call", seat: 0 }).board);
  }, 30_000);
});
