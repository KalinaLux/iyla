import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Cycle, DailyReading, SupplementLog } from './types';

export interface Correlation {
  id: string;
  strength: 'strong' | 'moderate' | 'weak';
  direction: 'positive' | 'negative';
  confidence: number;
  title: string;
  narrative: string;
  xLabel: string;
  yLabel: string;
  samplePoints: Array<{ x: number; y: number }>;
  sampleSize: number;
  r: number;
}

export interface CorrelationInput {
  cycles: Cycle[];
  readings: DailyReading[];
  supplementLogs: SupplementLog[];
}

// ──────────────────────────────────────────────────────────────────────
// Stats
// ──────────────────────────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;

  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0 || !isFinite(denom)) return 0;
  const r = num / denom;
  if (!isFinite(r)) return 0;
  return Math.max(-1, Math.min(1, r));
}

function confidenceFromR(r: number, n: number): number {
  if (n < 3) return 0;
  const raw = (Math.abs(r) * Math.sqrt(Math.max(0, n - 2))) / 3;
  return Math.max(0, Math.min(1, raw));
}

function strengthFromR(r: number): 'strong' | 'moderate' | 'weak' | null {
  const abs = Math.abs(r);
  if (abs >= 0.6) return 'strong';
  if (abs >= 0.3) return 'moderate';
  if (abs >= 0.1) return 'weak';
  return null;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return mean(xs.map(x => (x - m) ** 2));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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

// ──────────────────────────────────────────────────────────────────────
// Per-cycle metric builder
// ──────────────────────────────────────────────────────────────────────

interface CycleStats {
  cycle: Cycle;
  readings: DailyReading[];
  length: number | null;
  ovulationDay: number | null;
  lutealDays: number | null;
  follicularReadings: DailyReading[];
  follicularStressDays: number;
  follicularSleepScoreAvg: number | null;
  follicularDeepSleepAvg: number | null;
  follicularEnergyAvg: number | null;
  follicularBBTVariance: number | null;
  peakLH: number | null;
  adherenceOverall: number | null;
  adherenceFollicular: number | null;
  fertileWindowIntercourse: number | null;
  outcome: Cycle['outcome'];
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

  const lhSurge = readings.find(r => r.lh != null && r.lh >= 15);
  if (lhSurge) return lhSurge.cycleDay;

  const bbts = readings.filter(r => r.bbt != null);
  if (bbts.length >= 6) {
    for (let i = 4; i < bbts.length; i++) {
      const priorWindow = bbts.slice(Math.max(0, i - 6), i);
      if (priorWindow.length < 3) continue;
      const baseline = mean(priorWindow.map(r => r.bbt!));
      const shift = bbts[i].bbt! - baseline;
      if (shift >= 0.3) return Math.max(1, bbts[i].cycleDay - 1);
    }
  }

  const pdgRise = readings.find(r => r.pdg != null && r.pdg >= 5);
  if (pdgRise) return Math.max(1, pdgRise.cycleDay - 2);

  return null;
}

function computeAdherence(
  cycle: Cycle,
  logs: SupplementLog[],
  cycleEnd: Date,
  phaseEnd?: Date,
): number | null {
  const start = safeParse(cycle.startDate);
  if (!start) return null;
  const end = phaseEnd ?? cycleEnd;
  const windowLogs = logs.filter(l => {
    const d = safeParse(l.date);
    return d != null && d >= start && d <= end;
  });
  if (windowLogs.length === 0) return null;
  const taken = windowLogs.filter(l => l.taken).length;
  return taken / windowLogs.length;
}

function buildCycleStats(
  cycle: Cycle,
  readings: DailyReading[],
  supplementLogs: SupplementLog[],
): CycleStats {
  const ownReadings = readingsForCycle(cycle, readings);
  const ovulationDay = computeOvulationDay(cycle, ownReadings);

  const start = safeParse(cycle.startDate);
  const end = cycle.endDate ? safeParse(cycle.endDate) : null;
  const length = start && end ? differenceInCalendarDays(end, start) : null;
  const lutealDays = length != null && ovulationDay != null ? length - ovulationDay : null;

  const follicular = ovulationDay != null
    ? ownReadings.filter(r => r.cycleDay <= ovulationDay)
    : ownReadings;

  const follicularStressDays = follicular.filter(r => r.mood === 'stressed' || r.mood === 'anxious').length;

  const sleepScores = follicular.map(r => r.sleepScore).filter((s): s is number => s != null);
  const deepSleeps = follicular.map(r => r.deepSleepMin).filter((s): s is number => s != null);
  const energies = follicular.map(r => r.energy).filter((s): s is number => s != null);
  const bbts = follicular.map(r => r.bbt).filter((s): s is number => s != null);

  const lhValues = ownReadings.map(r => r.lh).filter((s): s is number => s != null);
  const peakLH = lhValues.length > 0 ? Math.max(...lhValues) : null;

  // Adherence
  const cycleEnd = end ?? start ?? new Date();
  const phaseEndDate = ovulationDay != null && start
    ? new Date(start.getTime() + ovulationDay * 86400000)
    : undefined;

  const adherenceOverall = start
    ? computeAdherence(cycle, supplementLogs, cycleEnd)
    : null;
  const adherenceFollicular = start
    ? computeAdherence(cycle, supplementLogs, cycleEnd, phaseEndDate)
    : null;

  // Intercourse in fertile window (ov-5 to ov+1)
  let fertileWindowIntercourse: number | null = null;
  if (ovulationDay != null) {
    fertileWindowIntercourse = ownReadings.filter(
      r => r.cycleDay >= ovulationDay - 5 && r.cycleDay <= ovulationDay + 1 && r.intercourse === true,
    ).length;
  }

  return {
    cycle,
    readings: ownReadings,
    length,
    ovulationDay,
    lutealDays,
    follicularReadings: follicular,
    follicularStressDays,
    follicularSleepScoreAvg: sleepScores.length >= 3 ? mean(sleepScores) : null,
    follicularDeepSleepAvg: deepSleeps.length >= 3 ? mean(deepSleeps) : null,
    follicularEnergyAvg: energies.length >= 3 ? mean(energies) : null,
    follicularBBTVariance: bbts.length >= 3 ? variance(bbts) : null,
    peakLH,
    adherenceOverall,
    adherenceFollicular,
    fertileWindowIntercourse,
    outcome: cycle.outcome,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Individual correlation builders
// ──────────────────────────────────────────────────────────────────────

interface PairExtractor {
  id: string;
  title: string;
  xLabel: string;
  yLabel: string;
  direction?: 'positive' | 'negative'; // expected/sign override for narrative — actual sign drives output
  extract: (stats: CycleStats) => { x: number; y: number } | null;
  narrative: (
    r: number,
    points: Array<{ x: number; y: number }>,
  ) => string;
  requireOutcome?: 'positive';
}

function buildCorrelation(
  extractor: PairExtractor,
  cycleStats: CycleStats[],
): Correlation | null {
  const filtered = extractor.requireOutcome
    ? cycleStats.filter(s => s.outcome === extractor.requireOutcome)
    : cycleStats;

  if (extractor.requireOutcome && filtered.length === 0) return null;

  const pairs = cycleStats
    .map(s => extractor.extract(s))
    .filter((p): p is { x: number; y: number } => p != null);

  if (pairs.length < 3) return null;

  const xs = pairs.map(p => p.x);
  const ys = pairs.map(p => p.y);

  // Avoid undefined correlation when no variance
  if (variance(xs) === 0 || variance(ys) === 0) return null;

  const r = pearson(xs, ys);
  const strength = strengthFromR(r);
  if (strength == null || strength === 'weak') return null;

  const direction: 'positive' | 'negative' = r >= 0 ? 'positive' : 'negative';
  const confidence = confidenceFromR(r, pairs.length);

  return {
    id: extractor.id,
    strength,
    direction,
    confidence,
    title: extractor.title,
    narrative: extractor.narrative(r, pairs),
    xLabel: extractor.xLabel,
    yLabel: extractor.yLabel,
    samplePoints: pairs,
    sampleSize: pairs.length,
    r,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

export function findCorrelations(input: CorrelationInput): Correlation[] {
  const { cycles, readings, supplementLogs } = input;

  const completed = cycles.filter(c => c.endDate);
  if (completed.length < 3) return [];

  const allStats = completed
    .map(c => buildCycleStats(c, readings, supplementLogs))
    .sort((a, b) => {
      const da = safeParse(a.cycle.startDate)?.getTime() ?? 0;
      const db = safeParse(b.cycle.startDate)?.getTime() ?? 0;
      return da - db;
    });

  const cycleLengths = allStats.map(s => s.length).filter((l): l is number => l != null);
  const avgCycleLen = cycleLengths.length > 0 ? mean(cycleLengths) : null;

  const extractors: PairExtractor[] = [
    // 1. Supplement adherence → cycle regularity (|length - avg|)
    {
      id: 'adherence-cycle-regularity',
      title: 'Supplement adherence and cycle regularity',
      xLabel: 'Supplement adherence (%)',
      yLabel: 'Cycle length deviation (days)',
      extract: s => {
        if (s.adherenceOverall == null || s.length == null || avgCycleLen == null) return null;
        return { x: s.adherenceOverall * 100, y: Math.abs(s.length - avgCycleLen) };
      },
      narrative: (r, pts) => {
        const highAdh = pts.filter(p => p.x >= 80);
        const lowAdh = pts.filter(p => p.x < 80);
        const highDev = highAdh.length > 0 ? round1(mean(highAdh.map(p => p.y))) : null;
        const lowDev = lowAdh.length > 0 ? round1(mean(lowAdh.map(p => p.y))) : null;
        const dir = r < 0
          ? 'higher adherence tracks with tighter cycle regularity'
          : 'adherence has tracked with more variable cycles so far';
        const detail = highDev != null && lowDev != null
          ? ` On ≥80% adherence, cycles landed within ${highDev} days of your average vs ${lowDev} days on lower adherence.`
          : '';
        return `Across ${pts.length} cycles, ${dir} (r = ${round1(r * 100) / 100}).${detail}`;
      },
    },

    // 2. Follicular adherence → luteal phase length
    {
      id: 'follicular-adherence-luteal',
      title: 'Follicular supplement adherence and luteal phase length',
      xLabel: 'Follicular adherence (%)',
      yLabel: 'Luteal phase (days)',
      extract: s => {
        if (s.adherenceFollicular == null || s.lutealDays == null) return null;
        return { x: s.adherenceFollicular * 100, y: s.lutealDays };
      },
      narrative: (r, pts) => {
        const high = pts.filter(p => p.x >= 80);
        const low = pts.filter(p => p.x < 80);
        const highLen = high.length > 0 ? round1(mean(high.map(p => p.y))) : null;
        const lowLen = low.length > 0 ? round1(mean(low.map(p => p.y))) : null;
        const detail = highLen != null && lowLen != null
          ? ` Cycles with ≥80% follicular adherence averaged ${highLen}-day luteal phase vs ${lowLen} with lower adherence.`
          : '';
        const dir = r >= 0
          ? 'Pre-ovulatory supplement consistency tracks with a longer luteal phase'
          : 'An inverse relationship showed up this window';
        return `${dir} (r = ${round1(r * 100) / 100}, n = ${pts.length}).${detail}`;
      },
    },

    // 3. Stress days → luteal phase length
    {
      id: 'stress-luteal-length',
      title: 'Stress days and luteal phase length',
      xLabel: 'Stressed/anxious days in follicular phase',
      yLabel: 'Luteal phase (days)',
      extract: s => {
        if (s.lutealDays == null) return null;
        return { x: s.follicularStressDays, y: s.lutealDays };
      },
      narrative: (r, pts) => {
        // Compare healthy luteal vs short luteal
        const healthy = pts.filter(p => p.y >= 12);
        const short = pts.filter(p => p.y < 12);
        const healthyStress = healthy.length > 0 ? round1(mean(healthy.map(p => p.x))) : null;
        const shortStress = short.length > 0 ? round1(mean(short.map(p => p.x))) : null;
        const detail = healthyStress != null && shortStress != null
          ? ` Your healthiest luteal phases averaged ${healthyStress} stressed days, vs ${shortStress} in cycles with shorter luteal phases.`
          : '';
        const dir = r < 0
          ? 'More stressed days in your follicular phase track with a shorter luteal phase'
          : 'Stress days have not yet dragged down luteal length in your data';
        return `${dir} (r = ${round1(r * 100) / 100}, n = ${pts.length}).${detail}`;
      },
    },

    // 4. Sleep score → BBT stability (inverse — higher score = lower variance)
    {
      id: 'sleep-bbt-stability',
      title: 'Sleep quality and BBT stability',
      xLabel: 'Follicular sleep score avg',
      yLabel: 'BBT variance (°F²)',
      extract: s => {
        if (s.follicularSleepScoreAvg == null || s.follicularBBTVariance == null) return null;
        return { x: s.follicularSleepScoreAvg, y: s.follicularBBTVariance };
      },
      narrative: (r, pts) => {
        const dir = r < 0
          ? 'Better sleep tracks with a steadier follicular BBT'
          : 'Sleep and BBT variance are moving together in your data';
        const avgSleep = round1(mean(pts.map(p => p.x)));
        return `${dir} across ${pts.length} cycles (r = ${round1(r * 100) / 100}). Your follicular sleep score averaged ${avgSleep}.`;
      },
    },

    // 5. Deep sleep → LH surge strength
    {
      id: 'deep-sleep-lh-peak',
      title: 'Deep sleep and LH surge strength',
      xLabel: 'Pre-ovulatory deep sleep avg (min)',
      yLabel: 'Peak LH (mIU/mL)',
      extract: s => {
        if (s.follicularDeepSleepAvg == null || s.peakLH == null) return null;
        return { x: s.follicularDeepSleepAvg, y: s.peakLH };
      },
      narrative: (r, pts) => {
        const avgDeep = Math.round(mean(pts.map(p => p.x)));
        const avgLH = round1(mean(pts.map(p => p.y)));
        const dir = r >= 0
          ? 'Deeper sleep before ovulation tracks with a stronger LH surge'
          : 'In your data, more deep sleep has not yet translated into a bigger LH peak';
        return `${dir} (r = ${round1(r * 100) / 100}, n = ${pts.length}). Deep sleep averaged ${avgDeep} min; peak LH averaged ${avgLH}.`;
      },
    },

    // 6. Energy → cycle length deviation (inverse — higher energy = less deviation)
    {
      id: 'energy-cycle-consistency',
      title: 'Energy levels and cycle consistency',
      xLabel: 'Avg energy (1-5)',
      yLabel: 'Cycle length deviation (days)',
      extract: s => {
        if (s.follicularEnergyAvg == null || s.length == null || avgCycleLen == null) return null;
        return { x: s.follicularEnergyAvg, y: Math.abs(s.length - avgCycleLen) };
      },
      narrative: (r, pts) => {
        const dir = r < 0
          ? 'Higher average energy tracks with more consistent cycle length'
          : 'Energy and cycle deviation are moving in parallel here';
        const avgE = round1(mean(pts.map(p => p.x)));
        return `${dir} (r = ${round1(r * 100) / 100}, n = ${pts.length}). Average logged energy across those cycles was ${avgE}/5.`;
      },
    },

    // 7. Intercourse frequency in fertile window → conception outcome
    {
      id: 'intercourse-conception',
      title: 'Fertile-window intercourse and cycle outcome',
      xLabel: 'Intercourse days in fertile window',
      yLabel: 'Conception outcome (1 = positive)',
      extract: s => {
        if (s.fertileWindowIntercourse == null) return null;
        const y = s.outcome === 'positive' ? 1 : 0;
        return { x: s.fertileWindowIntercourse, y };
      },
      narrative: (r, pts) => {
        const pos = pts.filter(p => p.y === 1);
        const neg = pts.filter(p => p.y === 0);
        const posAvg = pos.length > 0 ? round1(mean(pos.map(p => p.x))) : null;
        const negAvg = neg.length > 0 ? round1(mean(neg.map(p => p.x))) : null;
        const detail = posAvg != null && negAvg != null
          ? ` Cycles that resulted in a positive test averaged ${posAvg} fertile-window intercourse days vs ${negAvg} in cycles that didn't.`
          : '';
        return `Looking at ${pts.length} cycles (r = ${round1(r * 100) / 100}).${detail}`;
      },
    },
  ];

  // Only include intercourse-conception if we have at least one positive cycle
  const hasPositive = allStats.some(s => s.outcome === 'positive');

  const correlations = extractors
    .filter(e => e.id !== 'intercourse-conception' || hasPositive)
    .map(e => buildCorrelation(e, allStats))
    .filter((c): c is Correlation => c != null)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 6);

  return correlations;
}
