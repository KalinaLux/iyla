import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Bell, Clock, Calendar, Repeat, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { remindersDb } from '../lib/reminders-db';
import type { Reminder, ReminderCategory, ReminderRepeat } from '../lib/reminders-db';
import { defaultEmoji } from '../lib/reminders';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When editing, existing reminder; when creating, null */
  reminder: Reminder | null;
}

const CATEGORIES: { value: ReminderCategory; label: string }[] = [
  { value: 'supplement',  label: 'Supplement' },
  { value: 'testing',     label: 'Testing' },
  { value: 'hydration',   label: 'Hydration' },
  { value: 'intimacy',    label: 'Intimacy' },
  { value: 'breathwork',  label: 'Breathwork' },
  { value: 'medication',  label: 'Medication' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'custom',      label: 'Custom' },
];

const REPEAT_OPTIONS: { value: ReminderRepeat; label: string }[] = [
  { value: 'once',          label: 'Once' },
  { value: 'daily',         label: 'Daily' },
  { value: 'weekdays',      label: 'Weekdays (Mon–Fri)' },
  { value: 'specific-days', label: 'Specific days' },
  { value: 'weekly',        label: 'Weekly' },
  { value: 'cycle-day',     label: 'Every cycle on day…' },
];

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMOJI_PICKS = ['💊', '🧪', '💧', '💕', '🌬', '📅', '✨', '🌸', '🌙', '☀️'];

