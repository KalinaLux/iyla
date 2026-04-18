import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Cycle, DailyReading, LabResult } from './types';

export interface DetectedPattern {
  id: string;
  severity: 'positive' | 'info' | 'watch' | 'alert';
  category: 'cycle' | 'hormone' | 'lifestyle' | 'lab' | 'pregnancy_signal';
  title: string;
  description: string;
  detail?: string;
  actionable?: string;
  dataPoints: Array<{ label: string; value: string | number }>;
  detectedAt: string;
}

export interface PatternInput {
  cycles: Cycle[];
  readings: DailyReading[];
  labs: LabResult[];
  today: string;
}

// ──────────────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────────────

interface CycleMetrics {
  cycle: Cycle;
  readings: DailyReading[];
  length: number | null;
  ovulationDay: number | null;
  follicularDays: number | null;
  lutealDays: number | null;
  peakLH: number | null;
  peakE3g: number | null;
  peakPdG: number | null;
  hadOvulationSignal: boolean;
  startDate: string;
  endDate: string | null;
}

function safeParse(date: string): Date | null {
  try {
    const d = parseISO(date);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function readingsForCycle(cycle: Cycle, readings: DailyReading[]): DailyReading[] {
  if (cycle.id != null) {
    const byId = readings.filter(r => r.cycleId === cycle.id);
    if (byId.length > 0) return byId.sort((a, b) => a.cycleDay - b.cycleDay);
  }
  const start = safeParse(cycle.startDate);
  const end = cycle.endDate ? safeParse(cycle.endDate) : null;
  if (!start) return [];
  return readings
    .filter(r => {
      const rd = safeParse(r.date);
      if (!rd) return false;
      if (rd < start) return false;
      if (end && rd > end) return false;
      return true;
    })
    .sort((a, b) => a.cycleDay - b.cycleDay);
}

function computeOvulationDay(cycle: Cycle, readings: DailyReading[]): number | null {
  if (cycle.ovulationDay != null) return cycle.ovulationDay;

  // 1) First LH >= 15 (surge day = ovulation day-ish; use surge day itself)
  const lhSurge = readings.find(r => r.lh != null && r.lh >= 15);
  if (lhSurge) return lhSurge.cycleDay;

  // 2) BBT sustained shift: find first day with BBT >= 0.3 above prior 6-day avg, with >=2 days prior data.
  const bbts = readings.filter(r => r.bbt != null);
  if (bbts.length >= 6) {
    for (let i = 4; i < bbts.length; i++) {
      const priorWindow = bbts.slice(Math.max(0, i - 6), i);
      if (priorWindow.length < 3) continue;
      const baseline = mean(priorWindow.map(r => r.bbt!));
      const shift = bbts[i].bbt! - baseline;
      if (shift >= 0.3) {
        // ovulation occurred 1-2 days before thermal shift
        return Math.max(1, bbts[i].cycleDay - 1);
      }
    }
  }

  // 3) First PdG >= 5 indicates post-ovulation; ovulation ~2 days prior
  const pdgRise = readings.find(r => r.pdg != null && r.pdg >= 5);
  if (pdgRise) return Math.max(1, pdgRise.cycleDay - 2);

  return null;
}

function computeCycleLength(cycle: Cycle, readings: DailyReading[]): number | null {
  if (cycle.endDate) {
    const start = safeParse(cycle.startDate);
    const end = safeParse(cycle.endDate);
    if (start && end) return differenceInCalendarDays(end, start);
  }
  if (readings.length > 0) {
    const lastDay = Math.max(...readings.map(r => r.cycleDay));
    return lastDay;
  }
  return null;
}

function buildMetrics(cycle: Cycle, readings: DailyReading[]): CycleMetrics {
  const ovulationDay = computeOvulationDay(cycle, readings);
  const length = computeCycleLength(cycle, readings);
  const lutealDays = ovulationDay != null && length != null ? length - ovulationDay : null;
  const follicularDays = ovulationDay != null ? ovulationDay : null;

  const lhValues = readings.filter(r => r.lh != null).map(r => r.lh!);
  const e3gValues = readings.filter(r => r.e3g != null).map(r => r.e3g!);
  const pdgValues = readings.filter(r => r.pdg != null).map(r => r.pdg!);

  const peakLH = lhValues.length > 0 ? Math.max(...lhValues) : null;
  const peakE3g = e3gValues.length > 0 ? Math.max(...e3gValues) : null;
  const peakPdG = pdgValues.length > 0 ? Math.max(...pdgValues) : null;

  const hadOvulationSignal =
    (peakLH != null && peakLH >= 15) ||
    (peakPdG != null && peakPdG >= 5) ||
    ovulationDay != null;

  return {
    cycle,
    readings,
    length,
    ovulationDay,
    follicularDays,
    lutealDays,
    peakLH,
    peakE3g,
    peakPdG,
    hadOvulationSignal,
    startDate: cycle.startDate,
    endDate: cycle.endDate ?? null,
  };
}

function sortedCompletedMetrics(cycles: Cycle[], readings: DailyReading[]): CycleMetrics[] {
  return cycles
    .filter(c => c.endDate)
    .map(c => buildMetrics(c, readingsForCycle(c, readings)))
    .sort((a, b) => {
      const da = safeParse(a.startDate)?.getTime() ?? 0;
      const db = safeParse(b.startDate)?.getTime() ?? 0;
      return da - db;
    });
}

function findCurrentCycle(cycles: Cycle[]): Cycle | null {
  const open = cycles.filter(c => !c.endDate);
  if (open.length === 0) return null;
  return open.sort((a, b) => {
    const da = safeParse(a.startDate)?.getTime() ?? 0;
    const db = safeParse(b.startDate)?.getTime() ?? 0;
    return db - da;
  })[0];
}

function latestLab(labs: LabResult[], testName: string): LabResult | null {
  const matches = labs.filter(l => l.testName === testName);
  if (matches.length === 0) return null;
  return matches.sort((a, b) => {
    const da = safeParse(a.date)?.getTime() ?? 0;
    const db = safeParse(b.date)?.getTime() ?? 0;
    return db - da;
  })[0];
}

// ──────────────────────────────────────────────────────────────────────
// Detectors — each returns DetectedPattern | null
// ──────────────────────────────────────────────────────────────────────

function detectCycleLengthShift(metrics: CycleMetrics[], today: string): DetectedPattern | null {
  if (metrics.length < 4) return null;
  const lengths = metrics.map(m => m.length).filter((l): l is number => l != null);
  if (lengths.length < 4) return null;

  const last3 = lengths.slice(-3);
  const baseline = lengths.slice(0, -3);
  if (baseline.length === 0) return null;

  const recentAvg = mean(last3);
  const baselineAvg = mean(baseline);
  const diff = recentAvg - baselineAvg;

  if (Math.abs(diff) < 2) return null;

  const direction = diff > 0 ? 'longer' : 'shorter';
  return {
    id: 'cycle-length-shift',
    severity: 'watch',
    category: 'cycle',
    title: `Cycle length has shifted ${direction}`,
    description: `Your last 3 cycles averaged ${round1(recentAvg)} days vs your baseline of ${round1(baselineAvg)} days — a ${round1(Math.abs(diff))}-day drift.`,
    detail: 'Consistent multi-day shifts often track with thyroid changes, cumulative stress, sleep debt, or weight changes.',
    actionable: 'Worth checking thyroid (TSH, Free T3/T4), stress load, and sleep quality over the past month.',
    dataPoints: [
      { label: 'Recent 3-cycle avg', value: `${round1(recentAvg)} d` },
      { label: 'Baseline avg', value: `${round1(baselineAvg)} d` },
      { label: 'Drift', value: `${diff > 0 ? '+' : ''}${round1(diff)} d` },
    ],
    detectedAt: today,
  };
}

function detectShortLutealPhase(metrics: CycleMetrics[], today: string): DetectedPattern | null {
  const recent = metrics.slice(-2);
  const shortOnes = recent.filter(m => m.lutealDays != null && m.lutealDays < 10);
  if (shortOnes.length === 0) return null;

  const shortest = Math.min(...shortOnes.map(m => m.lutealDays!));
  return {
    id: 'short-luteal-phase',
    severity: 'watch',
    category: 'cycle',
    title: 'Short luteal phase detected',
    description: `${shortOnes.length === 1 ? 'Your most recent cycle had' : `${shortOnes.length} of your last 2 cycles had`} a luteal phase under 10 days (shortest: ${shortest} days).`,
    detail: 'A luteal phase <10 days can signal weak progesterone production and reduce implantation window.',
    actionable: 'Consider B6 (P5P 50mg), magnesium glycinate, and discuss progesterone support with your provider.',
    dataPoints: shortOnes.map((m, i) => ({
      label: `Cycle ${i + 1} luteal`,
      value: `${m.lutealDays} d`,
    })),
    detectedAt: today,
  };
}

function detectLutealLengthening(metrics: CycleMetrics[], today: string): DetectedPattern | null {
  const lutealSeries = metrics
    .map(m => m.lutealDays)
    .filter((l): l is number => l != null);
  if (lutealSeries.length < 3) return null;
  const last3 = lutealSeries.slice(-3);
  // Strictly increasing, each step +1 or more
  if (last3[1] - last3[0] < 1) return null;
  if (last3[2] - last3[1] < 1) return null;

  return {
    id: 'luteal-lengthening',
    severity: 'positive',
    category: 'cycle',
    title: 'Luteal phase is lengthening',
    description: `Your luteal phase has grown from ${last3[0]} → ${last3[1]} → ${last3[2]} days across the last 3 cycles.`,
    detail: 'Progressive luteal lengthening is a strong indicator that progesterone production is improving.',
    actionable: 'Whatever you\'re doing (supplements, stress management, sleep) — keep it up.',
    dataPoints: [
      { label: '3 cycles ago', value: `${last3[0]} d` },
      { label: '2 cycles ago', value: `${last3[1]} d` },
      { label: 'Last cycle', value: `${last3[2]} d` },
    ],
    detectedAt: today,
  };
}

function detectRegularCycles(metrics: CycleMetrics[], today: string): DetectedPattern | null {
  if (metrics.length < 3) return null;
  const recent = metrics.slice(-3);
  const lengths = recent.map(m => m.length).filter((l): l is number => l != null);
  if (lengths.length < 3) return null;

  const avg = mean(lengths);
  const withinBand = lengths.every(l => Math.abs(l - avg) <= 2);
  if (!withinBand) return null;

  return {
    id: 'regular-cycles',
    severity: 'positive',
    category: 'cycle',
    title: 'Your cycles are running regular',
    description: `Your last ${lengths.length} cycles are all within ±2 days of your ${round1(avg)}-day average — strong ovulatory rhythm.`,
    detail: 'Cycle-to-cycle consistency is one of the cleanest signals of reliable ovulation.',
    dataPoints: lengths.map((l, i) => ({
      label: `Cycle -${lengths.length - 1 - i}`,
      value: `${l} d`,
    })),
    detectedAt: today,
  };
}

function detectEarlyOvulationShift(metrics: CycleMetrics[], today: string): DetectedPattern | null {
  if (metrics.length < 3) return null;
  const ovDays = metrics.map(m => m.ovulationDay).filter((d): d is number => d != null);
  if (ovDays.length < 3) return null;

  const latest = ovDays[ovDays.length - 1];
  const prior = ovDays.slice(0, -1);
  const priorAvg = mean(prior);
  const diff = priorAvg - latest;

  if (diff < 2) return null;

  return {
    id: 'early-ovulation-shift',
    severity: 'info',
    category: 'cycle',
    title: 'You ovulated earlier this cycle',
    description: `Ovulation landed on CD${latest} — about ${round1(diff)} days earlier than your average of CD${round1(priorAvg)}.`,
    detail: 'Earlier ovulation often reflects stronger follicular recruitment — not necessarily a problem.',
    actionable: 'Next cycle\'s fertile window forecast will shift earlier to match.',
    dataPoints: [
      { label: 'This cycle', value: `CD${latest}` },
      { label: 'Prior avg', value: `CD${round1(priorAvg)}` },
      { label: 'Shift', value: `-${round1(diff)} d` },
    ],
    detectedAt: today,
  };
}

function detectTriphasicBBT(
  currentCycleMetrics: CycleMetrics | null,
  today: string,
): DetectedPattern | null {
  if (!currentCycleMetrics) return null;
  const ov = currentCycleMetrics.ovulationDay;
  if (ov == null) return null;

  const readings = currentCycleMetrics.readings;

  // Need to be at DPO >= 7
  const bbts = readings.filter(r => r.bbt != null);
  if (bbts.length === 0) return null;
  const maxDay = Math.max(...bbts.map(r => r.cycleDay));
  const dpo = maxDay - ov;
  if (dpo < 7) return null;

  const follicular = bbts.filter(r => r.cycleDay <= ov).map(r => r.bbt!);
  const firstLuteal = bbts.filter(r => r.cycleDay > ov && r.cycleDay <= ov + 6).map(r => r.bbt!);
  const secondLuteal = bbts.filter(r => r.cycleDay >= ov + 7 && r.cycleDay <= ov + 10).map(r => r.bbt!);

  if (follicular.length < 2 || firstLuteal.length < 2 || secondLuteal.length < 2) return null;

  const fAvg = mean(follicular);
  const l1Avg = mean(firstLuteal);
  const l2Avg = mean(secondLuteal);

  // First shift already established?
  if (l1Avg - fAvg < 0.3) return null;
  // Second shift?
  if (l2Avg - l1Avg < 0.2) return null;

  return {
    id: 'triphasic-bbt',
    severity: 'info',
    category: 'pregnancy_signal',
    title: 'Triphasic BBT pattern detected',
    description: `Your BBT took a second upward shift around DPO 7, ${round1((l2Avg - l1Avg) * 10) / 10}°F above your first luteal plateau.`,
    detail: 'Triphasic patterns sometimes precede a positive pregnancy test — but they can also occur in non-conception cycles. Not definitive.',
    actionable: 'Worth testing in a few days if you haven\'t already. Continue progesterone support if prescribed.',
    dataPoints: [
      { label: 'Follicular avg', value: `${round1(fAvg * 10) / 10}°F` },
      { label: '1st luteal plateau', value: `${round1(l1Avg * 10) / 10}°F` },
      { label: '2nd luteal plateau', value: `${round1(l2Avg * 10) / 10}°F` },
      { label: '2nd shift', value: `+${round1((l2Avg - l1Avg) * 10) / 10}°F` },
    ],
    detectedAt: today,
  };
}

function detectStrengtheningLHSurge(metrics: CycleMetrics[], today: string): DetectedPattern | null {
  if (metrics.length < 3) return null;
  const peaks = metrics.map(m => m.peakLH).filter((p): p is number => p != null);
  if (peaks.length < 3) return null;

  const latest = peaks[peaks.length - 1];
  const priorMedian = median(peaks.slice(0, -1));
  if (priorMedian <= 0) return null;

  const changePct = ((latest - priorMedian) / priorMedian) * 100;

  if (changePct >= 20) {
    return {
      id: 'strengthening-lh-surge',
      severity: 'positive',
      category: 'hormone',
      title: 'LH surge is getting stronger',
      description: `Your peak LH this cycle (${round1(latest)} mIU/mL) was ${Math.round(changePct)}% above your median of ${round1(priorMedian)}.`,
      detail: 'Stronger LH surges typically correspond to more reliable ovulation and better follicular quality.',
      dataPoints: [
        { label: 'Latest peak', value: `${round1(latest)}` },
        { label: 'Prior median', value: `${round1(priorMedian)}` },
        { label: 'Change', value: `+${Math.round(changePct)}%` },
      ],
      detectedAt: today,
    };
  }

  if (changePct <= -30) {
    return {
      id: 'weakening-lh-surge',
      severity: 'watch',
      category: 'hormone',
      title: 'LH surge is weaker than usual',
      description: `Your peak LH this cycle (${round1(latest)} mIU/mL) was ${Math.round(Math.abs(changePct))}% below your median of ${round1(priorMedian)}.`,
      detail: 'A notably weaker surge can reflect stress, sleep disruption, or sub-optimal follicular development.',
      actionable: 'Check sleep quality and stress over the past 10-14 days. If this repeats, discuss with your provider.',
      dataPoints: [
        { label: 'Latest peak', value: `${round1(latest)}` },
        { label: 'Prior median', value: `${round1(priorMedian)}` },
        { label: 'Change', value: `-${Math.round(Math.abs(changePct))}%` },
      ],
      detectedAt: today,
    };
  }

  return null;
}

function detectWeakLHSurge(metrics: CycleMetrics[], today: string): DetectedPattern | null {
  // Look at most recent cycle (completed or with length >14)
  const last = metrics[metrics.length - 1];
  if (!last) return null;
  if (last.length == null || last.length <= 14) return null;
  if (last.peakLH == null) return null;
  if (last.peakLH >= 15) return null;

  return {
    id: 'weak-lh-surge',
    severity: 'watch',
    category: 'hormone',
    title: 'LH may not be surging strongly',
    description: `Over ${last.length} days, your peak LH only reached ${round1(last.peakLH)} mIU/mL — below the typical 15+ threshold.`,
    detail: 'A shallow LH peak can reflect missed test timing, a sub-threshold surge, or atypical hormone patterns.',
    actionable: 'Test LH twice daily around expected ovulation and cross-check with cervical mucus and BBT.',
    dataPoints: [
      { label: 'Peak LH', value: round1(last.peakLH) },
      { label: 'Cycle length', value: `${last.length} d` },
    ],
    detectedAt: today,
  };
}

function detectAnovulatoryCycle(metrics: CycleMetrics[], today: string): DetectedPattern | null {
  const last = metrics[metrics.length - 1];
  if (!last) return null;
  if (!last.endDate) return null;
  if (last.length == null || last.length < 20) return null; // too short to be confident
  if (last.hadOvulationSignal) return null;

  // Confirm we actually have some data to say "no signal"
  const hasAnyHormone = last.readings.some(r => r.lh != null || r.pdg != null || r.bbt != null);
  if (!hasAnyHormone) return null;

  return {
    id: 'anovulatory-cycle',
    severity: 'alert',
    category: 'hormone',
    title: 'Possible anovulatory cycle',
    description: `Your last cycle (${last.length} days) showed no LH surge, BBT shift, or PdG rise in your logged data.`,
    detail: 'One anovulatory cycle happens to most people occasionally — it\'s not automatically a problem. Recurring ones warrant a workup.',
    actionable: 'If your next cycle is also anovulatory, book a consult — thyroid, prolactin, and AMH would be reasonable to check.',
    dataPoints: [
      { label: 'Cycle length', value: `${last.length} d` },
      { label: 'Peak LH', value: last.peakLH != null ? round1(last.peakLH) : 'n/a' },
      { label: 'Peak PdG', value: last.peakPdG != null ? round1(last.peakPdG) : 'n/a' },
    ],
    detectedAt: today,
  };
}

function detectImplantationDip(
  currentCycleMetrics: CycleMetrics | null,
  today: string,
): DetectedPattern | null {
  if (!currentCycleMetrics) return null;
  const ov = currentCycleMetrics.ovulationDay;
  if (ov == null) return null;

  const bbts = currentCycleMetrics.readings.filter(r => r.bbt != null && r.cycleDay > ov);
  if (bbts.length < 4) return null;

  // Look DPO 6-10
  for (const r of bbts) {
    const dpo = r.cycleDay - ov;
    if (dpo < 6 || dpo > 10) continue;
    // Need previous BBT and recovery BBT
    const prev = bbts.filter(x => x.cycleDay < r.cycleDay);
    const next = bbts.filter(x => x.cycleDay > r.cycleDay);
    if (prev.length < 2 || next.length < 1) continue;
    const priorAvg = mean(prev.slice(-3).map(x => x.bbt!));
    const drop = priorAvg - r.bbt!;
    const recovery = next[0].bbt! - r.bbt!;
    if (drop >= 0.3 && recovery >= 0.2) {
      return {
        id: 'implantation-dip',
        severity: 'info',
        category: 'pregnancy_signal',
        title: `Possible implantation dip at DPO ${dpo}`,
        description: `BBT dropped ${round1(drop * 10) / 10}°F below your luteal baseline on DPO ${dpo}, then recovered the next day.`,
        detail: 'Implantation dips are a loose signal — many pregnant cycles don\'t show one, and many non-pregnant cycles do.',
        actionable: 'If you\'re past 10 DPO, a sensitive pregnancy test may be informative.',
        dataPoints: [
          { label: 'DPO', value: dpo },
          { label: 'Dip depth', value: `-${round1(drop * 10) / 10}°F` },
          { label: 'Recovery', value: `+${round1(recovery * 10) / 10}°F` },
        ],
        detectedAt: today,
      };
    }
  }

  return null;
}

function detectStressCluster(readings: DailyReading[], today: string): DetectedPattern | null {
  const todayDate = safeParse(today);
  if (!todayDate) return null;
  const cutoff = new Date(todayDate.getTime() - 14 * 86400000);

  const recent = readings.filter(r => {
    const d = safeParse(r.date);
    return d != null && d >= cutoff && d <= todayDate;
  });

  const stressDays = recent.filter(r => r.mood === 'stressed' || r.mood === 'anxious').length;
  if (stressDays < 5) return null;

  return {
    id: 'stress-cluster',
    severity: 'watch',
    category: 'lifestyle',
    title: 'High stress load recently',
    description: `${stressDays} of your last ${recent.length || 14} logged days registered as stressed or anxious.`,
    detail: 'Stress elevates cortisol, which directly suppresses the HPO axis and shortens luteal phase.',
    actionable: 'Breathwork, magnesium glycinate before bed, and a walk outside daily can move the needle quickly.',
    dataPoints: [
      { label: 'Stressed days', value: stressDays },
      { label: 'Window', value: '14 d' },
    ],
    detectedAt: today,
  };
}

function detectPoorSleep(readings: DailyReading[], today: string): DetectedPattern | null {
  const todayDate = safeParse(today);
  if (!todayDate) return null;
  const cutoff = new Date(todayDate.getTime() - 7 * 86400000);

  const recent = readings.filter(r => {
    const d = safeParse(r.date);
    return d != null && d >= cutoff && d <= todayDate;
  });

  const scores = recent.map(r => r.sleepScore).filter((s): s is number => s != null);
  const deeps = recent.map(r => r.deepSleepMin).filter((s): s is number => s != null);

  if (scores.length < 3 && deeps.length < 3) return null;

  const avgScore = scores.length > 0 ? mean(scores) : null;
  const avgDeep = deeps.length > 0 ? mean(deeps) : null;

  const lowScore = avgScore != null && avgScore < 60;
  const lowDeep = avgDeep != null && avgDeep < 60;

  if (!lowScore && !lowDeep) return null;

  const parts: string[] = [];
  if (avgScore != null) parts.push(`sleep score avg ${Math.round(avgScore)}`);
  if (avgDeep != null) parts.push(`deep sleep avg ${Math.round(avgDeep)} min`);

  return {
    id: 'poor-sleep',
    severity: 'watch',
    category: 'lifestyle',
    title: 'Sleep quality has dropped',
    description: `Over the past 7 days: ${parts.join(' and ')}.`,
    detail: 'Poor sleep disrupts LH pulse timing and reduces morning cortisol recovery — both matter for cycle quality.',
    actionable: 'Prioritize a consistent bedtime, cool/dark room, and magnesium glycinate 30 min before bed.',
    dataPoints: [
      ...(avgScore != null ? [{ label: 'Sleep score', value: Math.round(avgScore) }] : []),
      ...(avgDeep != null ? [{ label: 'Deep sleep', value: `${Math.round(avgDeep)} min` }] : []),
    ],
    detectedAt: today,
  };
}

function detectImprovingSleep(readings: DailyReading[], today: string): DetectedPattern | null {
  const todayDate = safeParse(today);
  if (!todayDate) return null;
  const recentCut = new Date(todayDate.getTime() - 7 * 86400000);
  const priorCut = new Date(todayDate.getTime() - 14 * 86400000);

  const recent = readings.filter(r => {
    const d = safeParse(r.date);
    return d != null && d >= recentCut && d <= todayDate;
  });
  const prior = readings.filter(r => {
    const d = safeParse(r.date);
    return d != null && d >= priorCut && d < recentCut;
  });

  const recentScores = recent.map(r => r.sleepScore).filter((s): s is number => s != null);
  const priorScores = prior.map(r => r.sleepScore).filter((s): s is number => s != null);

  if (recentScores.length < 3 || priorScores.length < 3) return null;

  const recentAvg = mean(recentScores);
  const priorAvg = mean(priorScores);
  const diff = recentAvg - priorAvg;

  if (diff < 10) return null;

  return {
    id: 'improving-sleep',
    severity: 'positive',
    category: 'lifestyle',
    title: 'Sleep is trending up',
    description: `Your sleep score is averaging ${Math.round(recentAvg)} this week, up ${Math.round(diff)} points from the week before.`,
    detail: 'Better sleep supports LH pulsing, growth hormone release, and egg maturation.',
    dataPoints: [
      { label: 'This week', value: Math.round(recentAvg) },
      { label: 'Previous week', value: Math.round(priorAvg) },
      { label: 'Change', value: `+${Math.round(diff)}` },
    ],
    detectedAt: today,
  };
}

function detectSuboptimalTSH(labs: LabResult[], today: string): DetectedPattern | null {
  const tsh = latestLab(labs, 'TSH');
  if (!tsh) return null;
  if (tsh.value <= 2.5) return null;

  return {
    id: 'suboptimal-tsh',
    severity: 'watch',
    category: 'lab',
    title: 'TSH above TTC optimal',
    description: `Your most recent TSH is ${round1(tsh.value)} mIU/L — above the TTC-optimal ceiling of 2.5.`,
    detail: 'Sub-clinical hypothyroidism (TSH >2.5) is associated with lower conception rates and higher early loss risk.',
    actionable: 'Discuss with your provider — selenium (200mcg), iodine from food, and thyroid medication may be on the table.',
    dataPoints: [
      { label: 'TSH', value: `${round1(tsh.value)} ${tsh.unit}` },
      { label: 'TTC optimal', value: '< 2.5' },
      { label: 'Drawn', value: tsh.date },
    ],
    detectedAt: today,
  };
}

function detectLowVitaminD(labs: LabResult[], today: string): DetectedPattern | null {
  const vd = latestLab(labs, 'Vitamin D');
  if (!vd) return null;
  if (vd.value >= 50) return null;

  return {
    id: 'low-vitamin-d',
    severity: 'watch',
    category: 'lab',
    title: 'Vitamin D below TTC optimal',
    description: `Your Vitamin D is ${round1(vd.value)} ng/mL — below the TTC-optimal range of 50-80.`,
    detail: 'Low vitamin D correlates with lower AMH, reduced implantation rates, and immune dysregulation.',
    actionable: 'Consider D3 5,000 IU + K2 100mcg daily with a fat-containing meal. Retest in 8-12 weeks.',
    dataPoints: [
      { label: 'Vitamin D', value: `${round1(vd.value)} ng/mL` },
      { label: 'TTC optimal', value: '50-80' },
      { label: 'Drawn', value: vd.date },
    ],
    detectedAt: today,
  };
}

function detectHighProlactin(labs: LabResult[], today: string): DetectedPattern | null {
  const pr = latestLab(labs, 'Prolactin');
  if (!pr) return null;
  const refHigh = pr.referenceRangeHigh ?? 23.3;
  if (pr.value <= 15 && pr.value <= refHigh) return null;

  return {
    id: 'high-prolactin',
    severity: 'watch',
    category: 'lab',
    title: 'Prolactin elevated',
    description: `Your prolactin is ${round1(pr.value)} ng/mL — ${pr.value > refHigh ? `above the reference ceiling of ${refHigh}` : 'above the TTC-optimal 15 ng/mL'}.`,
    detail: 'Elevated prolactin suppresses GnRH, which can delay or prevent ovulation entirely.',
    actionable: 'Confirm with a fasted, rested AM draw (prolactin is pulsatile). If confirmed, discuss causes with your provider.',
    dataPoints: [
      { label: 'Prolactin', value: `${round1(pr.value)} ng/mL` },
      { label: 'Ref high', value: refHigh },
      { label: 'Drawn', value: pr.date },
    ],
    detectedAt: today,
  };
}

function detectLowAMH(labs: LabResult[], today: string): DetectedPattern | null {
  const amh = latestLab(labs, 'AMH');
  if (!amh) return null;
  if (amh.value >= 1.0) return null;

  return {
    id: 'low-amh',
    severity: 'watch',
    category: 'lab',
    title: 'AMH indicates diminished reserve',
    description: `Your AMH is ${round1(amh.value)} ng/mL — below the 1.0 threshold often used for diminished ovarian reserve.`,
    detail: 'AMH reflects remaining follicle count, not egg quality. Quality can still be improved.',
    actionable: 'Consider a DOR-focused egg quality protocol: CoQ10 600mg, melatonin 3mg at bedtime, DHEA 25mg (if labs support), and a reproductive endocrinologist consult.',
    dataPoints: [
      { label: 'AMH', value: `${round1(amh.value)} ng/mL` },
      { label: 'DOR threshold', value: '< 1.0' },
      { label: 'Drawn', value: amh.date },
    ],
    detectedAt: today,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Aggregator
// ──────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<DetectedPattern['severity'], number> = {
  alert: 0,
  watch: 1,
  info: 2,
  positive: 3,
};

export function detectPatterns(input: PatternInput): DetectedPattern[] {
  const { cycles, readings, labs, today } = input;

  const metrics = sortedCompletedMetrics(cycles, readings);
  const currentCycle = findCurrentCycle(cycles);
  const currentMetrics = currentCycle
    ? buildMetrics(currentCycle, readingsForCycle(currentCycle, readings))
    : null;

  const detectors: Array<DetectedPattern | null> = [
    detectCycleLengthShift(metrics, today),
    detectShortLutealPhase(metrics, today),
    detectLutealLengthening(metrics, today),
    detectRegularCycles(metrics, today),
    detectEarlyOvulationShift(metrics, today),
    detectTriphasicBBT(currentMetrics, today),
    detectStrengtheningLHSurge(metrics, today),
    detectWeakLHSurge(metrics, today),
    detectAnovulatoryCycle(metrics, today),
    detectImplantationDip(currentMetrics, today),
    detectStressCluster(readings, today),
    detectPoorSleep(readings, today),
    detectImprovingSleep(readings, today),
    detectSuboptimalTSH(labs, today),
    detectLowVitaminD(labs, today),
    detectHighProlactin(labs, today),
    detectLowAMH(labs, today),
  ];

  return detectors
    .filter((p): p is DetectedPattern => p != null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
