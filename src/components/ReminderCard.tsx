import { Check, Flame, Pencil } from 'lucide-react';
import type { Reminder } from '../lib/reminders-db';
import { computeStreak, defaultEmoji } from '../lib/reminders';

interface Props {
  reminder: Reminder;
  onEdit: (r: Reminder) => void;
  onToggleComplete: (r: Reminder) => void;
  completedToday?: boolean;
}

function formatTimeLabel(time: string): string {
  const [hs, ms] = time.split(':');
  const h = Number.parseInt(hs ?? '0', 10);
  const m = Number.parseInt(ms ?? '0', 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function repeatLabel(r: Reminder): string {
  switch (r.repeat) {
    case 'once':          return r.oneTimeDate ? `Once · ${r.oneTimeDate}` : 'Once';
    case 'daily':         return 'Daily';
    case 'weekdays':      return 'Weekdays';
    case 'specific-days': return (r.daysOfWeek ?? []).map(d => DOW_LABELS[d]).join(' · ') || 'Specific days';
    case 'weekly':        return (r.daysOfWeek ?? []).map(d => `Weekly · ${DOW_LABELS[d]}`)[0] ?? 'Weekly';
    case 'cycle-day':     return `Cycle day ${r.cycleDay ?? '—'}`;
    default:              return '';
  }
}

export default function ReminderCard({ reminder, onEdit, onToggleComplete, completedToday = false }: Props) {
  const emoji = reminder.emoji || defaultEmoji(reminder.category);
  const streak = computeStreak(reminder);

  return (
    <div
      className={`flex items-start gap-3 p-4 bg-white rounded-3xl border border-warm-100 shadow-sm transition-all ${
        !reminder.enabled ? 'opacity-50' : ''
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleComplete(reminder)}
        aria-label={completedToday ? 'Mark incomplete' : 'Mark complete'}
        className={`shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
          completedToday
            ? 'bg-emerald-500 text-white shadow-sm'
            : 'bg-warm-50 text-warm-300 hover:bg-warm-100 hover:text-warm-500 border border-warm-200'
        }`}
      >
        {completedToday && <Check size={16} strokeWidth={2.5} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base leading-none">{emoji}</span>
          <p className={`text-sm font-semibold text-warm-800 ${completedToday ? 'line-through text-warm-400' : ''}`}>
            {reminder.title}
          </p>
          {streak > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <Flame size={10} strokeWidth={2.5} />
              {streak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className="text-xs text-warm-500 font-medium">{formatTimeLabel(reminder.time)}</span>
          <span className="text-warm-200">·</span>
          <span className="text-xs text-warm-400">{repeatLabel(reminder)}</span>
        </div>
        {reminder.body && (
          <p className="text-xs text-warm-500 mt-1.5 leading-relaxed">{reminder.body}</p>
        )}
      </div>

      {/* Edit */}
      <button
        onClick={() => onEdit(reminder)}
        aria-label="Edit reminder"
        className="shrink-0 w-8 h-8 rounded-xl text-warm-300 hover:text-warm-600 hover:bg-warm-50 flex items-center justify-center transition-all"
      >
        <Pencil size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
