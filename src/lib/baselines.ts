/**
 * baselines.ts
 *
 * Purpose:
 *   Derives *personalized* fertility thresholds from the user's own cycle
 *   history. Generic population rules (e.g. "CD14 is fertile", "LH >= 25
 *   means surge") are a poor fit for many bodies — some women peak at
 *   LH 6, ovulate on CD19, or have 9-day luteal phases. This module
 *   replaces those generics with baselines computed from HER data.
 *
 *   Downstream engines (fertility-engine, correlation-engine, UI charts)
 *   consume these baselines to tune their own thresholds — e.g. the LH
 *   surge detector can use `lhSurgeThresholdSuggestion` instead of a
 *   hard-coded value.
 *
 * Design:
 *   - Pure functions. No React, no DB calls, no network.
 *   - The only side-effect surface is the optional localStorage
 *     cache (`saveBaselines` / `getCachedBaselines`) so consumers
 *     don't need to recompute on every render.
 *   - Robust to sparse data: when there aren't enough completed
 *     cycles/readings, fields return `null` rather than crashing.
 *
 * Confidence policy:
 *   sampleSize >= 4  → 'high'
 *   sampleSize >= 2  → 'medium'
 *   sampleSize >= 1  → 'low'
 *   sampleSize === 0 → 'low' with null/default fields
 */

import type { Cycle, DailyReading } from './types';

// ──────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────

export type Confidence = 'low' | 'medium' | 'high';
export type RampStyle = 'sharp' | 'gradual' | 'double-peak' | 'unknown';

export interface PersonalBaselines {
  sampleSize: number;
  cycleLength: {
    mean: number;
    stddev: number;
    min: number;
    max: number;
    confidence: Confidence;
  };
  lutealPhase: {
    meanDays: number;
    stddev: number;
    isShort: boolean;
    confidence: Confidence;
  };
  follicularPhase: {
    meanDays: number;
    stddev: number;
    confidence: Confidence;
  };
  ovulation: {
    typicalCycleDay: number | null;
    cycleDayRange: [number, number] | null;
    confidence: Confidence;
  };
  lhSurge: {
    typicalPeakValue: number | null;
    typicalSurgeOnsetCd: number | null;
    typicalSurgeDurationDays: number | null;
    rampStyle: RampStyle;
    peakValueStddev: number;
    confidence: Confidence;
  };
  bbt: {
    follicularBaseline: number | null;
    lutealBaseline: number | null;
    thermalShiftSize: number | null;
    follicularStddev: number;
    confidence: Confidence;
  };
  kegg: {
    peakImpedance: number | null;
    troughImpedance: number | null;
    typicalDropSize: number | null;
    confidence: Confidence;
  };
  hormones: {
    e3gFollicularBaseline: number | null;
    e3gPreOvPeak: number | null;
    pdgLutealPeak: number | null;
    pdgOvulationConfirmThreshold: number | null;
    fshFollicularBaseline: number | null;
  };
  adaptiveRules: {
    notes: string[];
    lhSurgeThresholdSuggestion: number | null;
    fertileWindowCdRange: [number, number] | null;
  };
  generatedAt: string;
}

export interface BaselineInput {
  cycles: Cycle[];
  readings: DailyReading[];
}

// ──────────────────────────────────────────────────────────────────
// Small numeric helpers
// ──────────────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

function confidenceFor(n: number): Confidence {
  if (n >= 4) return 'high';
  if (n >= 2) return 'medium';
  return 'low';
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function modeOf<T extends string>(xs: T[]): T | null {
  if (xs.length === 0) return null;
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = -1;
  for (const [k, v] of counts) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    }
  }
  return best;
}

// ──────────────────────────────────────────────────────────────────
// Per-cycle feature extraction
// ──────────────────────────────────────────────────────────────────

interface CycleFeatures {
  cycleLength: number | null;
  ovulationDay: number | null;
  follicularDays: number | null;
  lutealDays: number | null;
  lhPeakValue: number | null;
  lhPeakCd: number | null;
  lhSurgeOnsetCd: number | null;
  lhSurgeDurationDays: number | null;
  lhRampStyle: RampStyle;
  bbtFollicularMean: number | null;
  bbtLutealMean: number | null;
  bbtFollicularValues: number[];
  keggPeak: number | null;
  keggTrough: number | null;
  e3gFollicularMean: number | null;
  e3gPreOvPeak: number | null;
  pdgLutealPeak: number | null;
  fshFollicularMean: number | null;
}

