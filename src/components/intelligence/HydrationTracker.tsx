import { useState, useEffect } from 'react';
import { Droplet, Moon, Sun, Bell, BellOff, Check } from 'lucide-react';
import {
  getHydration,
  saveHydration,
  isReminderEnabled,
  setReminderEnabled,
  requestNotificationPermission,
  rateMorningTestConditions,
  type HydrationEntry,
  type SampleQualityRating,
} from '../../lib/hydration';

interface Props {
  date: string;                  // ISO yyyy-MM-dd
  inFertileWindow?: boolean;     // shows a more prominent "this matters" note
}

const RATING_STYLE: Record<SampleQualityRating, { bg: string; border: string; text: string; label: string }> = {
  excellent: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Excellent conditions' },
  good: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', label: 'Good conditions' },
  fair: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Fair conditions' },
  compromised: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', label: 'Likely dilute' },
};

export default function HydrationTracker({ date, inFertileWindow = false }: Props) {
  const [entry, setEntry] = useState<HydrationEntry>(() => {
    const existing = getHydration(date);
    return existing ?? {
      date,
      taperedWater: false,
      morningFirstPee: false,
    };
  });
  const [reminderOn, setReminderOn] = useState(isReminderEnabled());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | null>(null);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }
  }, []);

  function update(patch: Partial<HydrationEntry>) {
    const next = { ...entry, ...patch, date };
    setEntry(next);
    saveHydration(next);
  }

  async function toggleReminders() {
    const next = !reminderOn;
    setReminderOn(next);
    setReminderEnabled(next);
    if (next && permission !== 'granted') {
      const result = await requestNotificationPermission();
      setPermission(result);
    }
  }

  const rating = rateMorningTestConditions(entry);
  const style = RATING_STYLE[rating.rating];

  return (
    <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-sky-500 flex items-center justify-center shrink-0">
            <Droplet size={16} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-warm-800">Hydration & test quality</h3>
            <p className="text-xs text-warm-400 mt-0.5">
              The #1 cause of bad Inito readings is dilute urine. Track it.
            </p>
          </div>
        </div>
        <button
          onClick={toggleReminders}
          className={`p-2 rounded-xl transition-all ${reminderOn ? 'bg-cyan-50 text-cyan-600' : 'bg-warm-50 text-warm-400'}`}
          title={reminderOn ? 'Evening reminders on' : 'Evening reminders off'}
        >
          {reminderOn ? <Bell size={14} strokeWidth={2} /> : <BellOff size={14} strokeWidth={2} />}
        </button>
      </div>

      {/* Rating chip */}
      <div className={`${style.bg} ${style.border} border rounded-2xl px-4 py-3 mb-5`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${style.text}`}>
            Today&apos;s sample conditions
          </span>
          <span className={`text-[10px] font-bold ${style.text}`}>· {style.label}</span>
        </div>
        <p className={`text-xs ${style.text} leading-relaxed`}>{rating.message}</p>
      </div>

      {/* Toggles */}
      <div className="space-y-2.5">
        <ToggleRow
          icon={<Moon size={14} className="text-indigo-500" strokeWidth={2} />}
          label="Tapered water after 7pm last night"
          value={entry.taperedWater}
          onChange={(v) => update({ taperedWater: v })}
        />
        <ToggleRow
          icon={<Sun size={14} className="text-amber-500" strokeWidth={2} />}
          label="Used first-morning urine for testing"
          value={entry.morningFirstPee}
          onChange={(v) => update({ morningFirstPee: v })}
        />
      </div>

      {/* Mid-day water hold (only if not first-morning) */}
      {!entry.morningFirstPee && (
        <div className="mt-4 pt-4 border-t border-warm-100">
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-warm-600">
              Hours since last drink before test
            </span>
            <input
              type="number"
              min={0}
              max={8}
              step={0.5}
              value={entry.waterHoldHoursBeforeTest ?? ''}
              onChange={e => update({ waterHoldHoursBeforeTest: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="—"
              className="w-20 px-3 py-1.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-warm-800 focus:outline-none focus:border-warm-400 text-right tabular-nums"
            />
          </label>
        </div>
      )}

      {/* Permission callout */}
      {reminderOn && permission === 'default' && (
        <div className="mt-4 px-3 py-2.5 bg-sky-50 rounded-xl text-[11px] text-sky-700 leading-relaxed">
          Enable browser notifications to receive the 7pm taper reminder on fertile-window days.
        </div>
      )}
      {reminderOn && permission === 'denied' && (
        <div className="mt-4 px-3 py-2.5 bg-rose-50 rounded-xl text-[11px] text-rose-700 leading-relaxed">
          Notifications are blocked in your browser. Enable them in site settings to get evening reminders.
        </div>
      )}

      {inFertileWindow && rating.rating === 'compromised' && (
        <div className="mt-4 px-3 py-2.5 bg-amber-50 rounded-xl text-[11px] text-amber-700 leading-relaxed">
          You&apos;re in your fertile window — tonight matters. Set a phone alarm for 7pm to taper water.
        </div>
      )}
    </div>
  );
}

function ToggleRow({ icon, label, value, onChange }: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-all ${
        value
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-warm-50 border-warm-150 hover:bg-warm-100'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span className={`text-sm text-left ${value ? 'text-emerald-800 font-medium' : 'text-warm-600'}`}>
          {label}
        </span>
      </div>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
        value ? 'bg-emerald-500' : 'bg-white border border-warm-200'
      }`}>
        {value && <Check size={13} className="text-white" strokeWidth={3} />}
      </div>
    </button>
  );
}
