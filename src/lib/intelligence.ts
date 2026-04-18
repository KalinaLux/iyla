// ──────────────────────────────────────────────────────────────────────────
// iyla — Intelligence Orchestrator
// ──────────────────────────────────────────────────────────────────────────
// Single entry point that runs all 5 engines (Score, Patterns, Correlations,
// Predictions, Weekly Digest) against the current user's data and returns a
// unified IntelligenceSnapshot.
//
// UI should import from here, not the individual engines, so the wiring stays
// consistent and the engines can evolve independently.
// ──────────────────────────────────────────────────────────────────────────

import { format } from 'date-fns';

import type {
  Cycle,
  DailyReading,
  LabResult,
  Supplement,
  SupplementLog,
} from './types';

import {
  computeIylaScore,
  saveIylaScoreSnapshot,
  getIylaScoreHistory,
  type IylaScore,
} from './iyla-score';

import {
  detectPatterns,
  type DetectedPattern,
} from './pattern-detection';

import {
  findCorrelations,
  type Correlation,
} from './correlation-engine';

import {
  computePredictions,
  type CyclePredictions,
} from './predictions';

import {
  buildWeeklyDigest,
  saveWeeklyDigest,
  getMostRecentDigest,
  type WeeklyDigest,
  type IylaScoreLike,
  type CyclePredictionsLike,
  type DetectedPatternLike,
  type CorrelationLike,
} from './weekly-digest';

// ── Public shape ────────────────────────────────────────────────────────

export interface IntelligenceSnapshot {
  score: IylaScore;
  patterns: DetectedPattern[];
  correlations: Correlation[];
  predictions: CyclePredictions;
  digest: WeeklyDigest;
  generatedAt: string;
}

export interface IntelligenceInput {
  cycles: Cycle[];
  readings: DailyReading[];
  labs: LabResult[];
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
  currentCycleId: number | null;
  today?: string; // ISO yyyy-MM-dd; defaults to today
}

// ── Adapters — bridge engine outputs to WeeklyDigest's *Like interfaces ─

function adaptScoreForDigest(s: IylaScore): IylaScoreLike {
  return {
    overall: s.total,
    score: s.total,
    grade: s.grade,
    breakdown: s.domains.map(d => ({
      domain: d.label,
      score: d.score,
      weight: d.weight,
    })),
  };
}

function adaptPredictionsForDigest(p: CyclePredictions, today: string): CyclePredictionsLike {
  const ovIso = p.nextOvulation?.date ?? null;
  const periodIso = p.nextPeriod?.date ?? null;
  const daysUntil = (iso: string | null): number | null => {
    if (!iso) return null;
    const a = new Date(iso + 'T00:00:00').getTime();
    const b = new Date(today + 'T00:00:00').getTime();
    return Math.round((a - b) / (1000 * 60 * 60 * 24));
  };
  const dUntilOv = daysUntil(ovIso);
  const dUntilPeriod = daysUntil(periodIso);
  const inWindow =
    p.fertilePhaseStart !== null && p.fertilePhaseEnd !== null &&
    today >= p.fertilePhaseStart && today <= p.fertilePhaseEnd;

  // Derive a phase label for the digest
  let phase: CyclePredictionsLike['phase'] = undefined;
  if (dUntilOv !== null && Math.abs(dUntilOv) <= 1) phase = 'ovulatory';
  else if (dUntilOv !== null && dUntilOv > 1) phase = 'follicular';
  else if (dUntilOv !== null && dUntilOv < -1) phase = 'luteal';

  return {
    phase,
    cycleDay: null,
    nextPeriodDate: periodIso,
    nextOvulationDate: ovIso,
    fertileWindowStart: p.fertilePhaseStart,
    fertileWindowEnd: p.fertilePhaseEnd,
    bestDayDate: p.bestConceptionDays[0]?.date ?? null,
    conceptionOddsPct: p.conceptionOddsThisCycle,
    daysUntilOvulation: dUntilOv,
    daysUntilPeriod: dUntilPeriod,
    daysPastOvulation: dUntilOv !== null && dUntilOv < 0 ? Math.abs(dUntilOv) : null,
    inFertileWindow: inWindow,
  };
}

function adaptPatternsForDigest(patterns: DetectedPattern[]): DetectedPatternLike[] {
  return patterns.map(p => ({
    id: p.id,
    severity: p.severity,
    title: p.title,
    description: p.description,
    actionable: p.actionable ?? null,
  }));
}

function adaptCorrelationsForDigest(correlations: Correlation[]): CorrelationLike[] {
  return correlations.map(c => ({
    variableA: c.xLabel,
    variableB: c.yLabel,
    r: c.r,
    n: c.sampleSize,
    narrative: c.narrative,
    direction: c.direction,
  }));
}

// ── Main orchestrator ───────────────────────────────────────────────────

export function buildIntelligenceSnapshot(input: IntelligenceInput): IntelligenceSnapshot {
  const today = input.today ?? format(new Date(), 'yyyy-MM-dd');

  // Run score, snapshot it so weekly deltas work over time
  const score = computeIylaScore({
    cycles: input.cycles,
    readings: input.readings,
    labs: input.labs,
    supplements: input.supplements,
    supplementLogs: input.supplementLogs,
  });
  try { saveIylaScoreSnapshot(score); } catch { /* localStorage may be unavailable */ }

  // Patterns
  const patterns = detectPatterns({
    cycles: input.cycles,
    readings: input.readings,
    labs: input.labs,
    today,
  });

  // Correlations
  const correlations = findCorrelations({
    cycles: input.cycles,
    readings: input.readings,
    supplementLogs: input.supplementLogs,
  });

  // Predictions
  const predictions = computePredictions({
    cycles: input.cycles,
    readings: input.readings,
    currentCycleId: input.currentCycleId,
    today,
  });

  // Find last week's score snapshot for digest delta
  const history = getIylaScoreHistory();
  const prevWeekTarget = new Date(today + 'T00:00:00');
  prevWeekTarget.setDate(prevWeekTarget.getDate() - 7);
  const prevIso = format(prevWeekTarget, 'yyyy-MM-dd');
  const prevSnapshot = [...history]
    .reverse()
    .find(h => h.timestamp.startsWith(prevIso.substring(0, 7)) && h.timestamp <= today) ?? null;
  const scorePreviousWeek: IylaScore | null = prevSnapshot
    ? {
      ...score,
      total: prevSnapshot.total,
      delta7Day: 0,
      delta30Day: 0,
      computedAt: prevSnapshot.timestamp,
    }
    : null;

  // Weekly digest
  const digest = buildWeeklyDigest({
    cycles: input.cycles,
    readings: input.readings,
    labs: input.labs,
    supplementLogs: input.supplementLogs,
    score: adaptScoreForDigest(score),
    scorePreviousWeek: scorePreviousWeek ? adaptScoreForDigest(scorePreviousWeek) : null,
    patterns: adaptPatternsForDigest(patterns),
    correlations: adaptCorrelationsForDigest(correlations),
    predictions: adaptPredictionsForDigest(predictions, today),
    today,
  });
  try { saveWeeklyDigest(digest); } catch { /* ignore */ }

  return {
    score,
    patterns,
    correlations,
    predictions,
    digest,
    generatedAt: new Date().toISOString(),
  };
}

// Re-export commonly used types for convenience
export type { IylaScore, DetectedPattern, Correlation, CyclePredictions, WeeklyDigest };
export { getMostRecentDigest, getIylaScoreHistory };
