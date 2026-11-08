import { type Card, FULL_DECK, mulberry32 } from "../cards/card";
import { moveDist } from "../bots/policy";
import type { Style } from "../bots/styles";
import { apply, canAct, legalActions, potSize } from "../engine/reduce";
import type { HandEvent, HandState, PlayerAction, SeatIndex } from "../engine/types";
import { evaluate } from "../evaluator/handRank";
import type { Combo, WeightedCombo } from "../evaluator/ranges";
import { candidates, isDeepShove } from "./options";
import { rangeMix } from "./rangeMix";
import { sizeOptions } from "./sizes";
import { type ActionValue, type GradeCore, verdictForChoice } from "./types";
import { effectiveSize, villainRange } from "./villainRange";

const SAMPLES = 600;

interface Sample {
  readonly combos: readonly Combo[];
  /** Hero's pot share against each subset of opponents, keyed by bitmask of who is still in. */
  readonly share: (mask: number) => number;
}

function sampler(range: readonly WeightedCombo[]) {
  const cum: number[] = [];
  range.reduce((acc, w) => (cum.push(acc + w.weight), acc + w.weight), 0);
  return (x: number) => range[Math.min(range.length - 1, cum.findIndex((c) => c > x * cum[cum.length - 1]!))]!.combo;
}

/** Joint deals: one hand per opponent from their inferred range, no shared cards, plus a runout. */
function deal(hero: Combo, board: readonly Card[], ranges: readonly WeightedCombo[][], seed: number): Sample[] {
  const rng = mulberry32(seed);
  const pick = ranges.map(sampler);
  const out: Sample[] = [];
  for (let tries = 0; out.length < SAMPLES && tries < SAMPLES * 20; tries++) {
    const used = new Set<Card>([...hero, ...board]);
    const combos: Combo[] = [];
    let ok = true;
    for (const p of pick) {
      const c = p(rng());
      if (used.has(c[0]) || used.has(c[1])) { ok = false; break; }
      used.add(c[0]).add(c[1]);
      combos.push(c);
    }
    if (!ok) continue;
    const run = [...board];
    while (run.length < 5) {
      const c = FULL_DECK[Math.floor(rng() * 52)]!;
      if (!used.has(c)) (used.add(c), run.push(c));
    }
    const h = evaluate([...hero, ...run]);
    const v = combos.map((c) => evaluate([...c, ...run]));
    const share = (mask: number) => {
      let ties = 0;
      for (let i = 0; i < v.length; i++) {
        if (!(mask & (1 << i))) continue;
        if (v[i]! > h) return 0;
        if (v[i] === h) ties++;
      }
      return 1 / (ties + 1);
    };
    out.push({ combos, share });
  }
  return out;
}

/**
 * Grades a decision against two or more opponents. Each opponent's range is inferred exactly; their
 * hands and the runout are then sampled together. A bet is answered by each opponent independently.
 */
