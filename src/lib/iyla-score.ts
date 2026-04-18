import { differenceInCalendarDays, parseISO } from 'date-fns';
import type {
  Cycle,
  DailyReading,
  LabResult,
  Supplement,
  SupplementLog,
} from './types';
import { LAB_DEFINITIONS } from './types';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type IylaScoreDomainId =
  | 'regularity'
  | 'hormones'
  | 'lifestyle'
  | 'labs'
  | 'partner';

export type IylaScoreDomainStatus = 'strong' | 'good' | 'fair' | 'watch';

export interface IylaScoreDomain {
  id: IylaScoreDomainId;
  label: string;
  weight: number; // 0-1, sums to 1.0 across all
  score: number; // 0-100
  contributingSignals: Array<{ name: string; score: number; note?: string }>;
  status: IylaScoreDomainStatus;
  note: string;
}

export interface IylaScore {
  total: number; // 0-100, rounded
  delta7Day: number; // change vs 7 days ago, can be negative
  delta30Day: number; // change vs 30 days ago
  grade: 'A' | 'B' | 'C' | 'D' | 'F'; // 85+/70+/55+/40+/below
  domains: IylaScoreDomain[];
  topPositiveFactor: string | null;
  topNegativeFactor: string | null;
  computedAt: string;
  dataCompleteness: number; // 0-1
}

export interface IylaScoreInput {
  cycles: Cycle[];
  readings: DailyReading[];
  labs: LabResult[];
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
}

