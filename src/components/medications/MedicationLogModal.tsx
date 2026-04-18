import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Modal from '../Modal';
import { medicationsDb, type Medication } from '../../lib/medications-db';

interface Props {
  open: boolean;
  onClose: () => void;
  medication?: Medication;
}

type Outcome = 'taken' | 'skipped';

const SKIP_REASONS = [
  'Forgot',
  'Out of medication',
  'Side effects',
  'Provider instruction',
  'Feeling unwell',
  'Other',
];

export default function MedicationLogModal({ open, onClose, medication }: Props) {
  const now = new Date();
  const [outcome, setOutcome] = useState<Outcome>('taken');
  const [time, setTime] = useState<string>(format(now, 'HH:mm'));
  const [date, setDate] = useState<string>(format(now, 'yyyy-MM-dd'));
  const [skipReason, setSkipReason] = useState<string>(SKIP_REASONS[0]);
  const [sideEffects, setSideEffects] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const n = new Date();
    setOutcome('taken');
    setTime(format(n, 'HH:mm'));
    setDate(format(n, 'yyyy-MM-dd'));
    setSkipReason(SKIP_REASONS[0]);
    setSideEffects('');
    setNotes('');
  }, [open]);

  if (!medication) return null;

  async function save() {
    if (!medication?.id) return;
    setSaving(true);
    try {
      const sideArr = sideEffects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await medicationsDb.logs.add({
        medicationId: medication.id,
        date,
        time,
        taken: outcome === 'taken',
        skipReason: outcome === 'skipped' ? skipReason : undefined,
        sideEffectsNoted: sideArr.length ? sideArr : undefined,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      });

      // Merge new side effects into the medication record for pattern detection.
      if (sideArr.length) {
        const existing = medication.sideEffects ?? [];
        const merged = Array.from(new Set([...existing, ...sideArr]));
        await medicationsDb.medications.update(medication.id, {
          sideEffects: merged,
          updatedAt: new Date().toISOString(),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Log dose — ${medication.name}`}>
      <div className="space-y-5">
        <div className="flex gap-2">
          {(['taken', 'skipped'] as Outcome[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOutcome(o)}
              className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all capitalize ${
                outcome === o
                  ? o === 'taken'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-rose-400 text-white shadow-sm'
                  : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
              }`}
            >
              {o}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>
        </div>

        {outcome === 'skipped' && (
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Reason</label>
            <select
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            >
              {SKIP_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-warm-600 mb-1">
            Side effects noted <span className="text-warm-400 font-normal">(comma-separated)</span>
          </label>
          <input
            value={sideEffects}
            onChange={(e) => setSideEffects(e.target.value)}
            placeholder="headache, dizziness"
            className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300 placeholder:text-warm-300"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-warm-600 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything your future self should remember."
            className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300 placeholder:text-warm-300 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-warm-400 hover:text-warm-600 rounded-2xl"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all disabled:opacity-60 shadow-sm"
          >
            Save log
          </button>
        </div>
      </div>
    </Modal>
  );
}
