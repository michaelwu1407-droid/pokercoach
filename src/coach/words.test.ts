import { describe, expect, it } from "vitest";
import { mulberry32 } from "../cards/card";
import { decide } from "../bots/policy";
import { STYLES } from "../bots/styles";
import { MIX_LABELS } from "../grading/rangeMix";
import { CORE_CONCEPTS } from "../learn/concepts";
import { heroAct, newHand, newTable, state } from "../session/session";
import { ROUNDS, RULES, SEATS, SHEET, WORDS } from "../ui/Help";
import { feedback, feedbackText } from "./feedback";
import { JARGON, money, seatName } from "./words";

describe("plain words on screen", () => {
  it("the jargon check catches what it should", () => {
    for (const bad of ["raise 2.5bb", "Your equity", "seat UTG", "T3o", "AKs is a raise", "You have T♠", "EV lost"]) expect(bad).toMatch(JARGON);
    for (const ok of ["Raise to $2.50", "10-3 offsuit", "Big blind", "Ten-Three offsuit", "Chance to win"]) expect(ok).not.toMatch(JARGON);
  });

  it("formats money in dollars", () => {
    expect(money(250, 100)).toBe("$2.50");
    expect(money(10000, 100)).toBe("$100");
    expect(seatName("BTN")).toBe("Dealer");
  });

  it("keeps every fixed label free of shorthand", () => {
    const fixed = [
      ...MIX_LABELS, ...Object.values(STYLES).flatMap((s) => [s.name, s.leak]),
      ...CORE_CONCEPTS.flatMap((c) => [c.title, c.statement]), ...[RULES, ROUNDS, SEATS, WORDS, SHEET].flat(2),
    ];
    expect(fixed.filter((t) => JARGON.test(t))).toEqual([]);
  });

  it("keeps every coach card free of shorthand across a played session", () => {
    const rng = mulberry32(31);
    const bad: string[] = [];
    let cards = 0;
    for (let n = 0; n < 120; n++) {
      const opp = newTable(300 + Math.floor(n / 25));
      let h = newHand(70_000 + n, n, opp);
      while (state(h).phase === "betting") {
        const r = heroAct(h, decide(state(h), n % 2 ? STYLES.station : STYLES.lag, rng), CORE_CONCEPTS);
        const text = feedbackText(feedback(r.grade, opp, 100));
        cards++;
        if (JARGON.test(text)) bad.push(text);
        h = r.hand;
      }
    }
    expect(cards).toBeGreaterThan(150);
    expect(bad.slice(0, 3)).toEqual([]);
  }, 300_000);
});
