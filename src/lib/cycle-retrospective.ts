// ──────────────────────────────────────────────────────────────────────────
// iyla — Cycle Retrospective Engine
// ──────────────────────────────────────────────────────────────────────────
// When a cycle closes, generate a warm narrative summary: "Your October cycle
// at a glance." Pure computation. Stores rolling retrospectives in
// localStorage under `iyla-retrospectives`.
// ──────────────────────────────────────────────────────────────────────────

import { differenceInCalendarDays, format, parseISO } from 'date-fns';

import type { Cycle, DailyReading } from './types';

// ── Public interface ─────────────────────────────────────────────────────

export interface CycleRetrospective {
  cycleId: number;
  cycleLabel: string;
  startDate: string;
  endDate: string;
  cycleLength: number;
  // Key stats
  lutealLength: number | null;
  ovulationDay: number | null;
  peakBbt: number | null;
  bbtShift: number | null;
  lhPeakDay: number | null;
  lhPeakValue: number | null;
  daysLogged: number;
  adherenceRate: number;
  intercourseInWindow: number;
  fertileWindowDays: number;
  // Narrative
  headline: string;
  summary: string;
  celebrate: string[];
  growthEdge: string[];
  standout: string | null;
  // Comparisons
  vs: {
    cycleLengthDelta: number | null;
    lutealDelta: number | null;
    peakBbtDelta: number | null;
  };
  generatedAt: string;
}

// ── Small utilities ──────────────────────────────────────────────────────

