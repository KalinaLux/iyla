import { useState } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { Sparkles, Heart, Baby, ArrowRight } from 'lucide-react';
import Modal from '../Modal';
import { db } from '../../lib/db';
import { pregnancyDb } from '../../lib/pregnancy-db';
import {
  computeDueDate,
  setPregnancyModeFlag,
} from '../../lib/pregnancy';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const FEELING_TONES: { value: string; label: string; emoji: string }[] = [
  { value: 'elated', label: 'Elated', emoji: '✨' },
  { value: 'shocked', label: 'Shocked', emoji: '😶' },
  { value: 'grateful', label: 'Grateful', emoji: '🙏' },
  { value: 'scared', label: 'Scared', emoji: '🫣' },
  { value: 'cautious', label: 'Cautious', emoji: '🤞' },
  { value: 'numb', label: 'Numb', emoji: '🌫️' },
  { value: 'hopeful', label: 'Hopeful', emoji: '🌱' },
  { value: 'all_of_it', label: 'All of it', emoji: '💗' },
];

export default function PregnancyTransitionModal({ open, onClose, onComplete }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  // Default LMP guess: 28 days before today (will usually be overridden, but gives a sane anchor).
  const [lmpDate, setLmpDate] = useState<string>(format(subDays(new Date(), 28), 'yyyy-MM-dd'));
  const [positiveDate, setPositiveDate] = useState<string>(today);
  const [mood, setMood] = useState<number>(7);
  const [tone, setTone] = useState<string>('hopeful');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const dueDate = lmpDate ? computeDueDate(lmpDate) : '';
  const conceptionDate = lmpDate
    ? format(addDays(new Date(lmpDate + 'T00:00:00'), 14), 'yyyy-MM-dd')
    : undefined;

  async function handleBegin() {
    if (!lmpDate || !positiveDate) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await pregnancyDb.pregnancies.add({
        lmpDate,
        conceptionDate,
        positiveTestDate: positiveDate,
        estimatedDueDate: dueDate,
        status: 'active',
        notes: note
          ? `${note}${tone ? `\n\nFeeling: ${tone} (${mood}/10)` : ''}`
          : tone
            ? `Feeling: ${tone} (${mood}/10)`
            : undefined,
        createdAt: now,
        updatedAt: now,
      });

      // Mark the current ongoing cycle as 'positive' outcome so it's archived
      // out of the active-cycle rotation. (CycleOutcome enum has no 'pregnant'
      // — 'positive' is the closest existing value.)
      const ongoing = await db.cycles.where('outcome').equals('ongoing').first();
      if (ongoing?.id) {
        await db.cycles.update(ongoing.id, { outcome: 'positive' });
      }

      setPregnancyModeFlag(true);
      onComplete();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Begin pregnancy mode" maxWidth="max-w-xl">
      <div className="space-y-6">
        {/* Hero */}
        <div className="rounded-3xl bg-gradient-to-br from-lavender-100 via-rose-50 to-honey-50 p-6 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-white/70 backdrop-blur-sm flex items-center justify-center shadow-sm">
              <Baby size={22} className="text-lavender-600" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-warm-500">
                Positive test
              </p>
              <h3 className="text-lg font-semibold text-warm-800">
                Your body just did the most extraordinary thing.
              </h3>
            </div>
          </div>
          <p className="text-sm text-warm-600 leading-relaxed">
            Let's walk with you through this. iyla will pause fertile-window tracking,
            start pregnancy week counting from your LMP, and surface what actually matters
            week by week.
          </p>
        </div>

        {/* LMP */}
        <div>
          <label className="block text-sm font-medium text-warm-700 mb-1.5">
            First day of last period (LMP)
          </label>
          <input
            type="date"
            value={lmpDate}
            max={today}
            onChange={(e) => setLmpDate(e.target.value)}
            className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300 focus:border-transparent"
          />
          <p className="text-xs text-warm-400 mt-1.5">
            Pregnancy is dated from the first day of your last period, not conception.
          </p>
        </div>

        {/* Positive test date */}
        <div>
          <label className="block text-sm font-medium text-warm-700 mb-1.5">
            When did you get the positive test?
          </label>
          <input
            type="date"
            value={positiveDate}
            max={today}
            onChange={(e) => setPositiveDate(e.target.value)}
            className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300 focus:border-transparent"
          />
        </div>

        {/* Computed summary */}
        {dueDate && (
          <div className="bg-warm-50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-warm-400">
                Estimated due date
              </p>
              <p className="text-base font-semibold text-warm-800 mt-0.5">
                {format(new Date(dueDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <Sparkles size={18} className="text-lavender-500" strokeWidth={1.5} />
          </div>
        )}

        {/* Feeling tone */}
        <div>
          <label className="block text-sm font-medium text-warm-700 mb-2">
            How are you feeling right now?
          </label>
          <div className="flex flex-wrap gap-2">
            {FEELING_TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTone(t.value)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  tone === t.value
                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                    : 'border-warm-200 text-warm-500 hover:bg-warm-50'
                }`}
              >
                <span>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mood slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-warm-700">
              Overall mood today
            </label>
            <span className="text-xs font-semibold text-warm-600">{mood}/10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={mood}
            onChange={(e) => setMood(parseInt(e.target.value, 10))}
            className="w-full accent-lavender-500"
          />
          <div className="flex justify-between text-[10px] text-warm-400 mt-1 px-0.5">
            <span>heavy</span>
            <span>steady</span>
            <span>soaring</span>
          </div>
        </div>

        {/* Tell iyla */}
        <div>
          <label className="block text-sm font-medium text-warm-700 mb-1.5">
            Want to tell iyla anything? <span className="text-warm-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="A line for future you to read."
            className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-lavender-300 focus:border-transparent placeholder:text-warm-300 resize-none"
          />
        </div>

        {/* CTA */}
        <button
          onClick={handleBegin}
          disabled={!lmpDate || !positiveDate || saving}
          className="w-full bg-gradient-to-r from-rose-400 via-lavender-500 to-lavender-600 text-white py-4 rounded-2xl text-sm font-semibold hover:shadow-lg hover:shadow-lavender-200/50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? 'Starting…' : 'Begin pregnancy mode'}
          <ArrowRight size={16} strokeWidth={2} />
        </button>

        {/* Gentle loss note */}
        <div className="flex items-start gap-3 px-4 py-3.5 bg-warm-50/70 border border-warm-100 rounded-2xl">
          <Heart size={14} className="text-warm-400 shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-xs text-warm-500 leading-relaxed">
            Loss in early pregnancy is common, and it is not your fault if it happens.
            iyla will be here either way — with warmth and without assumptions.
          </p>
        </div>
      </div>
    </Modal>
  );
}
