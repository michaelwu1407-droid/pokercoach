import type { LogEntry } from "./learner";

export interface WeekStat {
  /** Monday 00:00 local time of the week, as epoch ms. */
  readonly weekStart: number;
  readonly evDecisions: number;
  /** The north-star number. Mean EV given up per EV-graded decision. Lower is better. */
  readonly meanEvLossBB: number | null;
  readonly chartDecisions: number;
  readonly chartAccuracy: number | null;
}

export function weekStart(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function weekly(log: readonly LogEntry[]): WeekStat[] {
  const weeks = new Map<number, LogEntry[]>();
  for (const e of log) weeks.set(weekStart(e.at), [...(weeks.get(weekStart(e.at)) ?? []), e]);
  return [...weeks.entries()].sort(([a], [b]) => a - b).map(([ws, es]) => {
    const ev = es.filter((e) => e.evLossBB !== null);
    const chart = es.filter((e) => e.evLossBB === null);
    return {
      weekStart: ws,
      evDecisions: ev.length,
      meanEvLossBB: ev.length ? ev.reduce((s, e) => s + e.evLossBB!, 0) / ev.length : null,
      chartDecisions: chart.length,
      chartAccuracy: chart.length ? chart.filter((e) => e.verdict === "good").length / chart.length : null,
    };
  });
}

export interface Leak {
  readonly conceptId: string;
  readonly decisions: number;
  /** Share of decisions graded "mistake" or "blunder". */
  readonly missRate: number;
  /** Mean EV lost per EV-graded decision, or null when the skill is graded by chart. */
  readonly meanEvLossBB: number | null;
}

/** Each skill's record, worst first: by how often it is missed, then by EV lost. */
export function leaks(log: readonly LogEntry[]): Leak[] {
  const by = new Map<string, LogEntry[]>();
  for (const e of log) for (const id of e.conceptIds) by.set(id, [...(by.get(id) ?? []), e]);
  const out = [...by.entries()].map(([conceptId, es]) => {
    const ev = es.filter((e) => e.evLossBB !== null);
    return {
      conceptId,
      decisions: es.length,
      missRate: es.filter((e) => e.verdict === "mistake" || e.verdict === "blunder").length / es.length,
      meanEvLossBB: ev.length ? ev.reduce((s, e) => s + e.evLossBB!, 0) / ev.length : null,
    };
  });
  return out.sort((a, b) => b.missRate - a.missRate || (b.meanEvLossBB ?? 0) - (a.meanEvLossBB ?? 0));
}
