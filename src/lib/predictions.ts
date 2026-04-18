import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Cycle, DailyReading } from './types';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface CyclePredictions {
  nextPeriod: { date: string; confidence: number; range: [string, string] } | null;
  nextOvulation: { date: string; confidence: number; cycleDay: number } | null;
  conceptionOddsThisCycle: number | null;
  bestConceptionDays: Array<{
    date: string;
    cycleDay: number;
    relativeOdds: number;
    reason: string;
  }>;
  fertilePhaseStart: string | null;
  fertilePhaseEnd: string | null;
  averageCycleLength: number | null;
  averageLutealLength: number | null;
  predictionBasis:
    | 'historical'
    | 'current_cycle_signals'
    | 'population_default'
    | 'insufficient_data';
}

export interface PredictionInput {
  cycles: Cycle[];
  readings: DailyReading[];
  currentCycleId: number | null;
  today: string; // ISO
}

// ─────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_LUTEAL_LENGTH = 14;

function parseDateSafe(iso: string | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

function sortedCyclesAsc(cycles: Cycle[]): Cycle[] {
  return [...cycles].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
}

function readingsForCycle(
  cycleId: number | undefined,
  readings: DailyReading[],
): DailyReading[] {
  if (cycleId == null) return [];
  return readings
    .filter((r) => r.cycleId === cycleId)
    .sort((a, b) => a.cycleDay - b.cycleDay);
}

function getCycleLengthDays(cycle: Cycle): number | null {
  const start = parseDateSafe(cycle.startDate);
  const end = parseDateSafe(cycle.endDate);
  if (!start || !end) return null;
  return differenceInCalendarDays(end, start);
}

function detectOvulationDay(
  cycle: Cycle,
  cycleReadings: DailyReading[],
): number | null {
  if (cycle.ovulationDay != null) return cycle.ovulationDay;

  const peak = cycleReadings.find(
    (r) =>
      r.fertilityStatus === 'peak' || r.fertilityStatus === 'confirmed_ovulation',
  );
  if (peak) return peak.cycleDay;

  const lhSurge = cycleReadings.find((r) => r.lh != null && r.lh > 15);
  if (lhSurge) return lhSurge.cycleDay;

  // Triphasic / thermal-shift detection
  const bbtReadings = cycleReadings.filter((r) => r.bbt != null);
  if (bbtReadings.length >= 6) {
    for (let i = 3; i < bbtReadings.length; i++) {
      const prior = bbtReadings.slice(Math.max(0, i - 3), i).map((r) => r.bbt!);
      const baseline = mean(prior);
      const current = bbtReadings[i].bbt!;
      if (current - baseline >= 0.3) {
        return bbtReadings[i].cycleDay - 1;
      }
    }
  }

  const pdgRise = cycleReadings.find((r) => r.pdg != null && r.pdg >= 5);
  if (pdgRise) return Math.max(1, pdgRise.cycleDay - 2);

  return null;
}

function readUserAge(): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('iyla_user_age');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function baseConceptionOddsForAge(age: number | null): number {
  if (age == null) return 25;
  if (age < 30) return 25;
  if (age < 35) return 20;
  if (age < 38) return 15;
  if (age < 41) return 10;
  if (age < 43) return 7;
  return 4;
}

function confidenceFromStdDev(sd: number): number {
  if (sd <= 1) return 95;
  if (sd <= 2) return 80;
  if (sd <= 3) return 65;
  return 50;
}

// Relative odds curve across the fertile window. Keys are "days from ovulation".
// Ovulation day = 0. Negative = before ovulation.
const RELATIVE_ODDS_CURVE: Record<number, { odds: number; reason: string }> = {
  [-5]: { odds: 60, reason: 'Sperm survival window — still possible' },
  [-4]: { odds: 70, reason: 'Sperm survival window — odds rising' },
  [-3]: { odds: 85, reason: 'High fertility — sperm can wait for the egg' },
  [-2]: { odds: 100, reason: 'Peak fertility — sperm ready as ovulation nears' },
  [-1]: { odds: 95, reason: 'Peak fertility — ovulation imminent' },
  [0]: { odds: 90, reason: 'Ovulation day — prime conception window' },
  [1]: { odds: 50, reason: 'Post-ovulation — egg viability declining' },
};

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute cycle predictions (next period, ovulation, fertile window,
 * conception odds, and best conception days) from historical cycles and
 * current-cycle signals.
 *
 * Prefers historical averages when 2+ completed cycles exist; falls back to
 * population defaults (28/14-day cycle) otherwise.
 */
export function computePredictions(input: PredictionInput): CyclePredictions {
  const cycles = input.cycles ?? [];
  const readings = input.readings ?? [];
  const todayDate = parseDateSafe(input.today) ?? new Date();

  if (cycles.length === 0) {
    return {
      nextPeriod: null,
      nextOvulation: null,
      conceptionOddsThisCycle: null,
      bestConceptionDays: [],
      fertilePhaseStart: null,
      fertilePhaseEnd: null,
      averageCycleLength: null,
      averageLutealLength: null,
      predictionBasis: 'insufficient_data',
    };
  }

  const sortedAsc = sortedCyclesAsc(cycles);
  const completed = sortedAsc.filter((c) => c.endDate);

  // Average cycle length
  const cycleLengths: number[] = [];
  for (let i = 0; i < sortedAsc.length - 1; i++) {
    const a = parseDateSafe(sortedAsc[i].startDate);
    const b = parseDateSafe(sortedAsc[i + 1].startDate);
    if (a && b) cycleLengths.push(differenceInCalendarDays(b, a));
  }
  // If we have a completed cycle but no subsequent one, use its own length
  if (cycleLengths.length === 0 && completed.length > 0) {
    const len = getCycleLengthDays(completed[completed.length - 1]);
    if (len != null) cycleLengths.push(len);
  }

  const hasHistorical = cycleLengths.length >= 2;
  const avgCycleLength = hasHistorical ? mean(cycleLengths) : DEFAULT_CYCLE_LENGTH;
  const cycleSd = hasHistorical ? stdDev(cycleLengths) : 3;

  // Average luteal length
  const lutealLengths: number[] = [];
  for (const c of completed) {
    const cReadings = readingsForCycle(c.id, readings);
    const ov = detectOvulationDay(c, cReadings);
    const len = getCycleLengthDays(c);
    if (ov != null && len != null && len - ov > 0) {
      lutealLengths.push(len - ov);
    }
  }
  const hasLuteal = lutealLengths.length >= 1;
  const avgLuteal = hasLuteal ? mean(lutealLengths) : DEFAULT_LUTEAL_LENGTH;

  // Basis
  let basis: CyclePredictions['predictionBasis'];
  if (hasHistorical) basis = 'historical';
  else basis = 'population_default';

  // Current cycle (prefer provided id, else latest cycle)
  const currentCycle =
    sortedAsc.find((c) => c.id === input.currentCycleId) ??
    sortedAsc[sortedAsc.length - 1];
  const currentCycleStart = parseDateSafe(currentCycle.startDate);
  const currentReadings = readingsForCycle(currentCycle.id, readings);

  if (!currentCycleStart) {
    return {
      nextPeriod: null,
      nextOvulation: null,
      conceptionOddsThisCycle: null,
      bestConceptionDays: [],
      fertilePhaseStart: null,
      fertilePhaseEnd: null,
      averageCycleLength: Math.round(avgCycleLength),
      averageLutealLength: Math.round(avgLuteal),
      predictionBasis: basis,
    };
  }

  // Next period
  const nextPeriodDate = addDays(currentCycleStart, Math.round(avgCycleLength));
  const nextPeriodConfidence = confidenceFromStdDev(cycleSd);
  const nextPeriodRange: [string, string] = [
    toISODate(addDays(nextPeriodDate, -Math.max(1, Math.round(cycleSd)))),
    toISODate(addDays(nextPeriodDate, Math.max(1, Math.round(cycleSd)))),
  ];

  // Next ovulation — initial estimate from avg cycle minus avg luteal
  let ovCycleDay = Math.max(1, Math.round(avgCycleLength - avgLuteal));

  // Check for real-time fertility signals
  const todayCycleDay =
    differenceInCalendarDays(todayDate, currentCycleStart) + 1;
  const recentReadings = currentReadings.filter(
    (r) => r.cycleDay >= todayCycleDay - 3 && r.cycleDay <= todayCycleDay,
  );

  const peakLhRecent = recentReadings
    .map((r) => r.lh ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);
  const hasEWCM = recentReadings.some((r) => r.cervicalMucus === 'egg_white');
  const hasWatery = recentReadings.some((r) => r.cervicalMucus === 'watery');
  const keggValues = recentReadings
    .map((r) => r.keggImpedance)
    .filter((v): v is number => v != null);
  const keggDropping =
    keggValues.length >= 2 && keggValues[keggValues.length - 1] < keggValues[0] - 1.0;
  const lhRisingSharply =
    recentReadings.length >= 2 &&
    (recentReadings[recentReadings.length - 1].lh ?? 0) >=
      (recentReadings[0].lh ?? 0) + 5 &&
    peakLhRecent >= 15;

  const strongRealTimeSignal =
    lhRisingSharply || (hasEWCM && (peakLhRecent >= 10 || keggDropping));

  let ovulationConfidence = nextPeriodConfidence;
  let usedRealtime = false;
  if (strongRealTimeSignal && todayCycleDay > 6) {
    // Shift ovulation to likely be in next 1-3 days
    let shift = 2;
    if (peakLhRecent >= 25) shift = 1;
    else if (peakLhRecent >= 15) shift = 1;
    else if (hasEWCM && keggDropping) shift = 2;
    ovCycleDay = todayCycleDay + shift;
    ovulationConfidence = Math.min(98, nextPeriodConfidence + 10);
    usedRealtime = true;
    basis = 'current_cycle_signals';
  }

  // Check for an already-detected ovulation in current cycle
  const detectedOv = detectOvulationDay(currentCycle, currentReadings);
  if (detectedOv != null && detectedOv <= todayCycleDay) {
    ovCycleDay = detectedOv;
    ovulationConfidence = 95;
    usedRealtime = true;
    basis = 'current_cycle_signals';
  }

  const nextOvulationDate = addDays(currentCycleStart, ovCycleDay - 1);

  // Fertile phase: 5 days before through 1 day after ovulation
  const fertileStart = addDays(nextOvulationDate, -5);
  const fertileEnd = addDays(nextOvulationDate, 1);

  // Conception odds this cycle
  let conceptionOdds: number | null;
  const daysFromOv = differenceInCalendarDays(todayDate, nextOvulationDate);

  if (daysFromOv > 1) {
    conceptionOdds = 0;
  } else if (daysFromOv < -5) {
    conceptionOdds = null;
  } else {
    const age = readUserAge();
    let odds = baseConceptionOddsForAge(age);

    // Modifiers
    if (peakLhRecent >= 25) odds *= 1.3;
    if (hasEWCM) odds *= 1.2;

    const bbtShiftSeen = (() => {
      const bbtReadings = currentReadings.filter((r) => r.bbt != null);
      if (bbtReadings.length < 4) return false;
      const baseline = mean(
        bbtReadings.slice(0, Math.max(1, bbtReadings.length - 2)).map((r) => r.bbt!),
      );
      const latest = bbtReadings[bbtReadings.length - 1].bbt!;
      return latest - baseline >= 0.3;
    })();
    const fertileSignalsActive = peakLhRecent >= 10 || hasEWCM || hasWatery || keggDropping;
    if (!bbtShiftSeen && fertileSignalsActive) odds *= 1.1;

    // Intercourse in fertile window
    const intercourseInWindow = currentReadings.some((r) => {
      if (!r.intercourse) return false;
      const d = parseDateSafe(r.date);
      if (!d) return false;
      return d >= fertileStart && d <= fertileEnd;
    });
    if (intercourseInWindow) odds *= 1.2;
    else if (daysFromOv <= 1 && !intercourseInWindow) odds *= 0.9;

    // Recent confirmed ovulation with good luteal length
    const recentGoodCycle = completed.slice(-1).some((c) => {
      const cr = readingsForCycle(c.id, readings);
      const ov = detectOvulationDay(c, cr);
      const len = getCycleLengthDays(c);
      if (ov == null || len == null) return false;
      return len - ov >= 11;
    });
    if (recentGoodCycle) odds *= 1.15;

    conceptionOdds = Math.max(0, Math.min(75, Math.round(odds)));
  }

  // Best conception days (5 days before through 1 day after predicted ovulation)
  const bestDays: CyclePredictions['bestConceptionDays'] = [];
  for (let offset = -5; offset <= 1; offset++) {
    const date = addDays(nextOvulationDate, offset);
    const cycleDay = ovCycleDay + offset;
    if (cycleDay < 1) continue;
    const curve = RELATIVE_ODDS_CURVE[offset];
    if (!curve) continue;

    let odds = curve.odds;
    // Bump odds if EWCM is likely on this day based on history.
    // Simple heuristic: EWCM most likely days -2 to 0 from ovulation.
    if (offset >= -2 && offset <= 0) odds = Math.min(100, odds + 2);

    bestDays.push({
      date: toISODate(date),
      cycleDay,
      relativeOdds: Math.round(odds),
      reason: curve.reason,
    });
  }
  bestDays.sort((a, b) => b.relativeOdds - a.relativeOdds);
  const topBestDays = bestDays.slice(0, 5);

  return {
    nextPeriod: {
      date: toISODate(nextPeriodDate),
      confidence: nextPeriodConfidence,
      range: nextPeriodRange,
    },
    nextOvulation: {
      date: toISODate(nextOvulationDate),
      confidence: ovulationConfidence,
      cycleDay: ovCycleDay,
    },
    conceptionOddsThisCycle: conceptionOdds,
    bestConceptionDays: topBestDays,
    fertilePhaseStart: toISODate(fertileStart),
    fertilePhaseEnd: toISODate(fertileEnd),
    averageCycleLength: Math.round(avgCycleLength),
    averageLutealLength: Math.round(avgLuteal),
    predictionBasis: usedRealtime ? 'current_cycle_signals' : basis,
  };
}