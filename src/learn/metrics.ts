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

/** Mean EV loss per decision credited to each concept. Shows where the leaks are. */
export function leaks(log: readonly LogEntry[]): { conceptId: string; decisions: number; meanEvLossBB: number }[] {
  const by = new Map<string, number[]>();
  for (const e of log) if (e.evLossBB !== null) for (const id of e.conceptIds) by.set(id, [...(by.get(id) ?? []), e.evLossBB]);
  return [...by.entries()]
    .map(([conceptId, xs]) => ({ conceptId, decisions: xs.length, meanEvLossBB: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => b.meanEvLossBB - a.meanEvLossBB);
}
