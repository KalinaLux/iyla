import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfYear,
  format,
  isSameDay,
  parseISO,
  startOfYear,
} from 'date-fns';
import type { Cycle, DailyReading } from './types';

export type DayCategory =
  | 'menstrual'
  | 'follicular'
  | 'fertile'
  | 'ovulation'
  | 'luteal'
  | 'unknown';

export interface CalendarDay {
  /** ISO yyyy-mm-dd */
  date: string;
  category: DayCategory;
  cycleId: number | null;
  cycleDay: number | null;
  /** True if the user logged any reading on this day. */
  hasReading: boolean;
  isToday: boolean;
}

const DEFAULT_CYCLE_LENGTH = 28;

function parseDate(iso: string): Date {
  return parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

interface CycleRange {
  cycle: Cycle;
  start: Date;
  end: Date;
}

/**
 * Build an effective date range for each cycle. A cycle runs from its
 * startDate to either its explicit endDate, the day before the next
 * cycle starts, or startDate + 28 days — whichever comes first.
 */
function buildCycleRanges(cycles: Cycle[]): CycleRange[] {
  const sorted = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return sorted.map((cycle, i) => {
    const start = parseDate(cycle.startDate);
    const nextStart = sorted[i + 1] ? parseDate(sorted[i + 1].startDate) : null;

    let end: Date;
    if (cycle.endDate) {
      end = parseDate(cycle.endDate);
    } else if (nextStart) {
      end = addDays(nextStart, -1);
    } else {
      end = addDays(start, DEFAULT_CYCLE_LENGTH - 1);
    }

    // Never let a cycle spill past where the next one starts.
    if (nextStart) {
      const bound = addDays(nextStart, -1);
      if (end > bound) end = bound;
    }

    return { cycle, start, end };
  });
}

function findCycleForDate(ranges: CycleRange[], d: Date): CycleRange | null {
  for (const r of ranges) {
    if (d >= r.start && d <= r.end) return r;
  }
  return null;
}

/**
 * Build a full year of calendar data with each day tagged by cycle
 * phase / category and whether the user logged a reading.
 *
 * Pure — does not depend on React or Dexie.
 */
export function buildYearCalendar(
  year: number,
  cycles: Cycle[],
  readings: DailyReading[],
): CalendarDay[] {
  const first = startOfYear(new Date(year, 0, 1));
  const last = endOfYear(new Date(year, 0, 1));
  const days = eachDayOfInterval({ start: first, end: last });

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const readingsByDate = new Map<string, DailyReading>();
  for (const r of readings) readingsByDate.set(r.date, r);

  const ranges = buildCycleRanges(cycles);

  return days.map((d): CalendarDay => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const reading = readingsByDate.get(dateStr);
    const range = findCycleForDate(ranges, d);
    const isToday = isSameDay(d, todayMidnight);

    if (!range) {
      return {
        date: dateStr,
        category: 'unknown',
        cycleId: null,
        cycleDay: null,
        hasReading: !!reading,
        isToday,
      };
    }

    const cycleDay = differenceInCalendarDays(d, range.start) + 1;
    const fs = reading?.fertilityStatus;

    let category: DayCategory;
    if (fs === 'menstrual') {
      category = 'menstrual';
    } else if (fs === 'peak' || fs === 'confirmed_ovulation') {
      category = 'ovulation';
    } else if (fs === 'high' || fs === 'rising') {
      category = 'fertile';
    } else if (fs === 'luteal') {
      category = 'luteal';
    } else {
      // No usable reading status → fall back to cycleDay heuristic.
      if (cycleDay >= 1 && cycleDay <= 5) category = 'menstrual';
      else if (cycleDay === 14) category = 'ovulation';
      else if (cycleDay >= 10 && cycleDay <= 17) category = 'fertile';
      else if (cycleDay >= 6 && cycleDay <= 9) category = 'follicular';
      else if (cycleDay > 17) category = 'luteal';
      else category = 'unknown';
    }

    return {
      date: dateStr,
      category,
      cycleId: range.cycle.id ?? null,
      cycleDay,
      hasReading: !!reading,
      isToday,
    };
  });
}
