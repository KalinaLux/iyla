import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, getDay, parseISO } from 'date-fns';
import type { Cycle, DailyReading } from '../../lib/types';
import {
  buildYearCalendar,
  type CalendarDay,
  type DayCategory,
} from '../../lib/year-calendar';

interface Props {
  cycles: Cycle[];
  readings: DailyReading[];
  /** Optional year override; defaults to current year */
  year?: number;
  /** Called when user clicks a day */
  onDayClick?: (date: string) => void;
}

const CATEGORY_CLASS: Record<DayCategory, string> = {
  menstrual: 'bg-rose-400',
  follicular: 'bg-warm-300',
  fertile: 'bg-amber-300',
  ovulation: 'bg-rose-500 ring-1 ring-rose-300 ring-offset-[1px] ring-offset-white',
  luteal: 'bg-lavender-300',
  unknown: 'bg-warm-100',
};

const CATEGORY_LABEL: Record<DayCategory, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  fertile: 'Fertile',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
  unknown: 'No data',
};

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function DayDot({
  day,
  onClick,
}: {
  day: CalendarDay | null;
  onClick?: (date: string) => void;
}) {
  if (!day) {
    return <span className="w-[10px] h-[10px]" aria-hidden />;
  }

  const base = CATEGORY_CLASS[day.category];
  const todayRing = day.isToday ? 'ring-2 ring-warm-900 ring-offset-[1px] ring-offset-white' : '';
  const clickable = !!onClick;

  const tooltip = [
    format(parseISO(`${day.date}T00:00:00`), 'EEE MMM d, yyyy'),
    day.cycleDay != null ? `CD${day.cycleDay}` : null,
    CATEGORY_LABEL[day.category],
    day.hasReading ? 'Logged' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const content = (
    <span
      className={`relative block w-[10px] h-[10px] rounded-full ${base} ${todayRing}`}
    >
      {day.hasReading && day.category !== 'unknown' && (
        <span className="absolute inset-0 m-auto w-[3px] h-[3px] rounded-full bg-white/80" />
      )}
      {day.hasReading && day.category === 'unknown' && (
        <span className="absolute inset-0 m-auto w-[3px] h-[3px] rounded-full bg-warm-500" />
      )}
    </span>
  );

  if (clickable) {
    return (
      <button
        type="button"
        title={tooltip}
        aria-label={tooltip}
        onClick={() => onClick!(day.date)}
        className="flex items-center justify-center w-[10px] h-[10px] rounded-full hover:scale-[1.6] transition-transform duration-150 cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return (
    <span title={tooltip} aria-label={tooltip} className="inline-block">
      {content}
    </span>
  );
}

function MonthGrid({
  monthIndex,
  year,
  days,
  onDayClick,
}: {
  monthIndex: number;
  year: number;
  days: CalendarDay[];
  onDayClick?: (date: string) => void;
}) {
  // Build 42-cell grid (6 rows x 7 cols), padding with nulls for leading/trailing empty cells.
  const firstOfMonth = new Date(year, monthIndex, 1);
  const leading = getDay(firstOfMonth); // 0 = Sunday
  const cells: (CalendarDay | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...days,
  ];
  while (cells.length < 42) cells.push(null);

  return (
    <div className="flex flex-col items-start">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-warm-500 mb-2">
        {MONTH_NAMES[monthIndex]}
      </div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, 10px)',
          gap: '2px',
        }}
      >
        {cells.map((cell, i) => (
          <DayDot key={i} day={cell} onClick={onDayClick} />
        ))}
      </div>
    </div>
  );
}

function LegendItem({ category }: { category: DayCategory }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_CLASS[category]}`} />
      <span className="text-[11px] text-warm-500 font-medium">
        {CATEGORY_LABEL[category]}
      </span>
    </div>
  );
}

export default function CycleYearCalendar({
  cycles,
  readings,
  year,
  onDayClick,
}: Props) {
  const initialYear = year ?? new Date().getFullYear();
  const [displayYear, setDisplayYear] = useState(initialYear);

  const effectiveYear = year ?? displayYear;

  const yearData = useMemo(
    () => buildYearCalendar(effectiveYear, cycles, readings),
    [effectiveYear, cycles, readings],
  );

  const daysByMonth = useMemo<CalendarDay[][]>(() => {
    const byMonth: CalendarDay[][] = Array.from({ length: 12 }, () => []);
    for (const d of yearData) {
      const m = Number(d.date.substring(5, 7)) - 1;
      byMonth[m].push(d);
    }
    return byMonth;
  }, [yearData]);

  const loggedCount = useMemo(
    () => yearData.filter((d) => d.hasReading).length,
    [yearData],
  );

  const canNavigate = year === undefined;

  return (
    <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-warm-500" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-warm-700">Cycle year</h3>
        </div>
        <div className="flex items-center gap-1">
          {canNavigate && (
            <button
              type="button"
              onClick={() => setDisplayYear((y) => y - 1)}
              className="p-1.5 rounded-lg text-warm-400 hover:text-warm-700 hover:bg-warm-50 transition-colors"
              aria-label="Previous year"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span className="text-sm font-semibold text-warm-700 tabular-nums px-2 min-w-[3rem] text-center">
            {effectiveYear}
          </span>
          {canNavigate && (
            <button
              type="button"
              onClick={() => setDisplayYear((y) => y + 1)}
              className="p-1.5 rounded-lg text-warm-400 hover:text-warm-700 hover:bg-warm-50 transition-colors"
              aria-label="Next year"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Weekday legend (shown once, subtle) */}
      <div className="hidden sm:flex items-center gap-1 text-[9px] uppercase text-warm-300 mb-3 pl-0">
        <span className="w-8" />
        <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 10px)', gap: '2px' }}>
          {WEEKDAY_LETTERS.map((w, i) => (
            <span key={i} className="w-[10px] text-center">{w}</span>
          ))}
        </div>
      </div>

      {/* 12 month grids */}
      <div
        className="grid gap-x-5 gap-y-5 overflow-x-auto pb-2"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          minWidth: 0,
        }}
      >
        {daysByMonth.map((monthDays, i) => (
          <MonthGrid
            key={i}
            monthIndex={i}
            year={effectiveYear}
            days={monthDays}
            onDayClick={onDayClick}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t border-warm-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <LegendItem category="menstrual" />
          <LegendItem category="follicular" />
          <LegendItem category="fertile" />
          <LegendItem category="ovulation" />
          <LegendItem category="luteal" />
          <LegendItem category="unknown" />
        </div>
        <span className="text-[11px] text-warm-400 font-medium">
          {loggedCount} {loggedCount === 1 ? 'day' : 'days'} logged in {effectiveYear}
        </span>
      </div>
    </div>
  );
}
