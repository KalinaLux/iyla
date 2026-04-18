import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, subDays } from 'date-fns';
import { Bell, BellOff, Plus, ChevronDown, Flame, Sparkles } from 'lucide-react';
import { remindersDb } from '../lib/reminders-db';
import type { Reminder, ReminderCategory } from '../lib/reminders-db';
import {
  remindersDueToday,
  markCompleted,
  requestNotificationPermission,
  scheduleTodaysReminders,
  defaultEmoji,
  computeStreak,
} from '../lib/reminders';
import ReminderEditorModal from '../components/ReminderEditorModal';
import ReminderCard from '../components/ReminderCard';
import { useCurrentCycle } from '../lib/hooks';

const CATEGORY_ORDER: ReminderCategory[] = [
  'supplement', 'testing', 'hydration', 'intimacy',
  'breathwork', 'medication', 'appointment', 'custom',
];

const CATEGORY_LABEL: Record<ReminderCategory, string> = {
  supplement:  'Supplements',
  testing:     'Testing',
  hydration:   'Hydration',
  intimacy:    'Intimacy',
  breathwork:  'Breathwork',
  medication:  'Medication',
  appointment: 'Appointments',
  custom:      'Custom',
};

interface QuickAddPreset {
  key: string;
  label: string;
  template: Omit<Reminder, 'id' | 'createdAt' | 'completions'>;
}

const QUICK_ADD: QuickAddPreset[] = [
  {
    key: 'morning-supplements',
    label: 'Morning supplements · 8:00',
    template: {
      title: 'Morning supplements',
      body: 'Take with breakfast',
      category: 'supplement',
      emoji: '💊',
      time: '08:00',
      repeat: 'daily',
      enabled: true,
      notifyBrowser: true,
    },
  },
  {
    key: 'evening-supplements',
    label: 'Evening supplements · 8:00pm',
    template: {
      title: 'Evening supplements',
      body: 'Bedtime stack — magnesium, melatonin, etc.',
      category: 'supplement',
      emoji: '🌙',
      time: '20:00',
      repeat: 'daily',
      enabled: true,
      notifyBrowser: true,
    },
  },
  {
    key: 'lh-test',
    label: 'LH test · 10am daily',
    template: {
      title: 'LH test',
      body: 'Mid-morning Inito or strip — avoid first-morning urine unless tapered.',
      category: 'testing',
      emoji: '🧪',
      time: '10:00',
      repeat: 'daily',
      enabled: true,
      notifyBrowser: true,
    },
  },
  {
    key: 'hydration-taper',
    label: 'Hydration taper · 8pm',
    template: {
      title: 'Taper water for tomorrow\'s test',
      body: 'Stop big fluid intake so tomorrow\'s sample is concentrated.',
      category: 'hydration',
      emoji: '💧',
      time: '20:00',
      repeat: 'daily',
      enabled: true,
      notifyBrowser: true,
    },
  },
];