function safeParse(iso: string | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dedupeByDate(readings: DailyReading[]): DailyReading[] {
  const seen = new Set<string>();
  const out: DailyReading[] = [];
  for (const r of readings) {
    if (seen.has(r.date)) continue;
    seen.add(r.date);
    out.push(r);
  }
  return out;
}

// ── Stats computation ────────────────────────────────────────────────────

function computeCycleLength(cycle: Cycle, readings: DailyReading[]): number {
  const start = safeParse(cycle.startDate);
  const end = safeParse(cycle.endDate);
  if (start && end) {
    return Math.max(1, differenceInCalendarDays(end, start));
  }
  if (readings.length > 0) {
    return Math.max(...readings.map(r => r.cycleDay));
  }
  return 0;
}

/**
 * Ovulation detection, in order:
 *   1. First reading tagged 'peak' or 'confirmed_ovulation'
 *   2. BBT nadir (lowest pre-mid-cycle temp) + 1 day
 *   3. LH peak day + 1
 *   4. null
 */
function detectOvulationDay(readings: DailyReading[]): number | null {
  if (readings.length === 0) return null;

  const peak = readings.find(
    r => r.fertilityStatus === 'peak' || r.fertilityStatus === 'confirmed_ovulation',
  );
  if (peak) return peak.cycleDay;

  // BBT nadir in first 20 days (lowest pre-shift temp). Need at least 4 BBT
  // readings so we don't call a random low a "nadir".
  const earlyBbts = readings.filter(r => r.bbt != null && r.cycleDay <= 20);
  if (earlyBbts.length >= 4) {
    let nadir = earlyBbts[0];
    for (const r of earlyBbts) {
      if ((r.bbt ?? Infinity) < (nadir.bbt ?? Infinity)) nadir = r;
    }
    if (nadir.cycleDay < 20) return nadir.cycleDay + 1;
  }

  const lhReadings = readings.filter(r => r.lh != null);
  if (lhReadings.length > 0) {
    let top = lhReadings[0];
    for (const r of lhReadings) if ((r.lh ?? 0) > (top.lh ?? 0)) top = r;
    if ((top.lh ?? 0) >= 5) return Math.min(top.cycleDay + 1, 40);
  }

  return null;
}

function computeBbtShift(readings: DailyReading[], ovDay: number | null): number | null {
  if (ovDay == null) return null;
  const bbts = readings.filter(r => r.bbt != null);
  if (bbts.length < 4) return null;
  const pre = bbts.filter(r => r.cycleDay <= ovDay).map(r => r.bbt!);
  const post = bbts.filter(r => r.cycleDay > ovDay + 1).map(r => r.bbt!);
  const preAvg = mean(pre);
  const postAvg = mean(post);
  if (preAvg == null || postAvg == null) return null;
  return round2(postAvg - preAvg);
}

function computePeakBbt(readings: DailyReading[], ovDay: number | null): number | null {
  const bbts = readings.filter(r => r.bbt != null && (ovDay == null || r.cycleDay >= ovDay));
  if (bbts.length === 0) return null;
  return round2(Math.max(...bbts.map(r => r.bbt!)));
}

function computeLhPeak(
  readings: DailyReading[],
): { day: number | null; value: number | null } {
  const lh = readings.filter(r => r.lh != null);
  if (lh.length === 0) return { day: null, value: null };
  let top = lh[0];
  for (const r of lh) if ((r.lh ?? 0) > (top.lh ?? 0)) top = r;
  return { day: top.cycleDay, value: round1(top.lh!) };
}

function computeFertileWindow(
  ovDay: number | null,
  readings: DailyReading[],
): { fertileWindowDays: number; intercourseInWindow: number } {
  if (ovDay == null) return { fertileWindowDays: 0, intercourseInWindow: 0 };
  // Window = ov-5 through ov+1 (the 6-day conceiving window + ov day + 1)
  const start = Math.max(1, ovDay - 5);
  const end = ovDay + 1;
  const inWindow = readings.filter(r => r.cycleDay >= start && r.cycleDay <= end);
  const uniqueDays = new Set(inWindow.map(r => r.cycleDay));
  const intercourse = inWindow.filter(r => r.intercourse).length;
  return {
    fertileWindowDays: uniqueDays.size,
    intercourseInWindow: intercourse,
  };
}

function buildCycleLabel(cycle: Cycle): string {
  const start = safeParse(cycle.startDate);
  const end = safeParse(cycle.endDate);
  if (!start) return 'Recent cycle';
  const startDay = start.getDate();
  // Prefer the month name of the "bulk" of the cycle
  if (end && end.getMonth() !== start.getMonth() && startDay > 20) {
    return `${format(end, 'MMMM')} cycle`;
  }
  if (startDay <= 10) {
    return `${format(start, 'MMMM')} cycle`;
  }
  if (end) {
    const mid = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
    return `${format(mid, 'MMMM')} cycle`;
  }
  return `Cycle starting ${format(start, 'MMM d')}`;
}

// ── Previous-cycle comparisons ───────────────────────────────────────────

interface PriorAverages {
  cycleLength: number | null;
  lutealLength: number | null;
  peakBbt: number | null;
  longestLuteal: number | null;
  strongestLhPeak: number | null;
  biggestBbtShift: number | null;
  bestAdherence: number | null;
}

function computePriorAverages(
  previousCycles: Cycle[],
  previousReadings: DailyReading[],
): PriorAverages {
  if (previousCycles.length === 0) {
    return {
      cycleLength: null,
      lutealLength: null,
      peakBbt: null,
      longestLuteal: null,
      strongestLhPeak: null,
      biggestBbtShift: null,
      bestAdherence: null,
    };
  }

  const lengths: number[] = [];
  const luteals: number[] = [];
  const peakBbts: number[] = [];
  const lhPeaks: number[] = [];
  const bbtShifts: number[] = [];
  const adherenceRates: number[] = [];

  for (const c of previousCycles) {
    const cr = previousReadings.filter(r => r.cycleId === c.id);
    const unique = dedupeByDate(cr);
    const len = computeCycleLength(c, unique);
    if (len > 0) lengths.push(len);
    const ov = detectOvulationDay(unique);
    if (ov != null && len > 0) {
      const luteal = len - ov;
      if (luteal > 0 && luteal < 20) luteals.push(luteal);
    }
    const peakBbt = computePeakBbt(unique, ov);
    if (peakBbt != null) peakBbts.push(peakBbt);
    const lh = computeLhPeak(unique);
    if (lh.value != null) lhPeaks.push(lh.value);
    const shift = computeBbtShift(unique, ov);
    if (shift != null) bbtShifts.push(shift);
    if (len > 0) adherenceRates.push(unique.length / len);
  }

  return {
    cycleLength: mean(lengths),
    lutealLength: mean(luteals),
    peakBbt: mean(peakBbts),
    longestLuteal: luteals.length > 0 ? Math.max(...luteals) : null,
    strongestLhPeak: lhPeaks.length > 0 ? Math.max(...lhPeaks) : null,
    biggestBbtShift: bbtShifts.length > 0 ? Math.max(...bbtShifts) : null,
    bestAdherence: adherenceRates.length > 0 ? Math.max(...adherenceRates) : null,
  };
}

// ── Narrative generation ─────────────────────────────────────────────────

interface NarrativeInput {
  cycleLabel: string;
  cycleLength: number;
  ovulationDay: number | null;
  lutealLength: number | null;
  peakBbt: number | null;
  bbtShift: number | null;
  lhPeakValue: number | null;
  lhPeakDay: number | null;
  adherenceRate: number;
  intercourseInWindow: number;
  vs: CycleRetrospective['vs'];
  priorCount: number;
}

function pickHeadline(n: NarrativeInput): string {
  if (n.priorCount === 0) return 'Your first tracked cycle — welcome to the data.';
  if (n.adherenceRate >= 0.8 && n.ovulationDay != null) return 'A beautifully tracked cycle.';
  if (n.lutealLength != null && n.lutealLength >= 12) return 'Strong luteal phase.';
  if (n.lhPeakValue != null && n.lhPeakValue >= 20) return 'A textbook LH surge.';
  if (n.bbtShift != null && n.bbtShift >= 0.4) return 'A clean thermal shift.';
  if (n.intercourseInWindow >= 3) return 'Timed beautifully in the fertile window.';
  if (n.vs.cycleLengthDelta != null && Math.abs(n.vs.cycleLengthDelta) <= 1) {
    return 'Steady and predictable.';
  }
  if (n.ovulationDay == null) return 'A cycle with a quiet ovulation story.';
  if (n.adherenceRate < 0.4) return 'A quieter tracking month.';
  return 'Your cycle in review.';
}

function buildSummary(n: NarrativeInput): string {
  const parts: string[] = [];
  const label = n.cycleLabel.charAt(0).toLowerCase() + n.cycleLabel.slice(1);
  if (n.ovulationDay != null) {
    parts.push(
      `Your ${label} ran ${n.cycleLength} days, with ovulation landing around CD${n.ovulationDay}.`,
    );
  } else {
    parts.push(`Your ${label} ran ${n.cycleLength} days.`);
  }

  const signalBits: string[] = [];
  if (n.lhPeakValue != null) {
    signalBits.push(`LH peaked at ${n.lhPeakValue} mIU/mL`);
  }
  if (n.bbtShift != null) {
    signalBits.push(`BBT rose ${round2(n.bbtShift)}°F post-ovulation`);
  }
  if (n.lutealLength != null) {
    signalBits.push(`a ${n.lutealLength}-day luteal phase`);
  }
  if (signalBits.length > 0) {
    parts.push(`${capitalize(signalBits.join(', '))}.`);
  }

  // Closing sentence
  if (n.adherenceRate >= 0.8) {
    parts.push(`Your tracking was steady and the data tells a clear story.`);
  } else if (n.adherenceRate >= 0.5) {
    parts.push(`You logged enough to see the shape of the cycle clearly.`);
  } else if (n.priorCount === 0) {
    parts.push(`Every reading from here helps iyla learn your unique rhythm.`);
  } else {
    parts.push(`A lighter logging month — the picture will sharpen as the next cycle unfolds.`);
  }

  return parts.join(' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildCelebrate(n: NarrativeInput): string[] {
  const out: string[] = [];
  if (n.lutealLength != null && n.lutealLength >= 12) {
    out.push(`Your luteal phase was ${n.lutealLength} days — strong progesterone signal.`);
  }
  if (n.bbtShift != null && n.bbtShift >= 0.3) {
    out.push(`BBT shift of ${round2(n.bbtShift)}°F — a clear post-ovulation thermal signature.`);
  }
  if (n.lhPeakValue != null && n.lhPeakValue >= 15) {
    const dayStr = n.lhPeakDay != null ? ` on CD${n.lhPeakDay}` : '';
    out.push(`LH peaked at ${n.lhPeakValue} mIU/mL${dayStr} — textbook surge.`);
  }
  if (n.adherenceRate >= 0.7) {
    out.push(`You logged ${Math.round(n.adherenceRate * 100)}% of days — that kind of consistency compounds.`);
  }
  if (n.intercourseInWindow >= 2) {
    out.push(`You caught ${n.intercourseInWindow} fertile-window day${n.intercourseInWindow === 1 ? '' : 's'} with intercourse — good timing.`);
  }
  if (n.cycleLength >= 25 && n.cycleLength <= 35 && out.length < 3) {
    out.push(`A ${n.cycleLength}-day cycle sits right in the healthy range.`);
  }
  return out.slice(0, 3);
}

function buildGrowthEdge(n: NarrativeInput): string[] {
  const out: string[] = [];
  if (n.ovulationDay == null) {
    out.push(`No clear ovulation signal this cycle — next cycle, try twice-daily LH tests around mid-cycle.`);
  }
  if (n.lutealLength != null && n.lutealLength < 10) {
    out.push(`Luteal phase was ${n.lutealLength} days — under 10 can signal weaker progesterone support.`);
  }
  if (n.bbtShift != null && n.bbtShift < 0.2) {
    out.push(`BBT shift was only ${round2(n.bbtShift)}°F — a softer thermal signature. Watch for thyroid, sleep, or measurement timing.`);
  }
  if (n.lhPeakValue != null && n.lhPeakValue < 10 && n.ovulationDay != null) {
    out.push(`Peak LH only reached ${n.lhPeakValue} — the surge may have been brief or missed between tests.`);
  }
  if (n.adherenceRate < 0.5 && n.priorCount > 0) {
    out.push(`Logging was lighter this month (${Math.round(n.adherenceRate * 100)}%) — even a minute a day sharpens the picture.`);
  }
  if (n.intercourseInWindow === 0 && n.ovulationDay != null) {
    out.push(`No logged intercourse in the fertile window — timing is often the single biggest lever.`);
  }
  return out.slice(0, 3);
}

function buildStandout(
  n: NarrativeInput,
  priors: PriorAverages,
): string | null {
  if (n.priorCount === 0) return null;
  // Longest luteal yet
  if (
    n.lutealLength != null &&
    priors.longestLuteal != null &&
    n.lutealLength > priors.longestLuteal
  ) {
    return `Longest luteal phase you've tracked — ${n.lutealLength} days.`;
  }
  // Strongest LH surge
  if (
    n.lhPeakValue != null &&
    priors.strongestLhPeak != null &&
    n.lhPeakValue > priors.strongestLhPeak + 1
  ) {
    return `Your clearest LH surge to date — ${n.lhPeakValue} mIU/mL.`;
  }
  // Biggest BBT shift
  if (
    n.bbtShift != null &&
    priors.biggestBbtShift != null &&
    n.bbtShift > priors.biggestBbtShift + 0.05
  ) {
    return `The strongest thermal shift you've tracked — +${round2(n.bbtShift)}°F.`;
  }
  // Best adherence
  if (
    priors.bestAdherence != null &&
    n.adherenceRate > priors.bestAdherence &&
    n.adherenceRate >= 0.7
  ) {
    return `Your most-tracked cycle yet — ${Math.round(n.adherenceRate * 100)}% of days logged.`;
  }
  return null;
}

// ── Main: buildCycleRetrospective ────────────────────────────────────────

export function buildCycleRetrospective(
  cycle: Cycle,
  readings: DailyReading[],
  previousCycles: Cycle[],
  previousReadings: DailyReading[],
): CycleRetrospective {
  const sorted = [...readings].sort((a, b) => a.cycleDay - b.cycleDay);
  const unique = dedupeByDate(sorted);

  const cycleLength = computeCycleLength(cycle, unique);
  const ovulationDay = detectOvulationDay(unique);
  const lutealLength =
    ovulationDay != null && cycleLength > 0 && cycleLength - ovulationDay > 0
      ? cycleLength - ovulationDay
      : null;
  const peakBbt = computePeakBbt(unique, ovulationDay);
  const bbtShift = computeBbtShift(unique, ovulationDay);
  const { day: lhPeakDay, value: lhPeakValue } = computeLhPeak(unique);
  const daysLogged = unique.length;
  const adherenceRate =
    cycleLength > 0 ? Math.min(1, daysLogged / cycleLength) : 0;
  const { fertileWindowDays, intercourseInWindow } = computeFertileWindow(
    ovulationDay,
    unique,
  );

  const priors = computePriorAverages(previousCycles, previousReadings);

  const vs: CycleRetrospective['vs'] = {
    cycleLengthDelta:
      priors.cycleLength != null && cycleLength > 0
        ? round1(cycleLength - priors.cycleLength)
        : null,
    lutealDelta:
      priors.lutealLength != null && lutealLength != null
        ? round1(lutealLength - priors.lutealLength)
        : null,
    peakBbtDelta:
      priors.peakBbt != null && peakBbt != null
        ? round2(peakBbt - priors.peakBbt)
        : null,
  };

  const cycleLabel = buildCycleLabel(cycle);

  const narInput: NarrativeInput = {
    cycleLabel,
    cycleLength,
    ovulationDay,
    lutealLength,
    peakBbt,
    bbtShift,
    lhPeakValue,
    lhPeakDay,
    adherenceRate,
    intercourseInWindow,
    vs,
    priorCount: previousCycles.length,
  };

  const headline = pickHeadline(narInput);
  const summary = buildSummary(narInput);
  const celebrate = buildCelebrate(narInput);
  const growthEdge = buildGrowthEdge(narInput);
  const standout = buildStandout(narInput, priors);

  const endDate = cycle.endDate ?? (() => {
    const start = safeParse(cycle.startDate);
    if (!start || cycleLength <= 0) return cycle.startDate;
    const end = new Date(start.getTime() + cycleLength * 24 * 60 * 60 * 1000);
    return format(end, 'yyyy-MM-dd');
  })();

  return {
    cycleId: cycle.id ?? 0,
    cycleLabel,
    startDate: cycle.startDate,
    endDate,
    cycleLength,
    lutealLength,
    ovulationDay,
    peakBbt,
    bbtShift,
    lhPeakDay,
    lhPeakValue,
    daysLogged,
    adherenceRate: round2(adherenceRate),
    intercourseInWindow,
    fertileWindowDays,
    headline,
    summary,
    celebrate,
    growthEdge,
    standout,
    vs,
    generatedAt: new Date().toISOString(),
  };
}

// ── Persistence (localStorage) ───────────────────────────────────────────

const STORAGE_KEY = 'iyla-retrospectives';
const MAX_RETROS = 24;

function readStorage(): CycleRetrospective[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r: unknown): r is CycleRetrospective =>
      !!r &&
      typeof r === 'object' &&
      typeof (r as CycleRetrospective).cycleId === 'number' &&
      typeof (r as CycleRetrospective).startDate === 'string',
    );
  } catch {
    return [];
  }
}

function writeStorage(list: CycleRetrospective[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // quota / serialization error — fail quiet
  }
}

export function saveRetrospective(r: CycleRetrospective): void {
  const existing = readStorage();
  const filtered = existing.filter(x => x.cycleId !== r.cycleId);
  filtered.push(r);
  filtered.sort((a, b) => a.startDate.localeCompare(b.startDate));
  writeStorage(filtered.slice(-MAX_RETROS));
}

export function getRetrospectives(): CycleRetrospective[] {
  return readStorage().sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function getRetrospectiveFor(cycleId: number): CycleRetrospective | null {
  return readStorage().find(r => r.cycleId === cycleId) ?? null;
}