function deriveOvulationDay(cycle: Cycle, readings: DailyReading[]): number | null {
  if (cycle.ovulationDay != null) return cycle.ovulationDay;

  // Fallback 1: first day of sustained BBT thermal shift.
  // A shift = BBT on this day is > mean(prev 6 BBT readings) + 0.2°F/C.
  const bbtByCd = readings
    .filter(r => r.bbt != null)
    .sort((a, b) => a.cycleDay - b.cycleDay);
  if (bbtByCd.length >= 7) {
    for (let i = 6; i < bbtByCd.length; i++) {
      const prior = bbtByCd.slice(Math.max(0, i - 6), i).map(r => r.bbt!);
      const baseline = mean(prior);
      if (bbtByCd[i].bbt! > baseline + 0.2) {
        // Ovulation is typically the day BEFORE the shift.
        return Math.max(1, bbtByCd[i].cycleDay - 1);
      }
    }
  }

  // Fallback 2: first day with PdG >= 3 ng/mL → ovulation ~2 days earlier.
  const pdgRising = readings
    .filter(r => r.pdg != null && r.pdg >= 3)
    .sort((a, b) => a.cycleDay - b.cycleDay);
  if (pdgRising.length > 0) {
    return Math.max(1, pdgRising[0].cycleDay - 2);
  }

  return null;
}

function classifyRamp(
  sorted: Array<{ cd: number; lh: number }>,
  peakValue: number,
  peakCd: number,
  onsetCd: number,
): RampStyle {
  if (sorted.length === 0 || peakValue <= 0) return 'unknown';

  // Double-peak detection: two local maxima >= 70% of peak, separated by
  // at least 2 days, with a valley between them that is >= 30% below peak.
  const highThreshold = peakValue * 0.7;
  const valleyCutoff = peakValue * 0.7; // "30% below peak" = value <= 70% of peak
  const localMaxCds: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i].lh;
    if (v < highThreshold) continue;
    const prev = i > 0 ? sorted[i - 1].lh : -Infinity;
    const next = i < sorted.length - 1 ? sorted[i + 1].lh : -Infinity;
    if (v >= prev && v >= next) localMaxCds.push(sorted[i].cd);
  }
  if (localMaxCds.length >= 2) {
    for (let i = 0; i < localMaxCds.length - 1; i++) {
      for (let j = i + 1; j < localMaxCds.length; j++) {
        const gap = localMaxCds[j] - localMaxCds[i];
        if (gap < 2) continue;
        // Find min LH strictly between the two maxima.
        const between = sorted.filter(
          p => p.cd > localMaxCds[i] && p.cd < localMaxCds[j],
        );
        if (between.length === 0) continue;
        const valley = Math.min(...between.map(p => p.lh));
        if (valley <= valleyCutoff) return 'double-peak';
      }
    }
  }

  const daysPeakAfterOnset = peakCd - onsetCd;
  if (daysPeakAfterOnset <= 2) return 'sharp';
  if (daysPeakAfterOnset >= 3) return 'gradual';
  return 'unknown';
}

function topNMean(xs: number[], n: number): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => b - a);
  const k = Math.min(n, sorted.length);
  return mean(sorted.slice(0, k));
}

function bottomNMean(xs: number[], n: number): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const k = Math.min(n, sorted.length);
  return mean(sorted.slice(0, k));
}

