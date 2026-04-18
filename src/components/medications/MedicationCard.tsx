import { format } from 'date-fns';
import { Check, Clock, Pencil, Trash2, Archive, RotateCcw } from 'lucide-react';
import type { Medication, MedicationLog } from '../../lib/medications-db';
import { FORMULATION_LABELS } from '../../lib/medications';

interface Props {
  medication: Medication;
  logsToday: MedicationLog[];
  onQuickLog: () => void;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}

export default function MedicationCard({
  medication,
  logsToday,
  onQuickLog,
  onEdit,
  onArchiveToggle,
  onDelete,
}: Props) {
  const takenCount = logsToday.filter((l) => l.taken).length;
  const hasLogToday = logsToday.length > 0;
  const latestLog = hasLogToday
    ? [...logsToday].sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))[0]
    : null;

  return (
    <div
      className={`bg-white rounded-3xl border shadow-sm p-5 transition-all ${
        medication.active ? 'border-warm-100' : 'border-warm-100 opacity-70'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white text-xs font-bold"
          style={{ backgroundColor: medication.color ?? '#9b8ec4' }}
        >
          {medication.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-warm-800">{medication.name}</p>
            {medication.genericName && (
              <span className="text-xs text-warm-400">({medication.genericName})</span>
            )}
            {medication.pregnancyCategory && medication.pregnancyCategory !== 'unknown' && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  medication.pregnancyCategory === 'X' || medication.pregnancyCategory === 'D'
                    ? 'bg-rose-50 text-rose-600'
                    : medication.pregnancyCategory === 'C'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                }`}
                title="FDA pregnancy category"
              >
                Cat. {medication.pregnancyCategory}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-warm-500">
            <span className="font-medium">{medication.dose}</span>
            <span className="text-warm-300">·</span>
            <span>{FORMULATION_LABELS[medication.formulation]}</span>
            <span className="text-warm-300">·</span>
            <span>{medication.frequency}</span>
          </div>

          <p className="text-xs text-warm-500 mt-1">
            <span className="font-medium text-warm-600">For:</span> {medication.reason}
          </p>

          {medication.prescribedBy && (
            <p className="text-[11px] text-warm-400 mt-0.5">
              Prescribed by {medication.prescribedBy}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-warm-400">
            <span>Since {format(new Date(medication.startDate + 'T00:00:00'), 'MMM d, yyyy')}</span>
            {medication.endDate && (
              <>
                <span className="text-warm-300">→</span>
                <span>{format(new Date(medication.endDate + 'T00:00:00'), 'MMM d, yyyy')}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-start gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-2 text-warm-400 hover:text-warm-700 hover:bg-warm-50 rounded-xl transition-all"
            title="Edit"
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={onArchiveToggle}
            className="p-2 text-warm-400 hover:text-warm-700 hover:bg-warm-50 rounded-xl transition-all"
            title={medication.active ? 'Archive' : 'Restore'}
          >
            {medication.active ? <Archive size={14} strokeWidth={1.5} /> : <RotateCcw size={14} strokeWidth={1.5} />}
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-warm-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
            title="Delete"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Today's state */}
      {medication.active && (
        <div className="mt-4 pt-4 border-t border-warm-100 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {hasLogToday ? (
              <div className="flex items-center gap-2 text-xs">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    takenCount > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-50 text-rose-500'
                  }`}
                >
                  {takenCount > 0 ? <Check size={12} strokeWidth={2.5} /> : '—'}
                </div>
                <span className="font-medium text-warm-700">
                  {takenCount} logged today
                </span>
                {latestLog?.time && (
                  <span className="text-warm-400 inline-flex items-center gap-1">
                    <Clock size={10} />
                    {latestLog.time}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-warm-400">Not logged today.</p>
            )}
          </div>
          <button
            onClick={onQuickLog}
            className="px-4 py-2 bg-warm-800 text-white text-xs font-semibold rounded-2xl hover:bg-warm-900 transition-all shrink-0"
          >
            Log dose
          </button>
        </div>
      )}
    </div>
  );
}
