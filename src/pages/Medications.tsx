import { useState, useMemo } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Stethoscope,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Pill,
} from 'lucide-react';
import { medicationsDb, type Medication, type MedicationLog } from '../lib/medications-db';
import MedicationCard from '../components/medications/MedicationCard';
import MedicationEditorModal from '../components/medications/MedicationEditorModal';
import MedicationLogModal from '../components/medications/MedicationLogModal';

export default function Medications() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const medications = useLiveQuery(
    () => medicationsDb.medications.orderBy('startDate').reverse().toArray(),
    [],
  ) ?? [];
  const logs = useLiveQuery(() => medicationsDb.logs.toArray(), []) ?? [];

  const active = medications.filter((m) => m.active);
  const archived = medications.filter((m) => !m.active);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | undefined>();
  const [logOpen, setLogOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<Medication | undefined>();
  const [showArchived, setShowArchived] = useState(false);

  const last7 = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) days.push(format(subDays(startOfDay(new Date()), i), 'yyyy-MM-dd'));
    return days;
  }, []);

  function logsForMedToday(id: number): MedicationLog[] {
    return logs.filter((l) => l.medicationId === id && l.date === today);
  }

  function logForMedOnDate(id: number, date: string): MedicationLog[] {
    return logs.filter((l) => l.medicationId === id && l.date === date);
  }

  function startEdit(m?: Medication) {
    setEditing(m);
    setEditorOpen(true);
  }

  function openLog(m: Medication) {
    setLogTarget(m);
    setLogOpen(true);
  }

  async function toggleArchive(m: Medication) {
    if (!m.id) return;
    await medicationsDb.medications.update(m.id, {
      active: !m.active,
      endDate: m.active ? (m.endDate ?? today) : undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  async function remove(m: Medication) {
    if (!m.id) return;
    if (!window.confirm(`Delete ${m.name}? All log history for this medication will also be removed.`)) return;
    await medicationsDb.logs.where('medicationId').equals(m.id).delete();
    await medicationsDb.medications.delete(m.id);
  }

  // Side-effect rollup by medication name
  const sideEffectsByMed = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const l of logs) {
      if (!l.sideEffectsNoted?.length) continue;
      const med = medications.find((m) => m.id === l.medicationId);
      if (!med) continue;
      if (!map.has(med.name)) map.set(med.name, new Map());
      const inner = map.get(med.name)!;
      for (const s of l.sideEffectsNoted) {
        inner.set(s, (inner.get(s) ?? 0) + 1);
      }
    }
    return map;
  }, [logs, medications]);

  return (
    <div className="space-y-7 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800">Medications</h1>
          <p className="text-sm text-warm-400 mt-0.5">
            Prescription meds, dosing, and adherence. Separate from your supplement stack.
          </p>
        </div>
        <button
          onClick={() => startEdit(undefined)}
          className="flex items-center gap-2 bg-warm-800 text-white px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add medication
        </button>
      </div>

      {/* Empty state */}
      {medications.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm-100 p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-warm-50 flex items-center justify-center mx-auto mb-4">
            <Stethoscope size={24} className="text-warm-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-warm-700 mb-1">No medications yet</h3>
          <p className="text-sm text-warm-400 max-w-sm mx-auto leading-relaxed">
            Track prescription medications like progesterone, letrozole, metformin, or thyroid meds.
            Adherence, side effects, and pregnancy category all in one place.
          </p>
          <button
            onClick={() => startEdit(undefined)}
            className="mt-5 px-5 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all"
          >
            Add your first medication
          </button>
        </div>
      ) : (
        <>
          {/* Active medications */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-warm-700 uppercase tracking-widest">
                Active · {active.length}
              </h2>
            </div>
            {active.length === 0 ? (
              <div className="bg-warm-50 rounded-2xl p-5 text-center text-sm text-warm-500">
                No active medications. Restore one from archived, or add a new one.
              </div>
            ) : (
              <div className="space-y-3">
                {active.map((m) => (
                  <MedicationCard
                    key={m.id}
                    medication={m}
                    logsToday={logsForMedToday(m.id!)}
                    onQuickLog={() => openLog(m)}
                    onEdit={() => startEdit(m)}
                    onArchiveToggle={() => toggleArchive(m)}
                    onDelete={() => remove(m)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 7-day adherence grid */}
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-warm-700 uppercase tracking-widest">
                Last 7 days
              </h2>
              <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 overflow-x-auto">
                <div className="min-w-full">
                  <div className="grid" style={{ gridTemplateColumns: '160px repeat(7, minmax(34px, 1fr))' }}>
                    <div />
                    {last7.map((d) => (
                      <div key={d} className="text-center text-[10px] font-semibold text-warm-400 pb-2">
                        {format(new Date(d + 'T00:00:00'), 'EEEEE')}
                        <div className="text-warm-300 font-normal mt-0.5">
                          {format(new Date(d + 'T00:00:00'), 'd')}
                        </div>
                      </div>
                    ))}
                    {active.map((m) => (
                      <RowAdherence
                        key={m.id}
                        medication={m}
                        days={last7}
                        logsFor={(d) => logForMedOnDate(m.id!, d)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Side effects */}
          {sideEffectsByMed.size > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-warm-700 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" strokeWidth={1.6} />
                Side effects
              </h2>
              <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 space-y-4">
                {Array.from(sideEffectsByMed.entries()).map(([medName, effects]) => (
                  <div key={medName}>
                    <p className="text-sm font-semibold text-warm-700 mb-2">{medName}</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(effects.entries())
                        .sort((a, b) => b[1] - a[1])
                        .map(([effect, count]) => (
                          <span
                            key={effect}
                            className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium"
                          >
                            {effect}
                            <span className="text-amber-500 ml-1.5">× {count}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Archived */}
          {archived.length > 0 && (
            <section className="space-y-3">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-warm-500 uppercase tracking-widest hover:text-warm-700 transition-colors"
              >
                {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Archived · {archived.length}
              </button>
              {showArchived && (
                <div className="space-y-3">
                  {archived.map((m) => (
                    <MedicationCard
                      key={m.id}
                      medication={m}
                      logsToday={[]}
                      onQuickLog={() => openLog(m)}
                      onEdit={() => startEdit(m)}
                      onArchiveToggle={() => toggleArchive(m)}
                      onDelete={() => remove(m)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Footer note */}
      <div className="flex items-start gap-3 px-4 py-3.5 bg-warm-50/70 border border-warm-100 rounded-2xl">
        <Pill size={14} className="text-warm-400 shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-xs text-warm-500 leading-relaxed">
          iyla stores this locally for your own tracking. Always follow your prescribing clinician's
          instructions, and do not change a medication based on what you see here.
        </p>
      </div>

      <MedicationEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        medication={editing}
      />
      <MedicationLogModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        medication={logTarget}
      />
    </div>
  );
}

interface RowAdherenceProps {
  medication: Medication;
  days: string[];
  logsFor: (date: string) => MedicationLog[];
}

function RowAdherence({ medication, days, logsFor }: RowAdherenceProps) {
  return (
    <>
      <div className="flex items-center gap-2 pr-3 py-1.5">
        <div
          className="w-6 h-6 rounded-lg shrink-0 text-white text-[10px] font-bold flex items-center justify-center"
          style={{ backgroundColor: medication.color ?? '#9b8ec4' }}
        >
          {medication.name.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-xs font-medium text-warm-700 truncate">{medication.name}</span>
      </div>
      {days.map((d) => {
        const ls = logsFor(d);
        const taken = ls.some((l) => l.taken);
        const missed = ls.length > 0 && !taken;
        return (
          <div key={d} className="py-1.5 flex items-center justify-center">
            <div
              className={`w-5 h-5 rounded-lg ${
                taken
                  ? 'bg-emerald-400'
                  : missed
                    ? 'bg-rose-300'
                    : 'bg-warm-100 border border-warm-150'
              }`}
              title={`${d}: ${taken ? 'taken' : missed ? 'missed' : 'no log'}`}
            />
          </div>
        );
      })}
    </>
  );
}