export function gradeMultiway(events: readonly HandEvent[], st: HandState, action: PlayerAction,
  styles: Readonly<Record<SeatIndex, Style>>, villains: readonly SeatIndex[]): GradeCore {
  const hero = action.seat;
  const holeHero = st.seats[hero]!.hole;
  const ranges = villains.map((v) => villainRange(events, v, styles[v]!, [...holeHero, ...st.board]));
  const samples = deal(holeHero, st.board, ranges, 31 + events.length);
  const all = (1 << villains.length) - 1;
  const equity = samples.reduce((s, x) => s + x.share(all), 0) / samples.length;
  const bb = st.config.bigBlind;

  const respond = (a: PlayerAction) => {
    const after = apply(st, a);
    const added = st.seats[hero]!.stack - after.seats[hero]!.stack;
    const potAfter = potSize(after);
    const responders = after.phase === "betting" && after.street === st.street
      ? villains.map((v, i) => ({ v, i })).filter(({ v }) => canAct(after.seats[v]!) && after.seats[v]!.street < after.seats[hero]!.street)
      : [];
    return { after, added, potAfter, responders };
  };

  const valueOf = (a: PlayerAction): { ev: number; foldAll: number; eqCalled: number | null } => {
    if (a.type === "fold") return { ev: 0, foldAll: 0, eqCalled: null };
    const { after, added, potAfter, responders } = respond(a);
    if (responders.length === 0) return { ev: equity * potAfter - added, foldAll: 0, eqCalled: null };
    const heroTo = after.seats[hero]!.street;
    let ev = 0, foldAll = 0, calledShare = 0, calledWeight = 0;
    for (const x of samples) {
      const cont = responders.map(({ v, i }) => 1 - moveDist({ ...after, toAct: v } as HandState, v, x.combos[i]!, styles[v]!).fold);
      const responderMask = responders.reduce((m, { i }) => m | (1 << i), 0);
      for (let sub = 0; sub < 1 << responders.length; sub++) {
        let p = 1, mask = all & ~responderMask, pot = potAfter;
        responders.forEach(({ v, i }, k) => {
          const stays = (sub >> k) & 1;
          p *= stays ? cont[k]! : 1 - cont[k]!;
          if (stays) (mask |= 1 << i, pot += Math.min(heroTo, after.seats[v]!.street + after.seats[v]!.stack) - after.seats[v]!.street);
        });
        if (p === 0) continue;
        const share = mask === 0 ? 1 : x.share(mask);
        ev += p * (share * pot - added);
        if (sub === 0 && mask === 0) foldAll += p;
        else (calledShare += p * share, calledWeight += p);
      }
    }
    const n = samples.length;
    return { ev: ev / n, foldAll: foldAll / n, eqCalled: calledWeight > 0 ? calledShare / calledWeight : null };
  };

  const values: ActionValue[] = candidates(st, action).map((a) => ({ action: a, evBB: valueOf(a).ev / bb }));
  const best = values.filter((v) => !isDeepShove(st, v.action)).reduce((a, b) => (b.evBB > a.evBB ? b : a));
  const evLossBB = Math.max(0, best.evBB - values[0]!.evBB);
  const legal = legalActions(st)!;
  const smallest = legal.raise ? valueOf({ type: legal.raise.kind, seat: hero, to: sizeOptions(st)[0]!.to }) : null;
  const lastAggressor = [...st.history].reverse().find((h) => (h.type === "bet" || h.type === "raise") && villains.includes(h.seat))?.seat;
  const focus = lastAggressor ?? villains[0]!;
  const focusIdx = villains.indexOf(focus);
  return {
    graded: true, street: st.street, seat: hero, action, best: best.action, evLossBB, verdict: verdictForChoice(action, best.action, evLossBB),
    basis: {
      kind: "ev", villain: focus, opponents: villains.length, mix: rangeMix(ranges[focusIdx]!, st.board),
      foldToBet: smallest ? smallest.foldAll : null, equityWhenCalled: smallest?.eqCalled ?? null,
      values, equity, potOddsNeeded: legal.callAmount > 0 ? legal.callAmount / (potSize(st) + legal.callAmount) : null,
      rangeSize: effectiveSize(ranges[focusIdx]!),
      approximations: [
        `Against ${villains.length} opponents, their hands and the cards to come are sampled ${samples.length} times.`,
        "Each opponent answers a bet as if they were the only one deciding. Re-raises are treated as calls.",
        "After a check or call, the rest of the hand is assumed to be checked through.",
      ],
    },
  };
}

/** Hero's pot share against several opponents' inferred ranges, sampled together with the runout. */
export function equityAgainst(events: readonly HandEvent[], st: HandState, hero: SeatIndex,
  styles: Readonly<Record<SeatIndex, Style>>, villains: readonly SeatIndex[]): number {
  const holeHero = st.seats[hero]!.hole;
  const ranges = villains.map((v) => villainRange(events, v, styles[v]!, [...holeHero, ...st.board]));
  const samples = deal(holeHero, st.board, ranges, 57 + events.length);
  const all = (1 << villains.length) - 1;
  return samples.reduce((s, x) => s + x.share(all), 0) / samples.length;
}
