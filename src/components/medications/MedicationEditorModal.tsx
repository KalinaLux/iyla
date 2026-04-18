import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Modal from '../Modal';
import {
  medicationsDb,
  type Medication,
  type MedicationFormulation,
  type PregnancyCategory,
} from '../../lib/medications-db';
import { COMMON_MEDICATIONS, FORMULATION_LABELS } from '../../lib/medications';

interface Props {
  open: boolean;
  onClose: () => void;
  medication?: Medication;
}

const FORMULATIONS: MedicationFormulation[] = [
  'tablet',
  'capsule',
  'pill',
  'injection',
  'vaginal_suppository',
  'cream',
  'patch',
  'liquid',
  'other',
];

const PREGNANCY_CATEGORIES: PregnancyCategory[] = ['A', 'B', 'C', 'D', 'X', 'unknown'];

const TAG_COLORS = ['#c9878f', '#d4af61', '#9b8ec4', '#22c55e', '#e0a050', '#6aa5c9'];

export default function MedicationEditorModal({ open, onClose, medication }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const editing = !!medication;

  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [dose, setDose] = useState('');
  const [formulation, setFormulation] = useState<MedicationFormulation>('tablet');
  const [frequency, setFrequency] = useState('');
  const [reason, setReason] = useState('');
  const [prescribedBy, setPrescribedBy] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [pregnancyCategory, setPregnancyCategory] = useState<PregnancyCategory>('unknown');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState<string>(TAG_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    if (medication) {
      setName(medication.name);
      setGenericName(medication.genericName ?? '');
      setDose(medication.dose);
      setFormulation(medication.formulation);
      setFrequency(medication.frequency);
      setReason(medication.reason);
      setPrescribedBy(medication.prescribedBy ?? '');
      setStartDate(medication.startDate);
      setEndDate(medication.endDate ?? '');
      setPregnancyCategory(medication.pregnancyCategory ?? 'unknown');
      setNotes(medication.notes ?? '');
      setColor(medication.color ?? TAG_COLORS[0]);
    } else {
      setName('');
      setGenericName('');
      setDose('');
      setFormulation('tablet');
      setFrequency('');
      setReason('');
      setPrescribedBy('');
      setStartDate(today);
      setEndDate('');
      setPregnancyCategory('unknown');
      setNotes('');
      setColor(TAG_COLORS[0]);
    }
  }, [open, medication, today]);

  function applyCommon(idx: number) {
    const c = COMMON_MEDICATIONS[idx];
    if (!c) return;
    setName(c.name);
    setGenericName(c.genericName ?? '');
    setDose(c.typical_dose);
    setFormulation(c.typical_formulation);
    setFrequency(c.typical_frequency);
    setReason(c.common_reason);
    setPregnancyCategory(c.category);
  }

  async function handleSave() {
    if (!name.trim() || !dose.trim() || !frequency.trim() || !reason.trim()) return;
    const now = new Date().toISOString();
    const payload: Omit<Medication, 'id'> = {
      name: name.trim(),
      genericName: genericName.trim() || undefined,
      dose: dose.trim(),
      formulation,
      frequency: frequency.trim(),
      reason: reason.trim(),
      prescribedBy: prescribedBy.trim() || undefined,
      startDate,
      endDate: endDate || undefined,
      active: medication?.active ?? true,
      sideEffects: medication?.sideEffects ?? [],
      pregnancyCategory,
      notes: notes.trim() || undefined,
      color,
      createdAt: medication?.createdAt ?? now,
      updatedAt: now,
    };
    if (editing && medication?.id) {
      await medicationsDb.medications.update(medication.id, payload);
    } else {
      await medicationsDb.medications.add(payload as Medication);
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit medication' : 'Add medication'}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {!editing && (
          <div>
            <p className="block text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">
              Add from common
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMON_MEDICATIONS.map((m, i) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => applyCommon(i)}
                  className="px-3 py-1.5 rounded-2xl text-xs font-medium border border-warm-200 text-warm-600 hover:bg-warm-50 hover:border-warm-300 transition-all"
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-warm-600 mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Progesterone"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-warm-600 mb-1">
              Brand / generic
            </label>
            <input
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              placeholder="Crinone"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300 placeholder:text-warm-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Dose *</label>
            <input
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="200mg"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Formulation</label>
            <select
              value={formulation}
              onChange={(e) => setFormulation(e.target.value as MedicationFormulation)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            >
              {FORMULATIONS.map((f) => (
                <option key={f} value={f}>
                  {FORMULATION_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-warm-600 mb-1">Frequency *</label>
            <input
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="Twice daily (morning and bedtime)"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-warm-600 mb-1">Reason *</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Luteal support"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Prescribed by</label>
            <input
              value={prescribedBy}
              onChange={(e) => setPrescribedBy(e.target.value)}
              placeholder="Dr. Name"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300 placeholder:text-warm-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Pregnancy category</label>
            <select
              value={pregnancyCategory}
              onChange={(e) => setPregnancyCategory(e.target.value as PregnancyCategory)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            >
              {PREGNANCY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'unknown' ? 'Unknown' : `Category ${c}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-600 mb-1">End date (optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-warm-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Instructions, reminders, things your provider said…"
              className="w-full border border-warm-200 rounded-2xl px-4 py-2.5 text-sm bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300 placeholder:text-warm-300 resize-none"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-warm-600 mb-2">Tag color</label>
            <div className="flex gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-warm-400' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-warm-400 hover:text-warm-600 rounded-2xl"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !dose.trim() || !frequency.trim() || !reason.trim()}
            className="px-6 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all disabled:opacity-50 shadow-sm"
          >
            {editing ? 'Save changes' : 'Add medication'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
