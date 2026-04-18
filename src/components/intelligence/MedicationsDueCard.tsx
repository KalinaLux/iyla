import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Stethoscope, Check, ArrowRight } from 'lucide-react';
import { medicationsDb, type Medication } from '../../lib/medications-db';
import MedicationLogModal from '../medications/MedicationLogModal';

export default function MedicationsDueCard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [logOpen, setLogOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<Medication | undefined>();

  const active = useLiveQuery(
    () => medicationsDb.medications.filter((m) => m.active).toArray(),
    [],
  ) ?? [];
  const logsToday = useLiveQuery(
    () => medicationsDb.logs.where('date').equals(today).toArray(),
    [today],
  ) ?? [];

  if (active.length === 0) return null;

  const takenIds = new Set(logsToday.filter((l) => l.taken).map((l) => l.medicationId));
  const due = active.filter((m) => !takenIds.has(m.id!));

  if (due.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Check size={14} className="text-emerald-600" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-warm-700">All meds logged today</p>
            <p className="text-[11px] text-warm-400">Nice. That's consistency.</p>
          </div>
          <Link
            to="/medications"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-warm-500 hover:text-warm-700 transition-colors"
          >
            View
            <ArrowRight size={11} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    );
  }

  const preview = due.slice(0, 3);
  const extra = due.length - preview.length;

  function openLog(m: Medication) {
    setLogTarget(m);
    setLogOpen(true);
  }

  return (
    <>
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-lavender-50 flex items-center justify-center">
              <Stethoscope size={13} className="text-lavender-600" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold text-warm-700">Medications due</h3>
            <span className="text-[10px] font-medium text-warm-400">{due.length}</span>
          </div>
          <Link
            to="/medications"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-warm-500 hover:text-warm-700 transition-colors"
          >
            See all
            <ArrowRight size={11} strokeWidth={2.5} />
          </Link>
        </div>

        <div className="space-y-1.5">
          {preview.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 py-1.5">
              <div
                className="shrink-0 w-7 h-7 rounded-xl text-white text-[10px] font-bold flex items-center justify-center"
                style={{ backgroundColor: m.color ?? '#9b8ec4' }}
              >
                {m.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-800 truncate">{m.name}</p>
                <p className="text-[11px] text-warm-400 truncate">
                  {m.dose} · {m.frequency}
                </p>
              </div>
              <button
                onClick={() => openLog(m)}
                className="px-3 py-1.5 bg-warm-800 text-white text-[11px] font-semibold rounded-xl hover:bg-warm-900 transition-all shrink-0"
              >
                Log
              </button>
            </div>
          ))}
        </div>

        {extra > 0 && (
          <Link
            to="/medications"
            className="mt-2 block text-center text-[11px] font-medium text-lavender-600 hover:text-lavender-700 transition-colors"
          >
            See all {due.length} medications
          </Link>
        )}
      </div>

      <MedicationLogModal open={logOpen} onClose={() => setLogOpen(false)} medication={logTarget} />
    </>
  );
}
