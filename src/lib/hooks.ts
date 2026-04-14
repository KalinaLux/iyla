import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Cycle, DailyReading } from './types';

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