function extractFeatures(cycle: Cycle, readings: DailyReading[]): CycleFeatures {
  const cycleReadings = readings
    .filter(r => r.cycleId === cycle.id)
    .sort((a, b) => a.cycleDay - b.cycleDay);

  // Cycle length: prefer explicit start/end, else fall back to max cycleDay.
  let cycleLength: number | null = null;
  if (cycle.startDate && cycle.endDate) {
    const diff = daysBetween(cycle.startDate, cycle.endDate) + 1;
    if (diff > 0 && diff < 200) cycleLength = diff;
  }
  if (cycleLength == null && cycleReadings.length > 0) {
    const maxCd = Math.max(...cycleReadings.map(r => r.cycleDay));
    if (maxCd > 10) cycleLength = maxCd;
  }

  const ovulationDay = deriveOvulationDay(cycle, cycleReadings);

  const follicularDays =
    cycle.follicularPhaseDays ?? (ovulationDay != null ? ovulationDay : null);

  let lutealDays: number | null = null;
  if (cycle.lutealPhaseDays != null) {
    lutealDays = cycle.lutealPhaseDays;
  } else if (cycleLength != null) {
    const ov = ovulationDay ?? 14;
    const diff = cycleLength - ov;
    if (diff > 0 && diff < 30) lutealDays = diff;
  }

  // ── LH surge metrics ─────────────────────────────────────────
  const lhPoints = cycleReadings
    .filter(r => r.lh != null)
    .map(r => ({ cd: r.cycleDay, lh: r.lh as number }));

  let lhPeakValue: number | null = null;
  let lhPeakCd: number | null = null;
  let lhSurgeOnsetCd: number | null = null;
  let lhSurgeDurationDays: number | null = null;
  let lhRampStyle: RampStyle = 'unknown';

  if (lhPoints.length > 0) {
    let peak = lhPoints[0];
    for (const p of lhPoints) if (p.lh > peak.lh) peak = p;
    lhPeakValue = peak.lh;
    lhPeakCd = peak.cd;

    if (peak.lh > 0) {
      const halfPeak = peak.lh * 0.5;
      const onset = lhPoints.find(p => p.lh >= halfPeak && p.cd <= peak.cd);
      if (onset) {
        lhSurgeOnsetCd = onset.cd;
        lhSurgeDurationDays = Math.max(1, peak.cd - onset.cd + 1);
        lhRampStyle = classifyRamp(lhPoints, peak.lh, peak.cd, onset.cd);
      }
    }
  }

  // ── BBT ─────────────────────────────────────────────────────
  const bbtCutoffCd = (ovulationDay ?? 14) - 1;
  const bbtFollicularValues = cycleReadings
    .filter(r => r.bbt != null && r.cycleDay <= bbtCutoffCd)
    .map(r => r.bbt as number);
  const bbtLutealValues = cycleReadings
    .filter(r => r.bbt != null && r.cycleDay > bbtCutoffCd)
    .map(r => r.bbt as number);
  const bbtFollicularMean =
    bbtFollicularValues.length > 0 ? mean(bbtFollicularValues) : null;
  const bbtLutealMean =
    bbtLutealValues.length > 0 ? mean(bbtLutealValues) : null;

  // ── Kegg ────────────────────────────────────────────────────
  const keggValues = cycleReadings
    .filter(r => r.keggImpedance != null)
    .map(r => r.keggImpedance as number);
  const keggPeak = topNMean(keggValues, 3);
  const keggTrough = bottomNMean(keggValues, 3);

  // ── Hormones ────────────────────────────────────────────────
  const preOvCutoff = ovulationDay ?? 14;

  const e3gFollicular = cycleReadings
    .filter(r => r.e3g != null && r.cycleDay <= Math.max(1, preOvCutoff - 5))
    .map(r => r.e3g as number);
  const e3gFollicularMean = e3gFollicular.length > 0 ? mean(e3gFollicular) : null;

  const e3gPreOvWindow = cycleReadings
    .filter(
      r => r.e3g != null && r.cycleDay <= preOvCutoff && r.cycleDay >= preOvCutoff - 5,
    )
    .map(r => r.e3g as number);
  const e3gPreOvPeak = e3gPreOvWindow.length > 0 ? Math.max(...e3gPreOvWindow) : null;

  const pdgLuteal = cycleReadings
    .filter(r => r.pdg != null && r.cycleDay > preOvCutoff)
    .map(r => r.pdg as number);
  const pdgLutealPeak = pdgLuteal.length > 0 ? Math.max(...pdgLuteal) : null;

  const fshFollicular = cycleReadings
    .filter(r => r.fsh != null && r.cycleDay <= 5)
    .map(r => r.fsh as number);
  const fshFollicularMean = fshFollicular.length > 0 ? mean(fshFollicular) : null;

  return {
    cycleLength,
    ovulationDay,
    follicularDays,
    lutealDays,
    lhPeakValue,
    lhPeakCd,
    lhSurgeOnsetCd,
    lhSurgeDurationDays,
    lhRampStyle,
    bbtFollicularMean,
    bbtLutealMean,
    bbtFollicularValues,
    keggPeak,
    keggTrough,
    e3gFollicularMean,
    e3gPreOvPeak,
    pdgLutealPeak,
    fshFollicularMean,
  };
}

// ──────────────────────────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────────────────────────