export interface IylaScoreSnapshot {
  timestamp: string;
  total: number;
  domains: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: Record<IylaScoreDomainId, number> = {
  regularity: 0.2,
  hormones: 0.25,
  lifestyle: 0.2,
  labs: 0.2,
  partner: 0.15,
};

const DOMAIN_LABELS: Record<IylaScoreDomainId, string> = {
  regularity: 'Cycle Regularity',
  hormones: 'Hormone Signals',
  lifestyle: 'Lifestyle',
  labs: 'Lab Optimization',
  partner: 'Partner Factors',
};

const HISTORY_KEY = 'iyla-score-history';
const HISTORY_CAP = 365;

// ─────────────────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────────────────

function clamp(value: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
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

function parseDateSafe(iso: string | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function statusFromScore(score: number): IylaScoreDomainStatus {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  return 'watch';
}

function gradeFromTotal(total: number): IylaScore['grade'] {
  if (total >= 85) return 'A';
  if (total >= 70) return 'B';
  if (total >= 55) return 'C';
  if (total >= 40) return 'D';
  return 'F';
}

function weightedAverage(
  signals: Array<{ score: number; weight?: number }>,
): number {
  if (signals.length === 0) return 0;
  const totalWeight = signals.reduce((a, s) => a + (s.weight ?? 1), 0);
  if (totalWeight === 0) return 0;
  const sum = signals.reduce((a, s) => a + s.score * (s.weight ?? 1), 0);
  return sum / totalWeight;
}

function readingsForCycle(
  cycle: Cycle | undefined,
  allReadings: DailyReading[],
): DailyReading[] {
  if (!cycle?.id) return [];
  return allReadings
    .filter((r) => r.cycleId === cycle.id)
    .sort((a, b) => a.cycleDay - b.cycleDay);
}

function sortedCyclesDesc(cycles: Cycle[]): Cycle[] {
  return [...cycles].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

function getOvulationDay(
  cycle: Cycle,
  cycleReadings: DailyReading[],
): number | null {
  if (cycle.ovulationDay != null) return cycle.ovulationDay;
  const peak = cycleReadings.find(
    (r) => r.fertilityStatus === 'peak' || r.fertilityStatus === 'confirmed_ovulation',
  );
  if (peak) return peak.cycleDay;
  const lhSurge = cycleReadings.find((r) => r.lh != null && r.lh > 15);
  if (lhSurge) return lhSurge.cycleDay;
  return null;
}

function getCycleLengthDays(cycle: Cycle): number | null {
  const start = parseDateSafe(cycle.startDate);
  const end = parseDateSafe(cycle.endDate);
  if (!start || !end) return null;
  return differenceInCalendarDays(end, start);
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Cycle Regularity
// ─────────────────────────────────────────────────────────────────────────

function computeRegularityDomain(
  cycles: Cycle[],
  readings: DailyReading[],
): IylaScoreDomain {
  const signals: IylaScoreDomain['contributingSignals'] = [];

  if (cycles.length < 2) {
    return {
      id: 'regularity',
      label: DOMAIN_LABELS.regularity,
      weight: DEFAULT_WEIGHTS.regularity,
      score: 50,
      contributingSignals: [],
      status: 'fair',
      note: 'Track a full cycle for a regularity score',
    };
  }

  const sortedAsc = [...cycles].sort((a, b) =>
    a.startDate < b.startDate ? -1 : 1,
  );
  const recent = sortedAsc.slice(-6);

  // Cycle length variance (from consecutive cycle starts)
  const lengths: number[] = [];
  for (let i = 0; i < recent.length - 1; i++) {
    const start = parseDateSafe(recent[i].startDate);
    const next = parseDateSafe(recent[i + 1].startDate);
    if (start && next) {
      lengths.push(differenceInCalendarDays(next, start));
    }
  }
  // Supplement a final length from endDate if available
  const lastCycle = recent[recent.length - 1];
  if (lengths.length === 0) {
    const len = getCycleLengthDays(lastCycle);
    if (len != null) lengths.push(len);
  }

  let score = 100;

  if (lengths.length >= 2) {
    const sd = stdDev(lengths);
    if (sd > 3) {
      const penalty = Math.min(30, 2 * sd);
      score -= penalty;
      signals.push({
        name: 'Cycle length variance',
        score: clamp(100 - penalty * 2),
        note: `±${sd.toFixed(1)} days across last ${lengths.length} cycles`,
      });
    } else {
      signals.push({
        name: 'Cycle length variance',
        score: 100,
        note: `±${sd.toFixed(1)} days — consistent`,
      });
    }
  }

  // Ovulation day variance
  const ovDays: number[] = [];
  for (const c of recent) {
    const cReadings = readingsForCycle(c, readings);
    const ov = getOvulationDay(c, cReadings);
    if (ov != null) ovDays.push(ov);
  }

  if (ovDays.length >= 2) {
    const sd = stdDev(ovDays);
    if (sd > 1.5) {
      const penalty = Math.min(25, 2 * sd);
      score -= penalty;
      signals.push({
        name: 'Ovulation day variance',
        score: clamp(100 - penalty * 2),
        note: `±${sd.toFixed(1)} days across ${ovDays.length} cycles`,
      });
    } else {
      signals.push({
        name: 'Ovulation day variance',
        score: 100,
        note: `Predictable ovulation (±${sd.toFixed(1)} days)`,
      });
    }
  }

  // Short luteal phase detection
  let shortLutealCount = 0;
  for (const c of recent) {
    const cReadings = readingsForCycle(c, readings);
    const ov = getOvulationDay(c, cReadings);
    const cycleLen = getCycleLengthDays(c);
    if (ov != null && cycleLen != null) {
      const luteal = cycleLen - ov;
      if (luteal > 0 && luteal < 10) shortLutealCount++;
    }
  }
  if (shortLutealCount > 0) {
    const penalty = Math.min(30, 15 * shortLutealCount);
    score -= penalty;
    signals.push({
      name: 'Short luteal phase',
      score: clamp(100 - penalty * 2),
      note: `${shortLutealCount} cycle${shortLutealCount > 1 ? 's' : ''} under 10 days`,
    });
  }

  // No luteal data at all across all tracked cycles
  const anyOvulationDetected = ovDays.length > 0;
  if (!anyOvulationDetected && cycles.length >= 2) {
    score = 40;
    signals.push({
      name: 'Ovulation detection',
      score: 40,
      note: 'No ovulation signals detected in tracked cycles',
    });
  }

  score = clamp(Math.round(score));

  let note: string;
  if (score >= 85) note = 'Your cycles show strong regularity and predictable ovulation.';
  else if (score >= 70) note = 'Your cycles are mostly consistent with minor variation.';
  else if (score >= 55) note = 'Some variation in cycle length or ovulation timing.';
  else note = 'Cycle regularity needs attention — patterns are unpredictable.';

  return {
    id: 'regularity',
    label: DOMAIN_LABELS.regularity,
    weight: DEFAULT_WEIGHTS.regularity,
    score,
    contributingSignals: signals,
    status: statusFromScore(score),
    note,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Hormone Signals
// ─────────────────────────────────────────────────────────────────────────

function computeHormoneDomain(
  cycles: Cycle[],
  readings: DailyReading[],
): IylaScoreDomain {
  const signals: IylaScoreDomain['contributingSignals'] = [];
  const weightedSignals: Array<{ score: number; weight: number }> = [];

  const desc = sortedCyclesDesc(cycles);
  const focusCycles = desc.slice(0, 3);
  const currentCycle = desc[0];
  const currentReadings = readingsForCycle(currentCycle, readings);
  const currentCycleAgeDays = currentReadings.length > 0
    ? Math.max(...currentReadings.map((r) => r.cycleDay))
    : 0;

  if (cycles.length === 0 || readings.length === 0) {
    return {
      id: 'hormones',
      label: DOMAIN_LABELS.hormones,
      weight: DEFAULT_WEIGHTS.hormones,
      score: 50,
      contributingSignals: [],
      status: 'fair',
      note: 'Add daily readings (LH, BBT, PdG) to score hormone signals',
    };
  }

  // LH surge strength — use the strongest LH seen across focus cycles
  const lhValues = focusCycles.flatMap((c) =>
    readingsForCycle(c, readings)
      .map((r) => r.lh)
      .filter((v): v is number => v != null),
  );
  if (lhValues.length > 0) {
    const peakLh = Math.max(...lhValues);
    let lhScore: number;
    let lhNote: string;
    if (peakLh >= 25) {
      lhScore = 100;
      lhNote = `Peak LH ${peakLh.toFixed(1)} — strong surge`;
    } else if (peakLh >= 15) {
      lhScore = 75;
      lhNote = `Peak LH ${peakLh.toFixed(1)} — clear surge`;
    } else if (peakLh >= 5) {
      lhScore = 50;
      lhNote = `Peak LH ${peakLh.toFixed(1)} — mild surge only`;
    } else if (currentCycleAgeDays > 14) {
      lhScore = 25;
      lhNote = `Peak LH ${peakLh.toFixed(1)} — no surge detected`;
    } else {
      lhScore = 60;
      lhNote = `Peak LH ${peakLh.toFixed(1)} so far — still early`;
    }
    signals.push({ name: 'LH surge strength', score: lhScore, note: lhNote });
    weightedSignals.push({ score: lhScore, weight: 1 });
  }

  // BBT shift clarity — use current cycle primarily
  const bbtReadings = currentReadings.filter((r) => r.bbt != null);
  const ov = currentCycle ? getOvulationDay(currentCycle, currentReadings) : null;
  if (bbtReadings.length >= 3 && ov != null) {
    const preOv = bbtReadings.filter((r) => r.cycleDay <= ov).map((r) => r.bbt!);
    const postOv = bbtReadings
      .filter((r) => r.cycleDay >= ov + 2)
      .map((r) => r.bbt!);
    if (preOv.length >= 1 && postOv.length >= 1) {
      const shift = mean(postOv) - mean(preOv);
      let bbtScore: number;
      let bbtNote: string;
      if (shift >= 0.3) {
        bbtScore = 100;
        bbtNote = `Thermal shift +${shift.toFixed(2)}°F — clear ovulation signature`;
      } else if (shift >= 0.2) {
        bbtScore = 75;
        bbtNote = `Thermal shift +${shift.toFixed(2)}°F — moderate shift`;
      } else if (shift >= 0.1) {
        bbtScore = 50;
        bbtNote = `Weak thermal shift +${shift.toFixed(2)}°F`;
      } else {
        bbtScore = 25;
        bbtNote = `No clear thermal shift (${shift.toFixed(2)}°F)`;
      }
      signals.push({ name: 'BBT shift clarity', score: bbtScore, note: bbtNote });
      weightedSignals.push({ score: bbtScore, weight: 1 });
    } else {
      signals.push({ name: 'BBT shift clarity', score: 50, note: 'Not enough BBT data around ovulation' });
      weightedSignals.push({ score: 50, weight: 1 });
    }
  } else if (bbtReadings.length === 0) {
    signals.push({ name: 'BBT shift clarity', score: 50, note: 'No BBT data' });
    weightedSignals.push({ score: 50, weight: 1 });
  } else {
    signals.push({ name: 'BBT shift clarity', score: 60, note: 'Not enough BBT data yet' });
    weightedSignals.push({ score: 60, weight: 1 });
  }

  // PdG pattern — across focus cycles
  const pdgValues = focusCycles.flatMap((c) =>
    readingsForCycle(c, readings)
      .map((r) => r.pdg)
      .filter((v): v is number => v != null),
  );
  if (pdgValues.length > 0) {
    const peakPdg = Math.max(...pdgValues);
    let pdgScore: number;
    let pdgNote: string;
    if (peakPdg >= 5) {
      pdgScore = 100;
      pdgNote = `Peak PdG ${peakPdg.toFixed(1)} — ovulation confirmed`;
    } else if (peakPdg >= 3) {
      pdgScore = 75;
      pdgNote = `Peak PdG ${peakPdg.toFixed(1)} — rising well`;
    } else if (peakPdg >= 1) {
      // "never measured ≥1 but past ovulation" → this branch has ≥1, so mid
      pdgScore = 50;
      pdgNote = `Peak PdG ${peakPdg.toFixed(1)} — lower than optimal`;
    } else {
      // Never ≥1 but past ovulation
      const pastOv = ov != null && currentCycleAgeDays > ov + 3;
      pdgScore = pastOv ? 25 : 50;
      pdgNote = pastOv
        ? `PdG stayed below 1 post-ovulation — weak luteal support`
        : `PdG still low — may be pre-ovulation`;
    }
    signals.push({ name: 'PdG pattern', score: pdgScore, note: pdgNote });
    weightedSignals.push({ score: pdgScore, weight: 1 });
  } else {
    signals.push({ name: 'PdG pattern', score: 60, note: 'No PdG measurements yet' });
    weightedSignals.push({ score: 60, weight: 1 });
  }

  // Kegg impedance drop (current cycle)
  const keggReadings = currentReadings.filter((r) => r.keggImpedance != null);
  if (keggReadings.length >= 3) {
    const preFertilePeak = Math.max(
      ...keggReadings.filter((r) => r.cycleDay <= 12).map((r) => r.keggImpedance!),
    );
    const lowest = Math.min(...keggReadings.map((r) => r.keggImpedance!));
    const drop = preFertilePeak - lowest;
    let keggScore: number;
    let keggNote: string;
    if (drop > 2.0) {
      keggScore = 100;
      keggNote = `Impedance dropped ${drop.toFixed(1)} — strong fertile-mucus signal`;
    } else if (drop >= 1.0) {
      keggScore = 75;
      keggNote = `Impedance dropped ${drop.toFixed(1)} — moderate`;
    } else {
      keggScore = 50;
      keggNote = `Impedance dropped only ${drop.toFixed(1)}`;
    }
    signals.push({ name: 'Kegg impedance drop', score: keggScore, note: keggNote });
    weightedSignals.push({ score: keggScore, weight: 0.75 });
  } else if (keggReadings.length === 0) {
    // No data → skip (per spec: "No data → 60" — include as 60)
    signals.push({ name: 'Kegg impedance drop', score: 60, note: 'No Kegg data' });
    weightedSignals.push({ score: 60, weight: 0.5 });
  } else {
    signals.push({ name: 'Kegg impedance drop', score: 60, note: 'Building Kegg baseline' });
    weightedSignals.push({ score: 60, weight: 0.5 });
  }

  // Mucus observation (current cycle)
  const mucusObserved = currentReadings
    .map((r) => r.cervicalMucus)
    .filter((m): m is NonNullable<DailyReading['cervicalMucus']> =>
      m != null && m !== 'not_checked',
    );
  if (mucusObserved.length > 0) {
    let mucusScore: number;
    let mucusNote: string;
    if (mucusObserved.includes('egg_white')) {
      mucusScore = 100;
      mucusNote = 'Egg-white mucus observed — peak fertile sign';
    } else if (mucusObserved.includes('watery')) {
      mucusScore = 75;
      mucusNote = 'Watery mucus observed — approaching peak';
    } else {
      mucusScore = 50;
      mucusNote = 'Only dry/sticky/creamy mucus observed';
    }
    signals.push({ name: 'Mucus observation', score: mucusScore, note: mucusNote });
    weightedSignals.push({ score: mucusScore, weight: 0.75 });
  } else {
    signals.push({ name: 'Mucus observation', score: 60, note: 'No mucus observations logged' });
    weightedSignals.push({ score: 60, weight: 0.5 });
  }

  const score = clamp(Math.round(weightedAverage(weightedSignals)));

  // Build note: name strongest + weakest
  const sortedSignals = [...signals].sort((a, b) => b.score - a.score);
  const strongest = sortedSignals[0];
  const weakest = sortedSignals[sortedSignals.length - 1];
  let note: string;
  if (strongest && weakest && strongest.name !== weakest.name) {
    note = `Strongest: ${strongest.name.toLowerCase()}. Weakest: ${weakest.name.toLowerCase()}.`;
  } else if (strongest) {
    note = `Primary signal: ${strongest.name.toLowerCase()}.`;
  } else {
    note = 'Not enough hormone signals to assess.';
  }

  return {
    id: 'hormones',
    label: DOMAIN_LABELS.hormones,
    weight: DEFAULT_WEIGHTS.hormones,
    score,
    contributingSignals: signals,
    status: statusFromScore(score),
    note,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Lifestyle
// ─────────────────────────────────────────────────────────────────────────

function computeLifestyleDomain(
  readings: DailyReading[],
  supplements: Supplement[],
  supplementLogs: SupplementLog[],
): IylaScoreDomain {
  const signals: IylaScoreDomain['contributingSignals'] = [];
  const weightedSignals: Array<{ score: number; weight: number }> = [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const in7d = readings.filter((r) => {
    const d = parseDateSafe(r.date);
    return d != null && d >= sevenDaysAgo && d <= now;
  });
  const in14d = readings.filter((r) => {
    const d = parseDateSafe(r.date);
    return d != null && d >= fourteenDaysAgo && d <= now;
  });

  // Sleep score
  const sleepScores = in7d.map((r) => r.sleepScore).filter((v): v is number => v != null);
  if (sleepScores.length > 0) {
    const avg = mean(sleepScores);
    let s: number;
    if (avg >= 85) s = 100;
    else if (avg >= 70) s = 80;
    else if (avg >= 50) s = 60;
    else s = 40;
    signals.push({
      name: 'Sleep score',
      score: s,
      note: `Avg ${avg.toFixed(0)} over ${sleepScores.length} night${sleepScores.length === 1 ? '' : 's'}`,
    });
    weightedSignals.push({ score: s, weight: 1 });
  } else {
    signals.push({ name: 'Sleep score', score: 60, note: 'No sleep data last 7 days' });
    weightedSignals.push({ score: 60, weight: 0.5 });
  }

  // Deep sleep
  const deepSleep = in7d.map((r) => r.deepSleepMin).filter((v): v is number => v != null);
  if (deepSleep.length > 0) {
    const avg = mean(deepSleep);
    let s: number;
    if (avg >= 90) s = 100;
    else if (avg >= 60) s = 80;
    else s = 60;
    signals.push({
      name: 'Deep sleep',
      score: s,
      note: `Avg ${avg.toFixed(0)} min per night`,
    });
    weightedSignals.push({ score: s, weight: 0.75 });
  } else {
    signals.push({ name: 'Deep sleep', score: 60, note: 'No deep sleep data' });
    weightedSignals.push({ score: 60, weight: 0.5 });
  }

  // Stress days (14d)
  const STRESSED_MOODS: NonNullable<DailyReading['mood']>[] = [
    'stressed',
    'anxious',
    'low',
  ];
  const stressDays = in14d.filter(
    (r) => r.mood != null && STRESSED_MOODS.includes(r.mood),
  ).length;
  let stressScore: number;
  if (stressDays <= 1) stressScore = 100;
  else if (stressDays <= 3) stressScore = 75;
  else if (stressDays <= 6) stressScore = 50;
  else stressScore = 25;
  signals.push({
    name: 'Stress load',
    score: stressScore,
    note: `${stressDays} stressed/low day${stressDays === 1 ? '' : 's'} in last 14`,
  });
  weightedSignals.push({ score: stressScore, weight: 1 });

  // Energy avg
  const energyValues = in7d.map((r) => r.energy).filter((v): v is number => v != null);
  if (energyValues.length > 0) {
    const avg = mean(energyValues);
    let s: number;
    if (avg >= 4) s = 100;
    else if (avg >= 3) s = 80;
    else if (avg >= 2) s = 60;
    else s = 40;
    signals.push({
      name: 'Energy',
      score: s,
      note: `Avg ${avg.toFixed(1)}/5 over last 7 days`,
    });
    weightedSignals.push({ score: s, weight: 0.75 });
  } else {
    signals.push({ name: 'Energy', score: 70, note: 'No energy ratings logged' });
    weightedSignals.push({ score: 70, weight: 0.5 });
  }

  // Supplement adherence
  const activeSupps = supplements.filter((s) => s.isActive);
  if (activeSupps.length > 0) {
    const expectedSlots = activeSupps.reduce(
      (sum, s) => sum + Math.max(1, (s.timing ?? []).length),
      0,
    );
    const expected = expectedSlots * 7;
    const recent = supplementLogs.filter((l) => {
      const d = parseDateSafe(l.date);
      return d != null && d >= sevenDaysAgo && d <= now && l.taken;
    }).length;
    const adherence = expected > 0 ? Math.min(1, recent / expected) : 0;
    let s: number;
    if (adherence >= 0.8) s = 100;
    else if (adherence >= 0.6) s = 80;
    else if (adherence >= 0.4) s = 60;
    else s = 40;
    signals.push({
      name: 'Supplement adherence',
      score: s,
      note: `${Math.round(adherence * 100)}% of planned doses in last 7 days`,
    });
    weightedSignals.push({ score: s, weight: 1 });
  } else {
    signals.push({ name: 'Supplement adherence', score: 70, note: 'No active supplements' });
    weightedSignals.push({ score: 70, weight: 0.5 });
  }

  const score = clamp(Math.round(weightedAverage(weightedSignals)));
  const sortedSignals = [...signals].sort((a, b) => a.score - b.score);
  const weakest = sortedSignals[0];
  let note: string;
  if (score >= 85) note = 'Lifestyle fundamentals are dialed in.';
  else if (score >= 70) note = weakest ? `Mostly on track; focus on ${weakest.name.toLowerCase()}.` : 'Lifestyle looking good.';
  else if (score >= 55) note = weakest ? `Room to improve ${weakest.name.toLowerCase()}.` : 'Lifestyle has room to improve.';
  else note = weakest ? `${weakest.name} is dragging your score down.` : 'Lifestyle needs attention.';

  return {
    id: 'lifestyle',
    label: DOMAIN_LABELS.lifestyle,
    weight: DEFAULT_WEIGHTS.lifestyle,
    score,
    contributingSignals: signals,
    status: statusFromScore(score),
    note,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Lab Optimization
// ─────────────────────────────────────────────────────────────────────────

function computeLabsDomain(labs: LabResult[]): IylaScoreDomain {
  if (labs.length === 0) {
    return {
      id: 'labs',
      label: DOMAIN_LABELS.labs,
      weight: DEFAULT_WEIGHTS.labs,
      score: 50,
      contributingSignals: [],
      status: 'fair',
      note: 'Add lab results to see your optimization score',
    };
  }

  // Latest lab per testName
  const latestByTest = new Map<string, LabResult>();
  for (const lab of labs) {
    const existing = latestByTest.get(lab.testName);
    if (!existing || lab.date > existing.date) {
      latestByTest.set(lab.testName, lab);
    }
  }

  const signals: IylaScoreDomain['contributingSignals'] = [];
  const labScores: number[] = [];

  for (const lab of latestByTest.values()) {
    const def = LAB_DEFINITIONS[lab.testName];
    const optLow = lab.optimalRangeLow ?? def?.optimalLow;
    const optHigh = lab.optimalRangeHigh ?? def?.optimalHigh;
    const refLow = lab.referenceRangeLow ?? def?.refLow;
    const refHigh = lab.referenceRangeHigh ?? def?.refHigh;

    if (optLow == null || optHigh == null) {
      // No optimal range info — treat as neutral mid
      signals.push({
        name: lab.testName,
        score: 70,
        note: `${lab.value} ${lab.unit} — no optimal range defined`,
      });
      labScores.push(70);
      continue;
    }

    let s: number;
    let note: string;
    if (lab.value >= optLow && lab.value <= optHigh) {
      s = 100;
      note = `${lab.value} ${lab.unit} — optimal range`;
    } else if (
      refLow != null &&
      refHigh != null &&
      lab.value >= refLow &&
      lab.value <= refHigh
    ) {
      s = 70;
      note = `${lab.value} ${lab.unit} — in reference but not optimal`;
    } else {
      s = 40;
      note = `${lab.value} ${lab.unit} — outside reference range`;
    }
    signals.push({ name: lab.testName, score: s, note });
    labScores.push(s);
  }

  const score = clamp(Math.round(mean(labScores)));
  const sortedSignals = [...signals].sort((a, b) => a.score - b.score);
  const weakest = sortedSignals[0];
  let note: string;
  if (score >= 85) note = 'Your labs are well-optimized for fertility.';
  else if (score >= 70) note = weakest ? `Most labs strong; watch ${weakest.name}.` : 'Most labs look good.';
  else if (score >= 55) note = weakest ? `${weakest.name} is pulling your lab score down.` : 'Lab optimization has room to improve.';
  else note = weakest ? `${weakest.name} needs attention — discuss with provider.` : 'Several labs are out of range.';

  return {
    id: 'labs',
    label: DOMAIN_LABELS.labs,
    weight: DEFAULT_WEIGHTS.labs,
    score,
    contributingSignals: signals,
    status: statusFromScore(score),
    note,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Partner Factors
// ─────────────────────────────────────────────────────────────────────────

interface PartnerData {
  alcoholFreeDays: number | null;
  hotTubDays: number | null;
  exerciseSessions: number | null;
  supplements: unknown[] | null;
  hasAny: boolean;
}

function readPartnerData(): PartnerData {
  const empty: PartnerData = {
    alcoholFreeDays: null,
    hotTubDays: null,
    exerciseSessions: null,
    supplements: null,
    hasAny: false,
  };

  if (typeof localStorage === 'undefined') return empty;

  const readNum = (k: string): number | null => {
    try {
      const raw = localStorage.getItem(k);
      if (raw == null || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };
  const readArr = (k: string): unknown[] | null => {
    try {
      const raw = localStorage.getItem(k);
      if (raw == null || raw === '') return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const alcoholFreeDays = readNum('iyla_partner_alcohol_free_days');
  const hotTubDays = readNum('iyla_partner_hot_tub_days');
  const exerciseSessions = readNum('iyla_partner_exercise_sessions');
  const supplements = readArr('iyla_partner_supplements');

  const hasAny =
    alcoholFreeDays != null ||
    hotTubDays != null ||
    exerciseSessions != null ||
    (supplements != null && supplements.length > 0);

  return {
    alcoholFreeDays,
    hotTubDays,
    exerciseSessions,
    supplements,
    hasAny,
  };
}

// Mirrors the existing `computeSpermScore` from PartnerDashboard.tsx
function computePartnerCoreScore(
  hotTubDays: number,
  alcoholFreeDays: number,
  exerciseSessions: number,
): number {
  const htScore = Math.min(hotTubDays, 14) / 14;
  const alcScore = Math.min(alcoholFreeDays, 7) / 7;
  const exScore = Math.min(exerciseSessions, 5) / 5;
  return Math.round(htScore * 35 + alcScore * 35 + exScore * 30);
}

function computePartnerDomain(): { domain: IylaScoreDomain; available: boolean } {
  const data = readPartnerData();

  if (!data.hasAny) {
    return {
      available: false,
      domain: {
        id: 'partner',
        label: DOMAIN_LABELS.partner,
        weight: DEFAULT_WEIGHTS.partner,
        score: 50,
        contributingSignals: [],
        status: 'watch',
        note: 'No partner data yet — redistributing weight',
      },
    };
  }

  const signals: IylaScoreDomain['contributingSignals'] = [];
  const alcoholFreeDays = data.alcoholFreeDays ?? 0;
  const hotTubDays = data.hotTubDays ?? 0;
  const exerciseSessions = data.exerciseSessions ?? 0;
  const suppCount = data.supplements?.length ?? 0;

  const core = computePartnerCoreScore(hotTubDays, alcoholFreeDays, exerciseSessions);
  signals.push({
    name: 'Lifestyle score',
    score: core,
    note: `${alcoholFreeDays} alcohol-free / ${hotTubDays} hot-tub / ${exerciseSessions} exercise`,
  });

  let score = core;
  if (suppCount >= 3) {
    score = clamp(score + 5);
    signals.push({
      name: 'Supplement coverage',
      score: 100,
      note: `${suppCount} supplements tracked`,
    });
  } else if (suppCount > 0) {
    signals.push({
      name: 'Supplement coverage',
      score: 60,
      note: `${suppCount} supplement${suppCount === 1 ? '' : 's'} tracked — aim for 3+`,
    });
  }

  score = clamp(Math.round(score));

  let note: string;
  if (score >= 85) note = 'Partner lifestyle signals are strong.';
  else if (score >= 70) note = 'Partner is mostly on track.';
  else if (score >= 55) note = 'Partner has room to improve — heat exposure or alcohol may be factors.';
  else note = 'Partner lifestyle needs attention.';

  return {
    available: true,
    domain: {
      id: 'partner',
      label: DOMAIN_LABELS.partner,
      weight: DEFAULT_WEIGHTS.partner,
      score,
      contributingSignals: signals,
      status: statusFromScore(score),
      note,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Top factors & deltas
// ─────────────────────────────────────────────────────────────────────────

function phraseFactor(
  domain: IylaScoreDomain,
  signal: { name: string; note?: string; score: number },
  positive: boolean,
): string {
  const core = signal.note ?? signal.name;
  if (positive) {
    return `${domain.label}: ${core}`;
  }
  return `${domain.label}: ${core}`;
}

function findTopFactors(domains: IylaScoreDomain[]): {
  pos: string | null;
  neg: string | null;
} {
  let bestPos: { domain: IylaScoreDomain; signal: IylaScoreDomain['contributingSignals'][number] } | null = null;
  let worstNeg: { domain: IylaScoreDomain; signal: IylaScoreDomain['contributingSignals'][number] } | null = null;

  for (const d of domains) {
    for (const s of d.contributingSignals) {
      if (s.score > 75) {
        if (!bestPos || s.score > bestPos.signal.score) bestPos = { domain: d, signal: s };
      }
      if (s.score < 60) {
        if (!worstNeg || s.score < worstNeg.signal.score) worstNeg = { domain: d, signal: s };
      }
    }
  }

  return {
    pos: bestPos ? phraseFactor(bestPos.domain, bestPos.signal, true) : null,
    neg: worstNeg ? phraseFactor(worstNeg.domain, worstNeg.signal, false) : null,
  };
}

function computeDelta(currentTotal: number, daysAgo: number): number {
  const history = getIylaScoreHistory();
  if (history.length === 0) return 0;
  const target = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  let closest: IylaScoreSnapshot | null = null;
  let closestDiff = Infinity;
  for (const snap of history) {
    const d = parseDateSafe(snap.timestamp);
    if (!d) continue;
    const diff = Math.abs(differenceInCalendarDays(d, target));
    if (diff <= 2 && diff < closestDiff) {
      closest = snap;
      closestDiff = diff;
    }
  }
  if (!closest) return 0;
  return currentTotal - closest.total;
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute the unified iyla Score across five weighted domains (cycle regularity,
 * hormone signals, lifestyle, lab optimization, partner factors).
 *
 * If partner data is unavailable in localStorage, the partner domain's 0.15
 * weight is redistributed proportionally to the other four domains.
 */
export function computeIylaScore(input: IylaScoreInput): IylaScore {
  const {
    cycles = [],
    readings = [],
    labs = [],
    supplements = [],
    supplementLogs = [],
  } = input;

  const regularity = computeRegularityDomain(cycles, readings);
  const hormones = computeHormoneDomain(cycles, readings);
  const lifestyle = computeLifestyleDomain(readings, supplements, supplementLogs);
  const labsDomain = computeLabsDomain(labs);
  const partnerResult = computePartnerDomain();

  let domains: IylaScoreDomain[];
  if (partnerResult.available) {
    domains = [regularity, hormones, lifestyle, labsDomain, partnerResult.domain];
  } else {
    // Redistribute partner weight proportionally across the other four
    const others = [regularity, hormones, lifestyle, labsDomain];
    const otherTotalWeight = others.reduce((a, d) => a + d.weight, 0);
    const redistributed = others.map((d) => ({
      ...d,
      weight: d.weight + (d.weight / otherTotalWeight) * DEFAULT_WEIGHTS.partner,
    }));
    domains = [...redistributed, partnerResult.domain];
  }

  // Weighted total — exclude partner domain from the sum if unavailable
  const contributing = partnerResult.available
    ? domains
    : domains.filter((d) => d.id !== 'partner');
  const total = clamp(
    Math.round(contributing.reduce((sum, d) => sum + d.score * d.weight, 0)),
  );

  const { pos, neg } = findTopFactors(contributing);

  const delta7Day = computeDelta(total, 7);
  const delta30Day = computeDelta(total, 30);

  // Data completeness
  const hasCycleData = cycles.length > 0 ? 1 : 0;
  const hasReadings = readings.length > 0 ? 1 : 0;
  const hasLabs = labs.length > 0 ? 1 : 0;
  const hasSupplements = supplements.length > 0 ? 1 : 0;
  const hasPartner = partnerResult.available ? 1 : 0;
  const dataCompleteness =
    (hasCycleData + hasReadings + hasLabs + hasSupplements + hasPartner) / 5;

  return {
    total,
    delta7Day: Math.round(delta7Day),
    delta30Day: Math.round(delta30Day),
    grade: gradeFromTotal(total),
    domains,
    topPositiveFactor: pos,
    topNegativeFactor: neg,
    computedAt: new Date().toISOString(),
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
  };
}

/**
 * Persist a score snapshot to localStorage under `iyla-score-history`.
 * History is capped at the last 365 entries (rolling one year).
 */
export function saveIylaScoreSnapshot(score: IylaScore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const existing = getIylaScoreHistory();
    const domains: Record<string, number> = {};
    for (const d of score.domains) {
      domains[d.id] = d.score;
    }
    const next: IylaScoreSnapshot = {
      timestamp: score.computedAt,
      total: score.total,
      domains,
    };
    existing.push(next);
    const trimmed = existing.slice(-HISTORY_CAP);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently ignore storage errors (quota, privacy mode, etc.)
  }
}

/**
 * Load the rolling history of iyla score snapshots from localStorage.
 * Returns an empty array if no history exists or if storage is unavailable.
 */
export function getIylaScoreHistory(): IylaScoreSnapshot[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is IylaScoreSnapshot =>
        s != null &&
        typeof s === 'object' &&
        typeof s.timestamp === 'string' &&
        typeof s.total === 'number' &&
        s.domains != null &&
        typeof s.domains === 'object',
    );
  } catch {
    return [];
  }
}
