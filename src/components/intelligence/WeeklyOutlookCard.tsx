import { useMemo } from 'react';
import { CalendarRange, Sparkles, Heart, Moon } from 'lucide-react';
import type { Cycle, DailyReading, FertilityStatus } from '../../lib/types';
import type { CyclePredictions } from '../../lib/predictions';
import {
  buildWeeklyOutlook,
  pickTopPriority,
  type DailyOutlook,
} from '../../lib/weekly-outlook';

interface Props {
  currentCycle: Cycle | null;
  readings: DailyReading[];
  predictions: CyclePredictions;
  /** If set, component renders starting from this date; defaults to today */
  startDate?: string;
}

const STATUS_CIRCLE: Record<FertilityStatus, string> = {
  peak: 'bg-gradient-to-br from-rose-400 to-amber-300 text-white',
  high: 'bg-rose-300 text-white',
  rising: 'bg-amber-300 text-white',
  confirmed_ovulation: 'bg-gradient-to-br from-emerald-400 to-rose-300 text-white',
  luteal: 'bg-lavender-300 text-white',
  menstrual: 'bg-rose-500 text-white',
  low: 'bg-warm-200 text-warm-600',
};

const STATUS_WORD: Record<FertilityStatus, string> = {
  peak: 'Peak',
  high: 'High',
  rising: 'Rising',
  confirmed_ovulation: 'Ovulation',
  luteal: 'Luteal',
  menstrual: 'Menstrual',
  low: 'Low',
};

const STATUS_LABEL_TONE: Record<FertilityStatus, string> = {
  peak: 'text-rose-600',
  high: 'text-rose-500',
  rising: 'text-amber-600',
  confirmed_ovulation: 'text-emerald-600',
  luteal: 'text-lavender-600',
  menstrual: 'text-rose-600',
  low: 'text-warm-500',
};

function StatusIcon({ status }: { status: FertilityStatus }) {
  if (status === 'peak' || status === 'high' || status === 'confirmed_ovulation') {
    return <Heart size={16} strokeWidth={2.5} />;
  }
  if (status === 'luteal' || status === 'menstrual') {
    return <Moon size={16} strokeWidth={2.5} />;
  }
  if (status === 'rising') {
    return <Sparkles size={16} strokeWidth={2.5} />;
  }
  return null;
}

function ConfidenceDot({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  if (confidence === 'high') {
    return <span className="w-1.5 h-1.5 rounded-full bg-warm-500" />;
  }
  if (confidence === 'medium') {
    return <span className="w-1.5 h-1.5 rounded-full bg-warm-300" />;
  }
  return <span className="w-1.5 h-1.5 rounded-full border border-warm-300" />;
}

function DayPill({ day }: { day: DailyOutlook }) {
  const circleClass = STATUS_CIRCLE[day.status];
  const label = STATUS_WORD[day.status];
  const tone = STATUS_LABEL_TONE[day.status];

  return (
    <div
      className={`shrink-0 w-[88px] sm:w-auto flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition-all ${
        day.isToday ? 'bg-warm-50 ring-1 ring-warm-150' : ''
      }`}
      title={`${day.dayLabel} · ${label}${day.cycleDay ? ` · CD${day.cycleDay}` : ''}`}
    >
      <span
        className={`text-[10px] uppercase tracking-wider font-semibold ${
          day.isToday ? 'text-warm-700' : 'text-warm-400'
        }`}
      >
        {day.dayLabel}
      </span>

      <div
        className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${circleClass}`}
      >
        {day.cycleDay != null ? (
          <span className="text-xs font-bold leading-none">
            CD{day.cycleDay}
          </span>
        ) : (
          <StatusIcon status={day.status} />
        )}
        {day.isFertileWindow && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-white border border-rose-300" />
        )}
      </div>

      <span className={`text-[11px] font-semibold ${tone}`}>{label}</span>
      <ConfidenceDot confidence={day.confidence} />
    </div>
  );
}

export default function WeeklyOutlookCard({
  currentCycle,
  readings,
  predictions,
  startDate,
}: Props) {
  const outlook = useMemo(
    () => buildWeeklyOutlook(currentCycle, readings, predictions, startDate),
    [currentCycle, readings, predictions, startDate],
  );

  const top = pickTopPriority(outlook);
  const priorityLine = top
    ? `${top.recommendation} — ${top.dayLabel.toLowerCase()} (${STATUS_WORD[top.status]})`
    : 'Settle into luteal rhythm';

  return (
    <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CalendarRange size={16} className="text-warm-500" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-warm-700">Your week ahead</h3>
        </div>
        <span className="text-xs text-warm-400 font-medium">Next 7 days</span>
      </div>

      {/* Pills */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 sm:grid sm:grid-cols-7 sm:gap-2 sm:overflow-visible">
        {outlook.map((day) => (
          <DayPill key={day.date} day={day} />
        ))}
      </div>

      {/* Priority strip */}
      <div className="mt-5 pt-4 border-t border-warm-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
          <Sparkles size={13} className="text-rose-500" strokeWidth={2} />
        </div>
        <p className="text-sm text-warm-700 leading-snug">
          <span className="font-semibold">Top priority:</span>{' '}
          <span className="text-warm-600">{priorityLine}</span>
        </p>
      </div>
    </div>
  );
}