function emptyBaselines(now: string): PersonalBaselines {
  return {
    sampleSize: 0,
    cycleLength: { mean: 0, stddev: 0, min: 0, max: 0, confidence: 'low' },
    lutealPhase: { meanDays: 0, stddev: 0, isShort: false, confidence: 'low' },
    follicularPhase: { meanDays: 0, stddev: 0, confidence: 'low' },
    ovulation: {
      typicalCycleDay: null,
      cycleDayRange: null,
      confidence: 'low',
    },
    lhSurge: {
      typicalPeakValue: null,
      typicalSurgeOnsetCd: null,
      typicalSurgeDurationDays: null,
      rampStyle: 'unknown',
      peakValueStddev: 0,
      confidence: 'low',
    },
    bbt: {
      follicularBaseline: null,
      lutealBaseline: null,
      thermalShiftSize: null,
      follicularStddev: 0,
      confidence: 'low',
    },
    kegg: {
      peakImpedance: null,
      troughImpedance: null,
      typicalDropSize: null,
      confidence: 'low',
    },
    hormones: {
      e3gFollicularBaseline: null,
      e3gPreOvPeak: null,
      pdgLutealPeak: null,
      pdgOvulationConfirmThreshold: null,
      fshFollicularBaseline: null,
    },
    adaptiveRules: {
      notes: [
        'Not enough cycle history yet to build personalized baselines. Keep logging — we need at least one completed cycle to start tuning.',
      ],
      lhSurgeThresholdSuggestion: 5,
      fertileWindowCdRange: null,
    },
    generatedAt: now,
  };
}

// ──────────────────────────────────────────────────────────────────
// Main computation
// ──────────────────────────────────────────────────────────────────