export default function ReminderEditorModal({ open, onClose, reminder }: Props) {
  const isEditing = !!reminder;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<ReminderCategory>('custom');
  const [emoji, setEmoji] = useState<string>('');
  const [time, setTime] = useState('08:00');
  const [repeat, setRepeat] = useState<ReminderRepeat>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [cycleDay, setCycleDay] = useState<number>(14);
  const [oneTimeDate, setOneTimeDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [enabled, setEnabled] = useState(true);
  const [notifyBrowser, setNotifyBrowser] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (reminder) {
      setTitle(reminder.title);
      setBody(reminder.body ?? '');
      setCategory(reminder.category);
      setEmoji(reminder.emoji ?? '');
      setTime(reminder.time);
      setRepeat(reminder.repeat);
      setDaysOfWeek(reminder.daysOfWeek ?? []);
      setCycleDay(reminder.cycleDay ?? 14);
      setOneTimeDate(reminder.oneTimeDate ?? format(new Date(), 'yyyy-MM-dd'));
      setEnabled(reminder.enabled);
      setNotifyBrowser(reminder.notifyBrowser);
    } else {
      setTitle('');
      setBody('');
      setCategory('custom');
      setEmoji('');
      setTime('08:00');
      setRepeat('daily');
      setDaysOfWeek([]);
      setCycleDay(14);
      setOneTimeDate(format(new Date(), 'yyyy-MM-dd'));
      setEnabled(true);
      setNotifyBrowser(true);
    }
  }, [open, reminder]);

  function toggleDay(d: number) {
    setDaysOfWeek(prev => {
      if (repeat === 'weekly') return prev.includes(d) ? [] : [d];
      return prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort();
    });
  }

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const payload: Omit<Reminder, 'id' | 'createdAt' | 'completions'> = {
        title: trimmed,
        body: body.trim() || undefined,
        category,
        emoji: emoji || undefined,
        time,
        repeat,
        daysOfWeek: (repeat === 'specific-days' || repeat === 'weekly') ? daysOfWeek : undefined,
        cycleDay: repeat === 'cycle-day' ? cycleDay : undefined,
        oneTimeDate: repeat === 'once' ? oneTimeDate : undefined,
        enabled,
        notifyBrowser,
      };
      if (reminder?.id != null) {
        await remindersDb.reminders.update(reminder.id, payload);
      } else {
        await remindersDb.reminders.add({
          ...payload,
          createdAt: new Date().toISOString(),
          completions: [],
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!reminder?.id) return;
    await remindersDb.reminders.delete(reminder.id);
    onClose();
  }

  const currentEmoji = emoji || defaultEmoji(category);

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit reminder' : 'New reminder'} maxWidth="max-w-xl">
      <div className="space-y-5">
        {/* Emoji + Title */}
        <div>
          <label className="text-xs font-medium text-warm-500 mb-1.5 block">Title</label>
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-warm-50 flex items-center justify-center text-2xl shrink-0">
              {currentEmoji}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Morning supplements"
              className="flex-1 px-4 py-3 bg-white border border-warm-200 rounded-2xl text-sm text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-400 transition-colors"
            />
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="text-xs font-medium text-warm-500 mb-1.5 block">Note (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Take with breakfast"
            rows={2}
            className="w-full px-4 py-3 bg-white border border-warm-200 rounded-2xl text-sm text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-400 resize-none transition-colors"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-warm-500 mb-1.5 block">Category</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(c => {
              const isActive = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-2xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-warm-800 text-white shadow-sm'
                      : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
                  }`}
                >
                  <span className="text-lg leading-none">{defaultEmoji(c.value)}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Emoji picker */}
        <div>
          <label className="text-xs font-medium text-warm-500 mb-1.5 block">Emoji (optional)</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setEmoji('')}
              className={`w-9 h-9 rounded-xl text-xs font-medium transition-all ${
                !emoji
                  ? 'bg-warm-800 text-white'
                  : 'bg-warm-50 text-warm-400 hover:bg-warm-100'
              }`}
            >
              auto
            </button>
            {EMOJI_PICKS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all ${
                  emoji === e
                    ? 'bg-warm-100 ring-2 ring-warm-500'
                    : 'bg-warm-50 hover:bg-warm-100'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div>
          <label className="text-xs font-medium text-warm-500 mb-1.5 flex items-center gap-1.5">
            <Clock size={12} strokeWidth={2} />
            Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="px-4 py-3 bg-white border border-warm-200 rounded-2xl text-sm text-warm-800 focus:outline-none focus:border-warm-400 transition-colors"
          />
        </div>

        {/* Repeat */}
        <div>
          <label className="text-xs font-medium text-warm-500 mb-1.5 flex items-center gap-1.5">
            <Repeat size={12} strokeWidth={2} />
            Repeat
          </label>
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
            className="w-full px-4 py-3 bg-white border border-warm-200 rounded-2xl text-sm text-warm-800 focus:outline-none focus:border-warm-400 transition-colors"
          >
            {REPEAT_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Days of week */}
        {(repeat === 'specific-days' || repeat === 'weekly') && (
          <div>
            <label className="text-xs font-medium text-warm-500 mb-1.5 block">
              {repeat === 'weekly' ? 'Pick a day' : 'Pick days'}
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {DOW_LABELS.map((label, i) => {
                const active = daysOfWeek.includes(i);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`py-2 rounded-xl text-xs font-medium transition-all ${
                      active
                        ? 'bg-warm-800 text-white'
                        : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Cycle day */}
        {repeat === 'cycle-day' && (
          <div>
            <label className="text-xs font-medium text-warm-500 mb-1.5 block">Cycle day (1–40)</label>
            <input
              type="number"
              min={1}
              max={40}
              value={cycleDay}
              onChange={(e) => setCycleDay(Math.max(1, Math.min(40, Number.parseInt(e.target.value, 10) || 1)))}
              className="w-32 px-4 py-3 bg-white border border-warm-200 rounded-2xl text-sm text-warm-800 focus:outline-none focus:border-warm-400 transition-colors"
            />
          </div>
        )}

        {/* One-time date */}
        {repeat === 'once' && (
          <div>
            <label className="text-xs font-medium text-warm-500 mb-1.5 flex items-center gap-1.5">
              <Calendar size={12} strokeWidth={2} />
              Date
            </label>
            <input
              type="date"
              value={oneTimeDate}
              onChange={(e) => setOneTimeDate(e.target.value)}
              className="px-4 py-3 bg-white border border-warm-200 rounded-2xl text-sm text-warm-800 focus:outline-none focus:border-warm-400 transition-colors"
            />
          </div>
        )}

        {/* Toggles */}
        <div className="space-y-2.5 pt-2">
          <ToggleRow
            icon={<Bell size={14} strokeWidth={2} />}
            label="Browser notification"
            description="Send a desktop notification when this fires"
            value={notifyBrowser}
            onChange={setNotifyBrowser}
          />
          <ToggleRow
            icon={<span className="text-sm">●</span>}
            label="Enabled"
            description="Turn this reminder on or off without deleting it"
            value={enabled}
            onChange={setEnabled}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-warm-100">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-2.5 text-rose-500 text-sm font-medium rounded-2xl hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={14} strokeWidth={2} />
              Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-warm-500 text-sm font-medium rounded-2xl hover:bg-warm-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !title.trim()}
              onClick={handleSave}
              className="px-5 py-2.5 bg-warm-800 text-white text-sm font-medium rounded-2xl hover:bg-warm-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ToggleRow({
  icon, label, description, value, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-warm-50 rounded-2xl">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-warm-500 shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-warm-700">{label}</p>
          <p className="text-xs text-warm-400 truncate">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-warm-800' : 'bg-warm-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