export default function Reminders() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const cycle = useCurrentCycle();
  const cycleDay = useMemo(() => {
    if (!cycle) return null;
    const start = new Date(cycle.startDate + 'T00:00:00');
    const now = new Date(todayStr + 'T00:00:00');
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [cycle, todayStr]);

  const remindersQuery = useLiveQuery(() => remindersDb.reminders.toArray(), []);
  const reminders = useMemo(() => remindersQuery ?? [], [remindersQuery]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [flashingId, setFlashingId] = useState<number | null>(null);

  // Schedule today's reminders (browser notifications + in-app flash)
  useEffect(() => {
    if (reminders.length === 0) return;
    const cancel = scheduleTodaysReminders(reminders, cycleDay, (r) => {
      if (r.id != null) {
        setFlashingId(r.id);
        window.setTimeout(() => setFlashingId((v) => (v === r.id ? null : v)), 4000);
      }
    });
    return cancel;
  }, [reminders, cycleDay]);

  async function handleEnableNotifications() {
    const ok = await requestNotificationPermission();
    setNotifPermission(
      typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    );
    if (ok) {
      // No-op; next effect cycle will reschedule on reminders change.
    }
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(r: Reminder) {
    setEditing(r);
    setEditorOpen(true);
  }

  async function handleQuickAdd(preset: QuickAddPreset) {
    const full: Omit<Reminder, 'id'> = {
      ...preset.template,
      createdAt: new Date().toISOString(),
      completions: [],
    };
    const id = await remindersDb.reminders.add(full as Reminder);
    const created = await remindersDb.reminders.get(id as number);
    if (created) {
      setEditing(created);
      setEditorOpen(true);
    }
  }

  async function handleToggleComplete(r: Reminder) {
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

  const dueToday = remindersDueToday(reminders, new Date(), cycleDay);

  const grouped = useMemo(() => {
    const map = new Map<ReminderCategory, Reminder[]>();
    for (const r of reminders) {
      const arr = map.get(r.category) ?? [];
      arr.push(r);
      map.set(r.category, arr);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [reminders]);

  // Weekly history — reminders completed in the last 7 days
  const weekHistory = useMemo(() => {
    const cutoff = format(subDays(new Date(), 6), 'yyyy-MM-dd');
    return reminders
      .map(r => ({
        reminder: r,
        recent: r.completions.filter(c => c.substring(0, 10) >= cutoff),
      }))
      .filter(entry => entry.recent.length > 0)
      .sort((a, b) => b.recent.length - a.recent.length);
  }, [reminders]);

  const isEmpty = reminders.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800 flex items-center gap-2">
            <Bell size={20} className="text-warm-600" strokeWidth={1.75} />
            Reminders
          </h1>
          <p className="text-warm-400 text-sm mt-1">
            Supplements, testing, hydration, intimacy — iyla can nudge you on any of it.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-warm-800 text-white px-5 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm active:scale-[0.97]"
        >
          <Plus size={16} strokeWidth={2.5} />
          New
        </button>
      </div>

      {/* Notification permission banner */}
      {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
        <div className="flex items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
              <BellOff size={16} className="text-amber-600" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-warm-800">Turn on browser notifications</p>
              <p className="text-xs text-warm-500">
                iyla can only ping you with browser notifications when your tab is open.
              </p>
            </div>
          </div>
          <button
            onClick={handleEnableNotifications}
            className="shrink-0 px-4 py-2 bg-amber-500 text-white text-xs font-medium rounded-xl hover:bg-amber-600 transition-colors"
          >
            Turn on
          </button>
        </div>
      )}
      {notifPermission === 'unsupported' && (
        <div className="flex items-center gap-3 p-4 bg-warm-50 border border-warm-100 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
            <BellOff size={16} className="text-warm-400" strokeWidth={1.75} />
          </div>
          <p className="text-xs text-warm-500 leading-relaxed">
            This browser doesn't support notifications. Reminders will still show as in-app cards while iyla is open.
          </p>
        </div>
      )}

      {/* Empty state + quick-add */}
      {isEmpty ? (
        <div className="bg-white rounded-3xl border border-warm-100 p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-warm-50 mx-auto flex items-center justify-center mb-4">
            <Sparkles size={22} className="text-warm-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-semibold text-warm-800">No reminders yet</h2>
          <p className="text-sm text-warm-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            iyla can remind you about supplements, LH testing, hydration, and more. Tap + New to start, or pick a preset below.
          </p>
          <div className="grid sm:grid-cols-2 gap-2 mt-6 max-w-xl mx-auto">
            {QUICK_ADD.map(p => (
              <button
                key={p.key}
                onClick={() => handleQuickAdd(p)}
                className="flex items-center gap-2.5 px-4 py-3 bg-warm-50 rounded-2xl text-left hover:bg-warm-100 transition-colors"
              >
                <span className="text-lg">{p.template.emoji ?? defaultEmoji(p.template.category)}</span>
                <span className="text-sm font-medium text-warm-700">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Quick add row */}
          <div>
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-warm-300 mb-2">
              Quick add
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ADD.map(p => (
                <button
                  key={p.key}
                  onClick={() => handleQuickAdd(p)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-warm-100 rounded-2xl text-xs font-medium text-warm-600 hover:bg-warm-50 transition-colors"
                >
                  <span className="text-sm">{p.template.emoji ?? defaultEmoji(p.template.category)}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Today section */}
          {dueToday.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-warm-300">
                  Today
                </p>
                <p className="text-[10px] text-warm-300">
                  {dueToday.length} due
                </p>
              </div>
              <div className="space-y-2">
                {dueToday.map(r => (
                  <div key={r.id} className={flashingId === r.id ? 'ring-2 ring-teal-300 rounded-3xl transition-all' : ''}>
                    <ReminderCard
                      reminder={r}
                      onEdit={openEdit}
                      onToggleComplete={handleToggleComplete}
                      completedToday={r.completions.some(c => c.substring(0, 10) === todayStr)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All reminders grouped by category */}
          <div>
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-warm-300 mb-2">
              All reminders
            </p>
            <div className="space-y-5">
              {CATEGORY_ORDER.filter(c => (grouped.get(c)?.length ?? 0) > 0).map(c => (
                <div key={c}>
                  <p className="text-xs font-semibold text-warm-500 px-1 mb-2 flex items-center gap-1.5">
                    <span>{defaultEmoji(c)}</span>
                    {CATEGORY_LABEL[c]}
                  </p>
                  <div className="space-y-2">
                    {(grouped.get(c) ?? []).map(r => (
                      <ReminderCard
                        key={r.id}
                        reminder={r}
                        onEdit={openEdit}
                        onToggleComplete={handleToggleComplete}
                        completedToday={r.completions.some(cc => cc.substring(0, 10) === todayStr)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* History */}
          {weekHistory.length > 0 && (
            <div className="bg-white rounded-3xl border border-warm-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setHistoryOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-warm-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Flame size={15} className="text-amber-500" strokeWidth={1.75} />
                  <span className="text-sm font-semibold text-warm-700">This week</span>
                  <span className="text-[10px] text-warm-400 font-medium">{weekHistory.length} active</span>
                </div>
                <ChevronDown
                  size={16}
                  strokeWidth={1.5}
                  className={`text-warm-400 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {historyOpen && (
                <div className="px-5 py-4 border-t border-warm-100 space-y-2">
                  {weekHistory.map(({ reminder: r, recent }) => {
                    const streak = computeStreak(r);
                    return (
                      <div key={r.id} className="flex items-center gap-3 py-1.5">
                        <span className="text-base">{r.emoji || defaultEmoji(r.category)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-warm-700 truncate">{r.title}</p>
                          <p className="text-xs text-warm-400">
                            {recent.length} completion{recent.length === 1 ? '' : 's'} this week
                          </p>
                        </div>
                        {streak > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Flame size={10} strokeWidth={2.5} />
                            {streak}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ReminderEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        reminder={editing}
      />
    </div>
  );
}