export function computeBaselines(input: BaselineInput): PersonalBaselines {
  const now = new Date().toISOString();
  const cycles = input.cycles ?? [];
  const readings = input.readings ?? [];

  const completed = cycles.filter(c => c.outcome !== 'ongoing');
  const ongoing = cycles.filter(c => c.outcome === 'ongoing');

  if (completed.length === 0) {
    const base = emptyBaselines(now);
    // Even without completed cycles, we can still estimate a follicular BBT
    // baseline from the current (ongoing) cycle — useful early in TTC journey.
    if (ongoing.length > 0) {
      const ongoingFeats = ongoing.map(c => extractFeatures(c, readings));
      const follicularValues = ongoingFeats.flatMap(f => f.bbtFollicularValues);
      if (follicularValues.length >= 3) {
        base.bbt.follicularBaseline = round(mean(follicularValues), 2);
        base.bbt.follicularStddev = round(stddev(follicularValues), 2);
        base.bbt.confidence = 'low';
        base.adaptiveRules.notes.push(
          `Early follicular BBT baseline from your current cycle: ${base.bbt.follicularBaseline}° (based on ${follicularValues.length} readings).`,
        );
      }
    }
    return base;
  }

  const feats = completed.map(c => extractFeatures(c, readings));
  const sampleSize = feats.length;
  const baseConfidence = confidenceFor(sampleSize);

  // ── Cycle length ────────────────────────────────────────────
  const cycleLengths = feats
    .map(f => f.cycleLength)
    .filter((x): x is number => x != null);
  const clMean = cycleLengths.length > 0 ? round(mean(cycleLengths), 1) : 0;
  const clStddev = cycleLengths.length > 0 ? round(stddev(cycleLengths), 2) : 0;
  const clMin = cycleLengths.length > 0 ? Math.min(...cycleLengths) : 0;
  const clMax = cycleLengths.length > 0 ? Math.max(...cycleLengths) : 0;

  // ── Luteal / Follicular ─────────────────────────────────────
  const lutealDays = feats.map(f => f.lutealDays).filter((x): x is number => x != null);
  const lutealMean = lutealDays.length > 0 ? round(mean(lutealDays), 1) : 0;
  const lutealStddev = lutealDays.length > 0 ? round(stddev(lutealDays), 2) : 0;
  const isShort = lutealDays.length > 0 && lutealMean < 11;

  const follicularDays = feats
    .map(f => f.follicularDays)
    .filter((x): x is number => x != null);
  const follMean = follicularDays.length > 0 ? round(mean(follicularDays), 1) : 0;
  const follStddev = follicularDays.length > 0 ? round(stddev(follicularDays), 2) : 0;

  // ── Ovulation ───────────────────────────────────────────────
  const ovDays = feats.map(f => f.ovulationDay).filter((x): x is number => x != null);
  const typicalOvCd = ovDays.length > 0 ? Math.round(median(ovDays) as number) : null;
  const ovRange: [number, number] | null =
    ovDays.length > 0 ? [Math.min(...ovDays), Math.max(...ovDays)] : null;
  const ovConfidence: Confidence = ovDays.length === 0 ? 'low' : confidenceFor(ovDays.length);

  // ── LH surge ────────────────────────────────────────────────
  const lhPeaks = feats.map(f => f.lhPeakValue).filter((x): x is number => x != null);
  const lhOnsets = feats
    .map(f => f.lhSurgeOnsetCd)
    .filter((x): x is number => x != null);
  const lhDurations = feats
    .map(f => f.lhSurgeDurationDays)
    .filter((x): x is number => x != null);
  const ramps = feats.map(f => f.lhRampStyle).filter(s => s !== 'unknown') as RampStyle[];

  const typicalPeakValue = lhPeaks.length > 0 ? round(mean(lhPeaks), 2) : null;
  const peakValueStddev = lhPeaks.length > 0 ? round(stddev(lhPeaks), 2) : 0;
  const typicalOnsetCd =
    lhOnsets.length > 0 ? Math.round(median(lhOnsets) as number) : null;
  const typicalDuration =
    lhDurations.length > 0 ? round(mean(lhDurations), 1) : null;
  const rampStyle: RampStyle = (modeOf(ramps) as RampStyle | null) ?? 'unknown';
  const lhConfidence = confidenceFor(lhPeaks.length);

  // ── BBT ─────────────────────────────────────────────────────
  const bbtFollValues = feats.flatMap(f => f.bbtFollicularValues);
  const bbtFollMeans = feats
    .map(f => f.bbtFollicularMean)
    .filter((x): x is number => x != null);
  const bbtLutMeans = feats
    .map(f => f.bbtLutealMean)
    .filter((x): x is number => x != null);

  // Allow ongoing cycle to contribute to the follicular baseline (per spec).
  const ongoingBbtFoll = ongoing.flatMap(c => extractFeatures(c, readings).bbtFollicularValues);
  const allFollValues = [...bbtFollValues, ...ongoingBbtFoll];

  const bbtFollicularBaseline =
    allFollValues.length > 0 ? round(mean(allFollValues), 2) : null;
  const bbtLutealBaseline =
    bbtLutMeans.length > 0 ? round(mean(bbtLutMeans), 2) : null;
  const thermalShiftSize =
    bbtFollicularBaseline != null && bbtLutealBaseline != null
      ? round(bbtLutealBaseline - bbtFollicularBaseline, 2)
      : null;
  const bbtFollStddev =
    allFollValues.length > 1 ? round(stddev(allFollValues), 3) : 0;
  const bbtConfidence = confidenceFor(bbtFollMeans.length);

  // ── Kegg ────────────────────────────────────────────────────
  const keggPeaks = feats.map(f => f.keggPeak).filter((x): x is number => x != null);
  const keggTroughs = feats.map(f => f.keggTrough).filter((x): x is number => x != null);
  const keggPeak = keggPeaks.length > 0 ? round(mean(keggPeaks), 2) : null;
  const keggTrough = keggTroughs.length > 0 ? round(mean(keggTroughs), 2) : null;
  const keggDrop =
    keggPeak != null && keggTrough != null ? round(keggPeak - keggTrough, 2) : null;
  const keggConfidence = confidenceFor(keggPeaks.length);

  // ── Hormones ────────────────────────────────────────────────
  const e3gFollBaselines = feats
    .map(f => f.e3gFollicularMean)
    .filter((x): x is number => x != null);
  const e3gPreOvPeaks = feats
    .map(f => f.e3gPreOvPeak)
    .filter((x): x is number => x != null);
  const pdgLutealPeaks = feats
    .map(f => f.pdgLutealPeak)
    .filter((x): x is number => x != null);
  const fshFollBaselines = feats
    .map(f => f.fshFollicularMean)
    .filter((x): x is number => x != null);

  const e3gFollicularBaseline =
    e3gFollBaselines.length > 0 ? round(mean(e3gFollBaselines), 2) : null;
  const e3gPreOvPeakMean =
    e3gPreOvPeaks.length > 0 ? round(mean(e3gPreOvPeaks), 2) : null;
  const pdgLutealPeakMean =
    pdgLutealPeaks.length > 0 ? round(mean(pdgLutealPeaks), 2) : null;
  const fshFollicularBaseline =
    fshFollBaselines.length > 0 ? round(mean(fshFollBaselines), 2) : null;

  // Suggested PdG confirm threshold: 60% of her typical luteal peak,
  // floored at 3 (the classic "ovulation confirmed" minimum).
  const pdgOvulationConfirmThreshold =
    pdgLutealPeakMean != null
      ? round(Math.max(3, pdgLutealPeakMean * 0.6), 1)
      : null;

  // ── Adaptive rules ──────────────────────────────────────────
  const lhSurgeThresholdSuggestion =
    typicalPeakValue != null
      ? clamp(roundToHalf(typicalPeakValue * 0.5), 3, 15)
      : 5;

  const fertileWindowCdRange: [number, number] | null =
    typicalOvCd != null ? [typicalOvCd - 5, typicalOvCd + 1] : null;

  const notes = buildNotes({
    sampleSize,
    typicalPeakValue,
    lhSurgeThresholdSuggestion,
    lutealMean,
    isShort,
    clMean,
    clStddev,
    typicalOvCd,
    rampStyle,
    thermalShiftSize,
    keggDrop,
    pdgLutealPeakMean,
    pdgOvulationConfirmThreshold,
    fshFollicularBaseline,
  });

  return {
    sampleSize,
    cycleLength: {
      mean: clMean,
      stddev: clStddev,
      min: clMin,
      max: clMax,
      confidence: baseConfidence,
    },
    lutealPhase: {
      meanDays: lutealMean,
      stddev: lutealStddev,
      isShort,
      confidence: confidenceFor(lutealDays.length),
    },
    follicularPhase: {
      meanDays: follMean,
      stddev: follStddev,
      confidence: confidenceFor(follicularDays.length),
    },
    ovulation: {
      typicalCycleDay: typicalOvCd,
      cycleDayRange: ovRange,
      confidence: ovConfidence,
    },
    lhSurge: {
      typicalPeakValue,
      typicalSurgeOnsetCd: typicalOnsetCd,
      typicalSurgeDurationDays: typicalDuration,
      rampStyle,
      peakValueStddev,
      confidence: lhConfidence,
    },
    bbt: {
      follicularBaseline: bbtFollicularBaseline,
      lutealBaseline: bbtLutealBaseline,
      thermalShiftSize,
      follicularStddev: bbtFollStddev,
      confidence: bbtConfidence,
    },
    kegg: {
      peakImpedance: keggPeak,
      troughImpedance: keggTrough,
      typicalDropSize: keggDrop,
      confidence: keggConfidence,
    },
    hormones: {
      e3gFollicularBaseline,
      e3gPreOvPeak: e3gPreOvPeakMean,
      pdgLutealPeak: pdgLutealPeakMean,
      pdgOvulationConfirmThreshold,
      fshFollicularBaseline,
    },
    adaptiveRules: {
      notes,
      lhSurgeThresholdSuggestion,
      fertileWindowCdRange,
    },
    generatedAt: now,
  };
}

