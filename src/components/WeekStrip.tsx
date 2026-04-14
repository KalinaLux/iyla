import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { useCycleReadings } from '../lib/hooks';

interface Props {
  cycleId: number | undefined;
  cycleStartDate: string;
}

export default function WeekStrip({ cycleId, cycleStartDate }: Props) {
  const readings = useCycleReadings(cycleId);
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const readingDates = new Set(readings.map(r => r.date));
  const cycleStart = new Date(cycleStartDate + 'T00:00:00');

  return (
    <div className="flex items-center gap-1.5">
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const hasReading = readingDates.has(dateStr);
        const isActive = isToday(day);
        const cd = Math.floor((day.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const isPast = day < today && !isSameDay(day, today);
        const isFuture = day > today;

        return (
          <div
            key={dateStr}
            className={`flex-1 flex flex-col items-center py-2 rounded-2xl transition-all ${
              isActive
                ? 'bg-warm-800 text-white shadow-sm'
                : 'bg-white border border-warm-100'
            }`}
          >
            <span className={`text-[10px] uppercase font-medium ${
              isActive ? 'text-white/60' : 'text-warm-300'
            }`}>
              {format(day, 'EEE')}
            </span>
            <span className={`text-sm font-semibold mt-0.5 ${
              isActive ? 'text-white' : isFuture ? 'text-warm-300' : 'text-warm-600'
            }`}>
              {format(day, 'd')}
            </span>
            {cd > 0 && (
              <span className={`text-[9px] font-medium mt-0.5 ${
                isActive ? 'text-white/50' : 'text-warm-300'
              }`}>
                CD{cd}
              </span>
            )}
            {/* Data indicator dot */}
            <div className="mt-1 h-1.5">
              {hasReading && (
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? 'bg-white/60' : 'bg-teal-400'
                }`} />
              )}
              {isPast && !hasReading && cd > 0 && (
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? 'bg-white/30' : 'bg-warm-200'
                }`} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
