import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { db } from './db';
import type { Cycle, DailyReading } from './types';
import { buildIntelligenceSnapshot, type IntelligenceSnapshot } from './intelligence';

export function useCurrentCycle(): Cycle | undefined {
  return useLiveQuery(() =>
    db.cycles.where('outcome').equals('ongoing').first()
  );
}

export function useCycles(): Cycle[] {
  return useLiveQuery(() =>
    db.cycles.orderBy('startDate').reverse().toArray()
  ) ?? [];
}

export function useCycleReadings(cycleId: number | undefined): DailyReading[] {
  return useLiveQuery(
    () => cycleId ? db.readings.where('cycleId').equals(cycleId).sortBy('cycleDay') : [],
    [cycleId]
  ) ?? [];
}

export function useTodayReading(cycleId: number | undefined, date: string): DailyReading | undefined {
  return useLiveQuery(
    () => cycleId
      ? db.readings.where({ cycleId, date }).first()
      : undefined,
    [cycleId, date]
  );
}

export function useRecentReadings(cycleId: number | undefined, beforeDate: string, count: number): DailyReading[] {
  return useLiveQuery(
    () => cycleId
      ? db.readings
          .where('cycleId').equals(cycleId)
          .and(r => r.date < beforeDate)
          .sortBy('date')
          .then(arr => arr.slice(-count))
      : [],
    [cycleId, beforeDate, count]
  ) ?? [];
}

export function useSupplements() {
  return useLiveQuery(() =>
    db.supplements.where('isActive').equals(1).sortBy('sortOrder')
  ) ?? [];
}

export function useProtocols() {
  return useLiveQuery(() =>
    db.protocols.toArray()
  ) ?? [];
}

export function useSupplementLogs(date: string) {
  return useLiveQuery(
    () => db.supplementLogs.where('date').equals(date).toArray(),
    [date]
  ) ?? [];
}

export function useLabs() {
  return useLiveQuery(() =>
    db.labs.orderBy('date').reverse().toArray()
  ) ?? [];
}

export function useLabsByTest(testName: string) {
  return useLiveQuery(
    () => db.labs.where('testName').equals(testName).sortBy('date'),
    [testName]
  ) ?? [];
}

// ──────────────────────────────────────────────────────────────────────────
// Intelligence hook — runs all 5 engines and returns a unified snapshot.
// Recomputes whenever any underlying table changes.
// ──────────────────────────────────────────────────────────────────────────

export function useIntelligence(): IntelligenceSnapshot | null {
  const today = format(new Date(), 'yyyy-MM-dd');

  const data = useLiveQuery(async () => {
    const [cycles, readings, labs, supplements, supplementLogs] = await Promise.all([
      db.cycles.orderBy('startDate').toArray(),
      db.readings.toArray(),
      db.labs.toArray(),
      db.supplements.toArray(),
      db.supplementLogs.toArray(),
    ]);
    const currentCycle = cycles.find(c => c.outcome === 'ongoing') ?? null;
    return { cycles, readings, labs, supplements, supplementLogs, currentCycleId: currentCycle?.id ?? null };
  }, []);

  return useMemo(() => {
    if (!data) return null;
    if (data.cycles.length === 0) return null;
    try {
      return buildIntelligenceSnapshot({ ...data, today });
    } catch (err) {
      console.error('[iyla intelligence] failed to compute snapshot', err);
      return null;
    }
  }, [data, today]);
}