// ──────────────────────────────────────────────────────────────────
// Notes (plain-English explanations for the UI)
// ──────────────────────────────────────────────────────────────────

interface NoteInputs {
  sampleSize: number;
  typicalPeakValue: number | null;
  lhSurgeThresholdSuggestion: number | null;
  lutealMean: number;
  isShort: boolean;
  clMean: number;
  clStddev: number;
  typicalOvCd: number | null;
  rampStyle: RampStyle;
  thermalShiftSize: number | null;
  keggDrop: number | null;
  pdgLutealPeakMean: number | null;
  pdgOvulationConfirmThreshold: number | null;
  fshFollicularBaseline: number | null;
}

function buildNotes(i: NoteInputs): string[] {
  const notes: string[] = [];

  if (i.sampleSize < 2) {
    notes.push(
      `These baselines are built from ${i.sampleSize} completed cycle${i.sampleSize === 1 ? '' : 's'} — they'll get more accurate as you log more.`,
    );
  }

  // LH peak note — most impactful for surge detection.
  if (i.typicalPeakValue != null) {
    if (i.typicalPeakValue < 15) {
      notes.push(
        `Your LH typically peaks around ${round(i.typicalPeakValue, 1)} mIU/mL (lower than the 25 default) — we've adjusted your surge detection threshold to ${i.lhSurgeThresholdSuggestion} to match.`,
      );
    } else if (i.typicalPeakValue > 40) {
      notes.push(
        `Your LH tends to spike high (around ${round(i.typicalPeakValue, 0)} mIU/mL at peak) — your surges should be easy to catch with a threshold of ${i.lhSurgeThresholdSuggestion}.`,
      );
    } else {
      notes.push(
        `Your LH typically peaks around ${round(i.typicalPeakValue, 1)} mIU/mL — your personal surge threshold is set to ${i.lhSurgeThresholdSuggestion}.`,
      );
    }
  }

  if (i.rampStyle === 'sharp') {
    notes.push(
      `Your LH surge has a sharp ramp — peak hits within 1–2 days of onset, so the fertile window closes fast. Time intercourse right at first rise.`,
    );
  } else if (i.rampStyle === 'gradual') {
    notes.push(
      `Your LH surge builds gradually over 3+ days — you have a longer fertile window than most, but the "peak" moment is easy to miss without daily testing.`,
    );
  } else if (i.rampStyle === 'double-peak') {
    notes.push(
      `Your LH surge shows a double-peak pattern — don't assume ovulation after the first rise. Wait for BBT or PdG to confirm.`,
    );
  }

  // Luteal phase note.
  if (i.lutealMean > 0 && i.isShort) {
    notes.push(
      `Your luteal phase averages ${i.lutealMean} days, which is on the short side (<11) — consider discussing progesterone support with your provider.`,
    );
  } else if (i.lutealMean >= 11 && i.lutealMean <= 16) {
    notes.push(
      `Your luteal phase averages ${i.lutealMean} days — within the healthy range for implantation.`,
    );
  }

  // Cycle length variability.
  if (i.clMean > 0 && i.clStddev >= 4) {
    notes.push(
      `Your cycle length varies by ±${round(i.clStddev, 1)} days — we'll lean on real-time signals (LH, BBT, Kegg) rather than calendar-only predictions.`,
    );
  } else if (i.clMean > 0 && i.clStddev > 0 && i.clStddev < 2) {
    notes.push(
      `Your cycles are very regular (${round(i.clMean, 0)} days ± ${round(i.clStddev, 1)}) — calendar predictions will be reliable for you.`,
    );
  }

  // Ovulation day vs the generic CD14.
  if (i.typicalOvCd != null && Math.abs(i.typicalOvCd - 14) >= 2) {
    notes.push(
      `You typically ovulate around CD${i.typicalOvCd}, not the textbook CD14 — your personalized fertile window is CD${i.typicalOvCd - 5}–CD${i.typicalOvCd + 1}.`,
    );
  }

  // BBT shift.
  if (i.thermalShiftSize != null) {
    if (i.thermalShiftSize < 0.3) {
      notes.push(
        `Your post-ovulation temperature rise is subtle (${i.thermalShiftSize}°) — BBT alone may be unreliable for confirming ovulation; cross-check with PdG or LH.`,
      );
    } else {
      notes.push(
        `Your typical thermal shift after ovulation is ${i.thermalShiftSize}° — a clear BBT rise is a strong ovulation confirmation for you.`,
      );
    }
  }

  // Kegg.
  if (i.keggDrop != null && i.keggDrop > 0) {
    notes.push(
      `Your Kegg impedance drops about ${i.keggDrop} points from dry to fertile — watch for a drop of this magnitude as an early fertile-window signal.`,
    );
  }

  // PdG.
  if (i.pdgOvulationConfirmThreshold != null && i.pdgLutealPeakMean != null) {
    notes.push(
      `Your luteal PdG peaks around ${i.pdgLutealPeakMean} — we use PdG ≥ ${i.pdgOvulationConfirmThreshold} to confirm ovulation for you (personalized).`,
    );
  }

  // FSH.
  if (i.fshFollicularBaseline != null && i.fshFollicularBaseline > 10) {
    notes.push(
      `Your early-follicular FSH averages ${i.fshFollicularBaseline} — somewhat elevated. Worth discussing ovarian reserve with your provider.`,
    );
  }

  return notes;
}

// ──────────────────────────────────────────────────────────────────
// localStorage cache
// ──────────────────────────────────────────────────────────────────

const CACHE_KEY = 'iyla.personalBaselines.v1';

export function saveBaselines(b: PersonalBaselines): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {
    // Quota exceeded or privacy mode — silent fail is correct here.
  }
}

export function getCachedBaselines(): PersonalBaselines | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersonalBaselines;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.generatedAt !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
