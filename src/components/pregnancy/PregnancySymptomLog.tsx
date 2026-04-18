import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check } from 'lucide-react';
import { pregnancyDb } from '../../lib/pregnancy-db';
import { COMMON_SYMPTOMS_BY_TRIMESTER } from '../../lib/pregnancy';

interface Props {
  pregnancyId: number;
  week: number;
  day: number;
  trimester: 1 | 2 | 3;
}

export default function PregnancySymptomLog({ pregnancyId, week, day, trimester }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const existing = useLiveQuery(
    () => pregnancyDb.symptoms.where({ pregnancyId, date: today }).first(),
    [pregnancyId, today],
  );

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<number>(6);
  const [nausea, setNausea] = useState<number>(3);
  const [energy, setEnergy] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (existing) {
      setSymptoms(existing.symptoms ?? []);
      setMood(existing.mood ?? 6);
      setNausea(existing.nausea ?? 3);
      setEnergy(existing.energy ?? 5);
      setNotes(existing.notes ?? '');
    }
  }, [existing]);

  const options = useMemo(() => COMMON_SYMPTOMS_BY_TRIMESTER[trimester], [trimester]);

  function toggle(sym: string) {
    setSymptoms((prev) => (prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]));
  }

  async function save() {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (existing?.id) {
        await pregnancyDb.symptoms.update(existing.id, {
          symptoms,
          mood,
          nausea,
          energy,
          notes,
          week,
          day,
        });
      } else {
        await pregnancyDb.symptoms.add({
          pregnancyId,
          date: today,
          week,
          day,
          symptoms,
          mood,
          nausea,
          energy,
          notes,
          createdAt: now,
        });
      }
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold text-warm-800">How are you today?</h3>
        <p className="text-xs text-warm-400 mt-0.5">
          A quick log — whatever is true right now.
        </p>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SliderRow label="Mood" accent="lavender" value={mood} onChange={setMood} left="heavy" right="light" />
        <SliderRow label="Nausea" accent="rose" value={nausea} onChange={setNausea} left="none" right="intense" />
        <SliderRow label="Energy" accent="honey" value={energy} onChange={setEnergy} left="depleted" right="full" />
      </div>

      {/* Symptoms */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2.5">
          Common in trimester {trimester}
        </p>
        <div className="flex flex-wrap gap-2">
          {options.map((sym) => {
            const on = symptoms.includes(sym);
            return (
              <button
                key={sym}
                type="button"
                onClick={() => toggle(sym)}
                className={`px-3 py-1.5 rounded-2xl text-xs font-medium border transition-all ${
                  on
                    ? 'bg-lavender-50 border-lavender-300 text-lavender-700'
                    : 'border-warm-200 text-warm-500 hover:bg-warm-50'
                }`}
              >
                {sym}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-warm-400 mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything you want to remember…"
          className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300 focus:border-transparent placeholder:text-warm-300 resize-none"
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-warm-800 text-white py-3 rounded-2xl text-sm font-semibold hover:bg-warm-900 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {savedAt && Date.now() - savedAt < 2500 ? (
          <>
            <Check size={14} strokeWidth={2.5} />
            Saved
          </>
        ) : existing ? 'Update today\'s log' : 'Save today\'s log'}
      </button>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  left: string;
  right: string;
  accent: 'lavender' | 'rose' | 'honey';
}

function SliderRow({ label, value, onChange, left, right, accent }: SliderProps) {
  const accentCls =
    accent === 'lavender'
      ? 'accent-lavender-500'
      : accent === 'rose'
        ? 'accent-rose-400'
        : 'accent-honey-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-warm-700">{label}</span>
        <span className="text-xs font-semibold text-warm-500">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={`w-full ${accentCls}`}
      />
      <div className="flex justify-between text-[10px] text-warm-400 mt-0.5">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}
