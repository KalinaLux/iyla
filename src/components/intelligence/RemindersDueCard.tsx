import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Bell, Check, ArrowRight } from 'lucide-react';
import { remindersDb } from '../../lib/reminders-db';
import type { Reminder } from '../../lib/reminders-db';
import { remindersDueToday, markCompleted, defaultEmoji } from '../../lib/reminders';
import { useCurrentCycle } from '../../lib/hooks';

function formatTimeLabel(time: string): string {
  const [hs, ms] = time.split(':');
  const h = Number.parseInt(hs ?? '0', 10);
  const m = Number.parseInt(ms ?? '0', 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

export default function RemindersDueCard() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const cycle = useCurrentCycle();
  const cycleDay = useMemo(() => {
    if (!cycle) return null;
    const start = new Date(cycle.startDate + 'T00:00:00');
    const now = new Date(todayStr + 'T00:00:00');
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [cycle, todayStr]);

  const reminders = useLiveQuery(() => remindersDb.reminders.toArray(), []) ?? [];
  const due = remindersDueToday(reminders, new Date(), cycleDay);

  if (due.length === 0) return null;

  async function toggleComplete(r: Reminder) {
    if (r.id == null) return;
    const already = r.completions.some(c => c.substring(0, 10) === todayStr);
    if (already) {
      const next = r.completions.filter(c => c.substring(0, 10) !== todayStr);
      await remindersDb.reminders.update(r.id, { completions: next });
    } else {
      const next = markCompleted(r, new Date().toISOString());
      await remindersDb.reminders.update(r.id, { completions: next });
    }
  }

  const preview = due.slice(0, 3);
  const extra = due.length - preview.length;

  return (
    <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-teal-50 flex items-center justify-center">
            <Bell size={13} className="text-teal-600" strokeWidth={2} />
          </div>
          <h3 className="text-sm font-semibold text-warm-700">Due today</h3>
          <span className="text-[10px] font-medium text-warm-400">{due.length}</span>
        </div>
        <Link
          to="/reminders"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-warm-500 hover:text-warm-700 transition-colors"
        >
          See all
          <ArrowRight size={11} strokeWidth={2.5} />
        </Link>
      </div>

      <div className="space-y-1.5">
        {preview.map(r => {
          const done = r.completions.some(c => c.substring(0, 10) === todayStr);
          const emoji = r.emoji || defaultEmoji(r.category);
          return (
            <div key={r.id} className="flex items-center gap-2.5 py-1.5">
              <button
                onClick={() => toggleComplete(r)}
                aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : 'bg-warm-50 text-warm-300 hover:text-warm-500 border border-warm-200'
                }`}
              >
                {done && <Check size={13} strokeWidth={2.5} />}
              </button>
              <span className="text-base leading-none">{emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${done ? 'line-through text-warm-400' : 'text-warm-800'}`}>
                  {r.title}
                </p>
              </div>
              <span className="text-xs text-warm-400 font-medium shrink-0">
                {formatTimeLabel(r.time)}
              </span>
            </div>
          );
        })}
      </div>

      {extra > 0 && (
        <Link
          to="/reminders"
          className="mt-2 block text-center text-[11px] font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          See all {due.length} reminders
        </Link>
      )}
    </div>
  );
}
