import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  parseISO,
} from 'date-fns';
import type { Cycle, DailyReading, FertilityStatus } from './types';
import type { CyclePredictions } from './predictions';

export interface DailyOutlook {
  /** ISO yyyy-mm-dd */
  date: string;
  /** "Today", "Tomorrow", or weekday abbreviation like "Thu" */
  dayLabel: string;
  cycleDay: number | null;
  status: FertilityStatus;
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
  isToday: boolean;
  isFertileWindow: boolean;
}

const RECOMMENDATION_BY_STATUS: Record<FertilityStatus, string> = {
  peak: 'Prioritize intimacy',
  high: 'Intimacy every 1-2 days',
  rising: 'Start tracking closely',
  confirmed_ovulation: 'Ovulation confirmed — rest & nourish',
  luteal: 'TWW mindset',
  menstrual: 'Rest & recover',
  low: 'Self-care',
};

function parseDate(iso: string): Date {
  return parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

function toMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function predictStatusFromDate(
  day: Date,
  nextPeriod: Date | null,
  nextOv: Date | null,
  fertileStart: Date | null,
  fertileEnd: Date | null,
): FertilityStatus {
  // 1. Into the next period already
  if (nextPeriod && day >= nextPeriod) return 'menstrual';

  // 2. Ovulation day ± 1 → peak
  if (nextOv) {
    const diff = Math.abs(differenceInCalendarDays(day, nextOv));
    if (diff <= 1) return 'peak';
  }

  // 3. In fertile window, before ovulation → high
  if (fertileStart && fertileEnd && day >= fertileStart && day <= fertileEnd) {
    return 'high';
  }

  // 4. 2-3 days before fertile window start → rising
  if (fertileStart) {
    const daysBeforeFertile = differenceInCalendarDays(fertileStart, day);
    if (daysBeforeFertile >= 2 && daysBeforeFertile <= 3) return 'rising';
  }

  // 5. After ovulation, before next period → luteal
  if (nextOv && day > nextOv) {
    if (!nextPeriod || day < nextPeriod) return 'luteal';
  }

  return 'low';
}

/**
 * Build a 7-day forward-looking fertility outlook, blending the predicted
 * fertile window, next period, and any already-logged readings for days in
 * the range.
 *
 * This function is pure — it does not touch Dexie, React, or the DOM.
 */
export function buildWeeklyOutlook(
  currentCycle: Cycle | null,
  readings: DailyReading[],
  predictions: CyclePredictions,
  startDate?: string,
): DailyOutlook[] {
  const now = new Date();
  const todayMidnight = toMidnight(now);
  const start = startDate ? toMidnight(parseDate(startDate)) : todayMidnight;

  const readingsByDate = new Map<string, DailyReading>();
  for (const r of readings) readingsByDate.set(r.date, r);

  const cycleStart = currentCycle ? parseDate(currentCycle.startDate) : null;
  const nextPeriod = predictions.nextPeriod ? parseDate(predictions.nextPeriod.date) : null;
  const nextOv = predictions.nextOvulation ? parseDate(predictions.nextOvulation.date) : null;
  const fertileStart = predictions.fertilePhaseStart ? parseDate(predictions.fertilePhaseStart) : null;
  const fertileEnd = predictions.fertilePhaseEnd ? parseDate(predictions.fertilePhaseEnd) : null;

  const outlook: DailyOutlook[] = [];

  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    const dateStr = format(day, 'yyyy-MM-dd');
    const isToday = isSameDay(day, todayMidnight);

    // ── Cycle day ────────────────────────────────────────────────
    // If the day has crossed into the next predicted cycle, count
    // from the predicted period; otherwise count from the active
    // cycle. If there's no cycle and no prediction, cycleDay is null.
    let cycleDay: number | null = null;
    if (nextPeriod && day >= nextPeriod) {
      cycleDay = differenceInCalendarDays(day, nextPeriod) + 1;
    } else if (cycleStart) {
      const cd = differenceInCalendarDays(day, cycleStart) + 1;
      cycleDay = cd >= 1 ? cd : null;
    }

    // ── Status ───────────────────────────────────────────────────
    // If a reading exists with a computed fertilityStatus (typically
    // today), trust it. Otherwise fall back to the prediction rules.
    const reading = readingsByDate.get(dateStr);
    const status: FertilityStatus =
      reading?.fertilityStatus ??
      predictStatusFromDate(day, nextPeriod, nextOv, fertileStart, fertileEnd);

    // ── Confidence ───────────────────────────────────────────────
    let confidence: 'high' | 'medium' | 'low';
    const diffFromToday = differenceInCalendarDays(day, todayMidnight);
    if (diffFromToday <= 1) confidence = 'high';
    else if (diffFromToday <= 4) confidence = 'medium';
    else confidence = 'low';

    // ── Day label ────────────────────────────────────────────────
    let dayLabel: string;
    if (diffFromToday === 0) dayLabel = 'Today';
    else if (diffFromToday === 1) dayLabel = 'Tomorrow';
    else dayLabel = format(day, 'EEE');

    const isFertileWindow = !!(
      fertileStart &&
      fertileEnd &&
      day >= fertileStart &&
      day <= fertileEnd
    );

    outlook.push({
      date: dateStr,
      dayLabel,
      cycleDay,
      status,
      confidence,
      recommendation: RECOMMENDATION_BY_STATUS[status],
      isToday,
      isFertileWindow,
    });
  }

  return outlook;
}

/**
 * Pick the single most actionable day in a 7-day outlook. Prefers the
 * earliest peak day, then the earliest high day, then the earliest rising
 * day. Returns null if the week is purely luteal / low / menstrual.
 */
export function pickTopPriority(outlook: DailyOutlook[]): DailyOutlook | null {
  const priority: FertilityStatus[] = ['peak', 'high', 'rising'];
  for (const status of priority) {
    const match = outlook.find((d) => d.status === status);
    if (match) return match;
  }
  return null;
}
