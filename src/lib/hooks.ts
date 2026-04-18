import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { db } from './db';
import type { Cycle, DailyReading } from './types';
import {
  buildIntelligenceSnapshot,
  type IntelligenceSnapshot,
  type SymptomPattern,
  type CycleRetrospective,
} from './intelligence';
import { maleDb, type SemenAnalysis, type MaleDailyLog } from './male-factor-db';
import { computeDadScore, type DadScore } from './dad-score';
import { computeCoupleScore, type CoupleScore } from './couple-score';
import { computeAchievements, unclaimedEarned, type Achievement } from './achievements';
import { calculateStreak as calculateBreathworkStreak } from './breathwork-rewards';
import { computeJournalStreak } from './journal-search';
import { breathworkDb } from './breathwork-rewards';
import { journalDb } from './journal-db';
import { reconnectDb } from './reconnect-data';

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

/** The most recently closed cycle's retrospective (warm narrative summary). */
export function useLatestRetrospective(): CycleRetrospective | null {
  const intelligence = useIntelligence();
  return intelligence?.latestRetrospective ?? null;
}

/** Recurring symptom patterns detected across cycles. */
export function useSymptomPatterns(): SymptomPattern[] {
  const intelligence = useIntelligence();
  return intelligence?.symptoms ?? [];
}

// ──────────────────────────────────────────────────────────────────────────
// Dad / male partner hooks
// ──────────────────────────────────────────────────────────────────────────

export function useSemenAnalyses(): SemenAnalysis[] {
  return useLiveQuery(() => maleDb.semenAnalyses.orderBy('date').reverse().toArray()) ?? [];
}

export function useMaleDailyLogs(days = 30): MaleDailyLog[] {
  return useLiveQuery(async () => {
    const all = await maleDb.dailyLogs.orderBy('date').reverse().toArray();
    return all.slice(0, days);
  }, [days]) ?? [];
}

export function useDadScore(): DadScore | null {
  const today = format(new Date(), 'yyyy-MM-dd');
  const semenAnalyses = useSemenAnalyses();
  const dailyLogs = useMaleDailyLogs(60);
  return useMemo(() => {
    try {
      return computeDadScore({ semenAnalyses, dailyLogs, today });
    } catch (err) {
      console.error('[iyla dad-score] failed', err);
      return null;
    }
  }, [semenAnalyses, dailyLogs, today]);
}

// ──────────────────────────────────────────────────────────────────────────
// Achievements hook — computes milestones from the user's local data
// ──────────────────────────────────────────────────────────────────────────

export function useAchievements(): { all: Achievement[]; newlyEarned: Achievement[] } {
  const cycles = useCycles();
  const intelligence = useIntelligence();
  const dadScore = useDadScore();

  const readings = useLiveQuery(() => db.readings.toArray(), []) ?? [];

  const breathworkLogs = useLiveQuery(() => breathworkDb.logs.toArray(), []) ?? [];
  const breathworkStreak = useMemo(() => calculateBreathworkStreak(breathworkLogs), [breathworkLogs]);

  const journalEntries = useLiveQuery(() => journalDb.entries.toArray(), []) ?? [];
  const journalStreak = useMemo(() => computeJournalStreak(journalEntries), [journalEntries]);

  const reconnectCount = useLiveQuery(() => reconnectDb.sessions.count(), []) ?? 0;

  const pairedSince = useMemo(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('iyla_pair_code') ? 'connected' : null;
  }, []);

  return useMemo(() => {
    const all = computeAchievements({
      cycles,
      readings,
      baselines: intelligence?.baselines ?? null,
      dadScore,
      breathworkStreak,
      journalStreak,
      reconnectSessionCount: reconnectCount,
      pairedSince,
    });
    const newlyEarned = unclaimedEarned(all);
    return { all, newlyEarned };
  }, [cycles, readings, intelligence, dadScore, breathworkStreak, journalStreak, reconnectCount, pairedSince]);
}

export function useCoupleScore(): CoupleScore | null {
  const intelligence = useIntelligence();
  const dadScore = useDadScore();
  const cycle = useCurrentCycle();
  const readings = useCycleReadings(cycle?.id);

  return useMemo(() => {
    if (!intelligence) return null;
    const fertileStart = intelligence.predictions.fertilePhaseStart;
    const fertileEnd = intelligence.predictions.fertilePhaseEnd;
    let fertileWindowDayCount = 0;
    let fertileWindowIntercourseCount = 0;
    if (fertileStart && fertileEnd) {
      const inWindow = readings.filter(r => r.date >= fertileStart && r.date <= fertileEnd);
      fertileWindowDayCount = inWindow.length;
      fertileWindowIntercourseCount = inWindow.filter(r => r.intercourse).length;
    }
    try {
      return computeCoupleScore({
        iylaTotal: intelligence.score.total,
        iylaDomains: intelligence.score.domains.map(d => ({ id: d.id, score: d.score })),
        dadTotal: dadScore?.total ?? null,
        dadDomains: dadScore?.domains.map(d => ({ id: d.id, score: d.score })) ?? null,
        fertileWindowIntercourseCount,
        fertileWindowDayCount,
      });
    } catch (err) {
      console.error('[iyla couple-score] failed', err);
      return null;
    }
  }, [intelligence, dadScore, readings]);
}
