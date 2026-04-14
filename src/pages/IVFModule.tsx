import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import {
  Syringe,
  Pill,
  Activity,
  Egg,
  Heart,
  Table2,
  Plus,
  Trash2,
  ChevronDown,
  Snowflake,
  ArrowRight,
  TrendingUp,
  Check,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type {
  IVFCycle,
  IVFProtocol,
  IVFCycleStatus,
  StimDay,
  StimMedication,
  EggRetrievalOutcome,
  EmbryoGrade,
  BetaHCG,
  PGTResult,
} from '../lib/ivf-types';
import {
  COMMON_IVF_MEDICATIONS,
  IVF_PROTOCOL_LABELS,
  IVF_STATUS_LABELS,
  calculateDoublingTime,
} from '../lib/ivf-types';

const today = format(new Date(), 'yyyy-MM-dd');

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Cycle Overview Card ────────────────────────────────────────────

function CycleOverviewCard({
  cycle,
  stimDays,
  onUpdateStatus,
}: {
  cycle: IVFCycle;
  stimDays: StimDay[];
  onUpdateStatus: (status: IVFCycleStatus) => void;
}) {
  const dayCount = differenceInDays(new Date(), new Date(cycle.startDate)) + 1;
  const statusOrder: IVFCycleStatus[] = [
    'stimming', 'triggered', 'retrieved', 'fertilization', 'transfer', 'beta', 'complete',
  ];
  const currentIdx = statusOrder.indexOf(cycle.status);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-400 to-purple-500 p-6 text-white shadow-lg">
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-white/10" />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Current IVF Cycle</p>
            <h2 className="mt-1 text-2xl font-bold">{IVF_PROTOCOL_LABELS[cycle.protocol]}</h2>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/20 px-3 py-1.5 backdrop-blur-sm">
            <Sparkles size={14} />
            <span className="text-sm font-semibold">Day {dayCount}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <div className="rounded-2xl bg-white/15 px-4 py-2 backdrop-blur-sm">
            <p className="text-xs text-white/70">Status</p>
            <p className="text-sm font-semibold">{IVF_STATUS_LABELS[cycle.status]}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-2 backdrop-blur-sm">
            <p className="text-xs text-white/70">Stim Days</p>
            <p className="text-sm font-semibold">{stimDays.length}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-2 backdrop-blur-sm">
            <p className="text-xs text-white/70">Started</p>
            <p className="text-sm font-semibold">{format(new Date(cycle.startDate), 'MMM d')}</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-1">
            {statusOrder.map((s, i) => (
              <div key={s} className="flex flex-1 items-center">
                <button
                  onClick={() => onUpdateStatus(s)}
                  className={`h-2 w-full rounded-full transition-all ${
                    i <= currentIdx ? 'bg-white' : 'bg-white/25'
                  }`}
                  title={IVF_STATUS_LABELS[s]}
                />
                {i < statusOrder.length - 1 && <div className="w-1" />}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-white/60">
            <span>Stim</span>
            <span>Trigger</span>
            <span>ER</span>
            <span>Fert</span>
            <span>ET</span>
            <span>Beta</span>
            <span>Done</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Medication Schedule ────────────────────────────────────────────

function MedicationSchedule({
  medications,
  checkedMeds,
  onToggleMed,
  onAddMed,
  onRemoveMed,
}: {
  medications: StimMedication[];
  checkedMeds: Set<string>;
  onToggleMed: (key: string) => void;
  onAddMed: (med: StimMedication) => void;
  onRemoveMed: (idx: number) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState<string>(COMMON_IVF_MEDICATIONS[0]);
  const [newDose, setNewDose] = useState('');
  const [newUnit, setNewUnit] = useState('IU');
  const [newTime, setNewTime] = useState('PM');

  const handleAdd = () => {
    if (!newDose) return;
    onAddMed({ name: newName, dose: Number(newDose), unit: newUnit, time: newTime });
    setNewDose('');
    setShowAdd(false);
  };

  return (
    <div className="rounded-3xl border border-warm-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-50">
            <Pill size={18} className="text-fuchsia-500" />
          </div>
          <h3 className="text-base font-semibold text-warm-800">Medication Schedule</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-2xl bg-warm-800 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
        >
          <Plus size={14} />
          Add Med
        </button>
      </div>

      {showAdd && (
        <div className="mt-4 rounded-2xl border border-warm-100 bg-warm-50 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-warm-400">Medication</label>
              <div className="relative">
                <select
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
                >
                  {COMMON_IVF_MEDICATIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-warm-400" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Dose</label>
              <input
                type="number"
                value={newDose}
                onChange={(e) => setNewDose(e.target.value)}
                placeholder="e.g. 225"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Unit</label>
              <div className="relative">
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
                >
                  <option>IU</option>
                  <option>mg</option>
                  <option>mcg</option>
                  <option>mL</option>
                  <option>units</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-warm-400" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Time</label>
              <div className="relative">
                <select
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
                >
                  <option>AM</option>
                  <option>PM</option>
                  <option>Evening</option>
                  <option>Bedtime</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-warm-400" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-2xl px-4 py-2 text-xs font-medium text-warm-400 transition-colors hover:text-warm-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="rounded-2xl bg-warm-800 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {medications.length === 0 ? (
          <p className="py-6 text-center text-sm text-warm-400">
            No medications added yet. Tap "Add Med" to get started.
          </p>
        ) : (
          medications.map((med, idx) => {
            const key = `${med.name}-${med.time}-${idx}`;
            const checked = checkedMeds.has(key);
            return (
              <div
                key={key}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-all ${
                  checked
                    ? 'border-green-200 bg-green-50'
                    : 'border-warm-100 bg-warm-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onToggleMed(key)}
                    className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all ${
                      checked
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-warm-300 bg-white'
                    }`}
                  >
                    {checked && <Check size={14} />}
                  </button>
                  <div>
                    <p className={`text-sm font-medium ${checked ? 'text-warm-400 line-through' : 'text-warm-800'}`}>
                      {med.name}
                    </p>
                    <p className="text-xs text-warm-400">
                      {med.dose} {med.unit} · {med.time}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveMed(idx)}
                  className="rounded-xl p-1.5 text-warm-300 transition-colors hover:bg-warm-100 hover:text-warm-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Monitoring Log ─────────────────────────────────────────────────

function MonitoringLog({
  stimDays,
  onAddStimDay,
}: {
  stimDays: StimDay[];
  onAddStimDay: (day: Omit<StimDay, 'id' | 'ivfCycleId'>) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate] = useState(today);
  const [estradiol, setEstradiol] = useState('');
  const [lining, setLining] = useState('');
  const [leftFollicles, setLeftFollicles] = useState('');
  const [rightFollicles, setRightFollicles] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    const parseFollicles = (s: string) =>
      s.split(',').map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));

    onAddStimDay({
      dayNumber: stimDays.length + 1,
      date,
      medications: [],
      estradiol: estradiol ? Number(estradiol) : undefined,
      liningThickness: lining ? Number(lining) : undefined,
      follicleCounts: {
        left: parseFollicles(leftFollicles),
        right: parseFollicles(rightFollicles),
      },
      notes: notes || undefined,
    });
    setEstradiol('');
    setLining('');
    setLeftFollicles('');
    setRightFollicles('');
    setNotes('');
    setShowAdd(false);
  };

  const maxFollicleSize = Math.max(
    ...stimDays.flatMap((d) => [...d.follicleCounts.left, ...d.follicleCounts.right]),
    1,
  );

  return (
    <div className="rounded-3xl border border-warm-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
            <Activity size={18} className="text-purple-500" />
          </div>
          <h3 className="text-base font-semibold text-warm-800">Monitoring Log</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-2xl bg-warm-800 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
        >
          <Plus size={14} />
          Log Visit
        </button>
      </div>

      {showAdd && (
        <div className="mt-4 rounded-2xl border border-warm-100 bg-warm-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-warm-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Estradiol (pg/mL)</label>
              <input
                type="number"
                value={estradiol}
                onChange={(e) => setEstradiol(e.target.value)}
                placeholder="e.g. 486"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Lining (mm)</label>
              <input
                type="number"
                step="0.1"
                value={lining}
                onChange={(e) => setLining(e.target.value)}
                placeholder="e.g. 8.5"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Left follicles (mm, comma-sep)</label>
              <input
                type="text"
                value={leftFollicles}
                onChange={(e) => setLeftFollicles(e.target.value)}
                placeholder="e.g. 12, 14, 10, 16"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Right follicles (mm, comma-sep)</label>
              <input
                type="text"
                value={rightFollicles}
                onChange={(e) => setRightFollicles(e.target.value)}
                placeholder="e.g. 11, 15, 13"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-2xl px-4 py-2 text-xs font-medium text-warm-400 transition-colors hover:text-warm-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="rounded-2xl bg-warm-800 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
            >
              Save Visit
            </button>
          </div>
        </div>
      )}

      {stimDays.length > 0 && (
        <div className="mt-5 space-y-4">
          {stimDays.map((day) => (
            <div key={day.id} className="rounded-2xl border border-warm-100 bg-warm-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-600">
                    {day.dayNumber}
                  </span>
                  <span className="text-sm font-medium text-warm-800">
                    {format(new Date(day.date), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-warm-400">
                  {day.estradiol != null && (
                    <span>E2: <b className="text-warm-700">{day.estradiol}</b> pg/mL</span>
                  )}
                  {day.liningThickness != null && (
                    <span>Lining: <b className="text-warm-700">{day.liningThickness}</b> mm</span>
                  )}
                </div>
              </div>

              {(day.follicleCounts.left.length > 0 || day.follicleCounts.right.length > 0) && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {['left', 'right'].map((side) => {
                    const follicles = side === 'left' ? day.follicleCounts.left : day.follicleCounts.right;
                    return (
                      <div key={side}>
                        <p className="mb-1.5 text-xs font-medium capitalize text-warm-500">{side} ovary ({follicles.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {follicles
                            .sort((a, b) => b - a)
                            .map((size, i) => {
                              const pct = (size / maxFollicleSize) * 100;
                              const bg =
                                size >= 18
                                  ? 'bg-green-400 text-white'
                                  : size >= 14
                                    ? 'bg-purple-300 text-white'
                                    : 'bg-warm-200 text-warm-600';
                              return (
                                <span
                                  key={i}
                                  className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${bg}`}
                                  style={{ minWidth: `${Math.max(pct * 0.4, 28)}px` }}
                                >
                                  {size}
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {day.notes && (
                <p className="mt-2 text-xs italic text-warm-400">{day.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {stimDays.length === 0 && (
        <p className="mt-4 py-6 text-center text-sm text-warm-400">
          No monitoring visits logged yet.
        </p>
      )}
    </div>
  );
}

// ─── Egg Retrieval Funnel ───────────────────────────────────────────

function RetrievalFunnel({ outcome }: { outcome: EggRetrievalOutcome | null }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    eggsRetrieved: '',
    mature: '',
    fertilized: '',
    blastocysts: '',
    pgtNormal: '',
    pgtAbnormal: '',
    pgtNoResult: '',
  });
  const [localOutcome, setLocalOutcome] = useState<EggRetrievalOutcome | null>(outcome);

  const handleSave = () => {
    const o: EggRetrievalOutcome = {
      id: generateId(),
      ivfCycleId: 'cycle-1',
      date: today,
      eggsRetrieved: Number(form.eggsRetrieved) || 0,
      mature: Number(form.mature) || 0,
      fertilized: Number(form.fertilized) || 0,
      blastocysts: Number(form.blastocysts) || 0,
      pgtNormal: Number(form.pgtNormal) || 0,
      pgtAbnormal: Number(form.pgtAbnormal) || 0,
      pgtNoResult: Number(form.pgtNoResult) || 0,
    };
    setLocalOutcome(o);
    setShowForm(false);
  };

  const data = localOutcome;

  const steps = data
    ? [
        { label: 'Eggs Retrieved', value: data.eggsRetrieved, color: 'from-fuchsia-400 to-fuchsia-500' },
        { label: 'Mature (MII)', value: data.mature, color: 'from-purple-400 to-purple-500' },
        { label: 'Fertilized', value: data.fertilized, color: 'from-violet-400 to-violet-500' },
        { label: 'Blastocysts', value: data.blastocysts, color: 'from-indigo-400 to-indigo-500' },
        { label: 'PGT Normal', value: data.pgtNormal, color: 'from-green-400 to-green-500' },
      ]
    : [];

  return (
    <div className="rounded-3xl border border-warm-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50">
            <Egg size={18} className="text-rose-500" />
          </div>
          <h3 className="text-base font-semibold text-warm-800">Egg Retrieval Funnel</h3>
        </div>
        {!data && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-2xl bg-warm-800 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
          >
            <Plus size={14} />
            Log Results
          </button>
        )}
      </div>

      {showForm && !data && (
        <div className="mt-4 rounded-2xl border border-warm-100 bg-warm-50 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Eggs Retrieved', key: 'eggsRetrieved' as const },
              { label: 'Mature (MII)', key: 'mature' as const },
              { label: 'Fertilized', key: 'fertilized' as const },
              { label: 'Blastocysts', key: 'blastocysts' as const },
              { label: 'PGT Normal', key: 'pgtNormal' as const },
              { label: 'PGT Abnormal', key: 'pgtAbnormal' as const },
              { label: 'PGT No Result', key: 'pgtNoResult' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-warm-400">{label}</label>
                <input
                  type="number"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-2xl px-4 py-2 text-xs font-medium text-warm-400 transition-colors hover:text-warm-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-2xl bg-warm-800 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {data && steps.length > 0 && (
        <div className="mt-5 space-y-2">
          {steps.map((step, i) => {
            const maxVal = steps[0].value || 1;
            const widthPct = Math.max((step.value / maxVal) * 100, 8);
            const attrition =
              i > 0 && steps[i - 1].value > 0
                ? Math.round(((steps[i - 1].value - step.value) / steps[i - 1].value) * 100)
                : null;
            return (
              <div key={step.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-warm-600">{step.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-warm-800">{step.value}</span>
                    {attrition !== null && attrition > 0 && (
                      <span className="text-[10px] text-warm-400">
                        (-{attrition}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-xl bg-warm-50">
                  <div
                    className={`flex h-full items-center justify-end rounded-xl bg-gradient-to-r ${step.color} px-3 transition-all duration-700`}
                    style={{ width: `${widthPct}%` }}
                  >
                    {step.value > 0 && (
                      <span className="text-[11px] font-bold text-white">{step.value}</span>
                    )}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowRight size={12} className="rotate-90 text-warm-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!data && !showForm && (
        <p className="mt-4 py-6 text-center text-sm text-warm-400">
          No retrieval results logged yet.
        </p>
      )}
    </div>
  );
}

// ─── Beta hCG Tracker ───────────────────────────────────────────────

function BetaTracker({
  betas,
  onAddBeta,
}: {
  betas: BetaHCG[];
  onAddBeta: (beta: Omit<BetaHCG, 'id' | 'ivfCycleId'>) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate] = useState(today);
  const [value, setValue] = useState('');
  const [dpt, setDpt] = useState('');

  const handleAdd = () => {
    if (!value || !dpt) return;
    onAddBeta({ date, value: Number(value), dpt: Number(dpt) });
    setValue('');
    setDpt('');
    setShowAdd(false);
  };

  const sortedBetas = [...betas].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const chartData = sortedBetas.map((b) => ({
    name: `${b.dpt}dp`,
    value: b.value,
    date: format(new Date(b.date), 'MMM d'),
  }));

  return (
    <div className="rounded-3xl border border-warm-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
            <Heart size={18} className="text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-warm-800">Beta hCG Tracker</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-2xl bg-warm-800 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
        >
          <Plus size={14} />
          Log Beta
        </button>
      </div>

      {showAdd && (
        <div className="mt-4 rounded-2xl border border-warm-100 bg-warm-50 p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-warm-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Value (mIU/mL)</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. 120"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Days Post Transfer</label>
              <input
                type="number"
                value={dpt}
                onChange={(e) => setDpt(e.target.value)}
                placeholder="e.g. 10"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-2xl px-4 py-2 text-xs font-medium text-warm-400 transition-colors hover:text-warm-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="rounded-2xl bg-warm-800 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {sortedBetas.length > 0 && (
        <>
          <div className="mt-4 space-y-2">
            {sortedBetas.map((beta, i) => {
              const doubling =
                i > 0
                  ? calculateDoublingTime(
                      sortedBetas[i - 1].value,
                      sortedBetas[i - 1].date,
                      beta.value,
                      beta.date,
                    )
                  : null;

              const doublingOk = doubling !== null && doubling > 0 && doubling <= 72;

              return (
                <div
                  key={beta.id}
                  className="flex items-center justify-between rounded-2xl border border-warm-100 bg-warm-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                      <TrendingUp size={14} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-warm-800">
                        {beta.value.toLocaleString()} mIU/mL
                      </p>
                      <p className="text-xs text-warm-400">
                        {format(new Date(beta.date), 'MMM d, yyyy')} · {beta.dpt} DPT
                      </p>
                    </div>
                  </div>
                  {doubling !== null && doubling > 0 && (
                    <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium ${
                      doublingOk
                        ? 'bg-green-100 text-green-700'
                        : 'bg-honey-100 text-honey-700'
                    }`}>
                      <Clock size={12} />
                      {doubling}h doubling
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {chartData.length >= 2 && (
            <div className="mt-5 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#a0a0a0' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#a0a0a0' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid #f2f2f2',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${val.toLocaleString()} mIU/mL`, 'Beta hCG']}
                    labelFormatter={(label: any) => `Day: ${label}`}
                  />
                  <ReferenceLine
                    y={5}
                    stroke="#e0e0e0"
                    strokeDasharray="4 4"
                    label={{ value: 'Positive threshold', position: 'right', fontSize: 10, fill: '#a0a0a0' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#c026d3"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#c026d3', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {sortedBetas.length === 0 && !showAdd && (
        <p className="mt-4 py-6 text-center text-sm text-warm-400">
          No beta values logged yet.
        </p>
      )}
    </div>
  );
}

// ─── Embryo Grading Table ───────────────────────────────────────────

function EmbryoTable({
  embryos,
  onAddEmbryo,
}: {
  embryos: EmbryoGrade[];
  onAddEmbryo: (e: Omit<EmbryoGrade, 'id' | 'ivfCycleId'>) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    embryoNumber: '',
    day: '5' as '3' | '5' | '6',
    grade: '',
    pgtResult: 'no-result' as PGTResult,
    frozen: false,
    transferred: false,
    notes: '',
  });

  const handleAdd = () => {
    if (!form.grade || !form.embryoNumber) return;
    onAddEmbryo({
      embryoNumber: Number(form.embryoNumber),
      day: Number(form.day) as 3 | 5 | 6,
      grade: form.grade,
      pgtResult: form.pgtResult,
      frozen: form.frozen,
      transferred: form.transferred,
      notes: form.notes || undefined,
    });
    setForm({ embryoNumber: '', day: '5', grade: '', pgtResult: 'no-result', frozen: false, transferred: false, notes: '' });
    setShowAdd(false);
  };

  const pgtColors: Record<PGTResult, string> = {
    normal: 'bg-green-100 text-green-700',
    abnormal: 'bg-red-100 text-red-600',
    mosaic: 'bg-honey-100 text-honey-700',
    'no-result': 'bg-warm-100 text-warm-500',
  };

  const pgtLabels: Record<PGTResult, string> = {
    normal: 'Normal',
    abnormal: 'Abnormal',
    mosaic: 'Mosaic',
    'no-result': 'Pending',
  };

  return (
    <div className="rounded-3xl border border-warm-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
            <Table2 size={18} className="text-indigo-500" />
          </div>
          <h3 className="text-base font-semibold text-warm-800">Embryo Grading</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-2xl bg-warm-800 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
        >
          <Plus size={14} />
          Add Embryo
        </button>
      </div>

      {showAdd && (
        <div className="mt-4 rounded-2xl border border-warm-100 bg-warm-50 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-warm-400">Embryo #</label>
              <input
                type="number"
                value={form.embryoNumber}
                onChange={(e) => setForm({ ...form, embryoNumber: e.target.value })}
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Day</label>
              <div className="relative">
                <select
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value as '3' | '5' | '6' })}
                  className="w-full appearance-none rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
                >
                  <option value="3">Day 3</option>
                  <option value="5">Day 5</option>
                  <option value="6">Day 6</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-warm-400" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Grade</label>
              <input
                type="text"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="e.g. 4AA"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">PGT Result</label>
              <div className="relative">
                <select
                  value={form.pgtResult}
                  onChange={(e) => setForm({ ...form, pgtResult: e.target.value as PGTResult })}
                  className="w-full appearance-none rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
                >
                  <option value="no-result">Pending</option>
                  <option value="normal">Normal (Euploid)</option>
                  <option value="abnormal">Abnormal (Aneuploid)</option>
                  <option value="mosaic">Mosaic</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-warm-400" />
              </div>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-warm-600">
                <input
                  type="checkbox"
                  checked={form.frozen}
                  onChange={(e) => setForm({ ...form, frozen: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                Frozen
              </label>
              <label className="flex items-center gap-2 text-sm text-warm-600">
                <input
                  type="checkbox"
                  checked={form.transferred}
                  onChange={(e) => setForm({ ...form, transferred: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                Transferred
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs text-warm-400">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional"
                className="w-full rounded-2xl border border-warm-200 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-2xl px-4 py-2 text-xs font-medium text-warm-400 transition-colors hover:text-warm-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="rounded-2xl bg-warm-800 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-warm-900"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {embryos.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-warm-100">
                <th className="pb-2 pr-4 text-xs font-medium text-warm-400">#</th>
                <th className="pb-2 pr-4 text-xs font-medium text-warm-400">Day</th>
                <th className="pb-2 pr-4 text-xs font-medium text-warm-400">Grade</th>
                <th className="pb-2 pr-4 text-xs font-medium text-warm-400">PGT</th>
                <th className="pb-2 text-xs font-medium text-warm-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {embryos
                .sort((a, b) => a.embryoNumber - b.embryoNumber)
                .map((e) => (
                  <tr key={e.id} className="group">
                    <td className="py-3 pr-4 font-semibold text-warm-700">{e.embryoNumber}</td>
                    <td className="py-3 pr-4 text-warm-600">Day {e.day}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-600">
                        {e.grade}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${pgtColors[e.pgtResult]}`}>
                        {pgtLabels[e.pgtResult]}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        {e.frozen && (
                          <span className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                            <Snowflake size={11} />
                            Frozen
                          </span>
                        )}
                        {e.transferred && (
                          <span className="flex items-center gap-1 rounded-lg bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-600">
                            <ArrowRight size={11} />
                            Transferred
                          </span>
                        )}
                        {!e.frozen && !e.transferred && (
                          <span className="text-xs text-warm-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 py-6 text-center text-sm text-warm-400">
          No embryos logged yet.
        </p>
      )}
    </div>
  );
}

// ─── Cycle Setup Modal ──────────────────────────────────────────────

function CycleSetup({ onStart }: { onStart: (cycle: IVFCycle) => void }) {
  const [protocol, setProtocol] = useState<IVFProtocol>('antagonist');
  const [startDate, setStartDate] = useState(today);

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-400 to-purple-500 shadow-lg shadow-fuchsia-200/50">
        <Syringe size={32} className="text-white" />
      </div>
      <h2 className="mt-6 text-xl font-bold text-warm-800">Start Your IVF Cycle</h2>
      <p className="mt-2 max-w-sm text-center text-sm text-warm-400">
        Track medications, monitoring, retrieval outcomes, embryo grading, and betas — all in one place.
      </p>

      <div className="mt-8 w-full max-w-sm space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-warm-500">Protocol</label>
          <div className="relative">
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as IVFProtocol)}
              className="w-full appearance-none rounded-2xl border border-warm-200 bg-white px-4 py-3 text-sm text-warm-800 focus:outline-none"
            >
              {Object.entries(IVF_PROTOCOL_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-warm-400" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-warm-500">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-2xl border border-warm-200 bg-white px-4 py-3 text-sm text-warm-800 focus:outline-none"
          />
        </div>
        <button
          onClick={() =>
            onStart({
              id: generateId(),
              startDate,
              protocol,
              status: 'stimming',
            })
          }
          className="w-full rounded-2xl bg-warm-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-warm-900"
        >
          Begin Cycle
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function IVFModule() {
  const [cycle, setCycle] = useState<IVFCycle | null>(null);
  const [medications, setMedications] = useState<StimMedication[]>([]);
  const [checkedMeds, setCheckedMeds] = useState<Set<string>>(new Set());
  const [stimDays, setStimDays] = useState<StimDay[]>([]);
  const [retrievalOutcome] = useState<EggRetrievalOutcome | null>(null);
  const [betas, setBetas] = useState<BetaHCG[]>([]);
  const [embryos, setEmbryos] = useState<EmbryoGrade[]>([]);

  if (!cycle) {
    return <CycleSetup onStart={setCycle} />;
  }

  const handleUpdateStatus = (status: IVFCycleStatus) => {
    setCycle({ ...cycle, status });
  };

  const handleAddMed = (med: StimMedication) => {
    setMedications([...medications, med]);
  };

  const handleRemoveMed = (idx: number) => {
    setMedications(medications.filter((_, i) => i !== idx));
  };

  const handleToggleMed = (key: string) => {
    const next = new Set(checkedMeds);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCheckedMeds(next);
  };

  const handleAddStimDay = (day: Omit<StimDay, 'id' | 'ivfCycleId'>) => {
    setStimDays([
      ...stimDays,
      { ...day, id: generateId(), ivfCycleId: cycle.id },
    ]);
  };

  const handleAddBeta = (beta: Omit<BetaHCG, 'id' | 'ivfCycleId'>) => {
    setBetas([...betas, { ...beta, id: generateId(), ivfCycleId: cycle.id }]);
  };

  const handleAddEmbryo = (embryo: Omit<EmbryoGrade, 'id' | 'ivfCycleId'>) => {
    setEmbryos([
      ...embryos,
      { ...embryo, id: generateId(), ivfCycleId: cycle.id },
    ]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-warm-800">IVF Cycle Management</h1>
        <p className="mt-1 text-sm text-warm-400">
          Track every step of your journey — medications, monitoring, retrieval, and beyond.
        </p>
      </div>

      <CycleOverviewCard
        cycle={cycle}
        stimDays={stimDays}
        onUpdateStatus={handleUpdateStatus}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <MedicationSchedule
          medications={medications}
          checkedMeds={checkedMeds}
          onToggleMed={handleToggleMed}
          onAddMed={handleAddMed}
          onRemoveMed={handleRemoveMed}
        />
        <MonitoringLog stimDays={stimDays} onAddStimDay={handleAddStimDay} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RetrievalFunnel outcome={retrievalOutcome} />
        <BetaTracker betas={betas} onAddBeta={handleAddBeta} />
      </div>

      <EmbryoTable embryos={embryos} onAddEmbryo={handleAddEmbryo} />
    </div>
  );
}
