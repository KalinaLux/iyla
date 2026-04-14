import { Check, Leaf, Trophy } from 'lucide-react';
import { db } from '../lib/db';
import type { Supplement, SupplementLog, SupplementTiming } from '../lib/types';

interface Props {
  supplements: Supplement[];
  logs: SupplementLog[];
  date: string;
}

const timingLabels: Record<SupplementTiming, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  bedtime: 'Bedtime',
  with_food: 'With Food',
  empty_stomach: 'Empty Stomach',
};

const timingOrder: SupplementTiming[] = ['morning', 'afternoon', 'evening', 'bedtime'];

export default function SupplementChecklist({ supplements, logs, date }: Props) {
  if (supplements.length === 0) {
    return (
      <div className="text-center py-6">
        <Leaf size={24} className="text-warm-200 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-warm-400">
          No supplements yet. Visit the Supplements page to set up your protocol.
        </p>
      </div>
    );
  }

  const grouped = timingOrder.map(timing => ({
    timing,
    label: timingLabels[timing],
    items: supplements.filter(s => s.timing.includes(timing)),
  })).filter(g => g.items.length > 0);

  function isLogged(supplementId: number, timing: SupplementTiming): boolean {
    return logs.some(l => l.supplementId === supplementId && l.timing === timing && l.taken);
  }

  async function toggleLog(supplementId: number, timing: SupplementTiming) {
    const existing = logs.find(l => l.supplementId === supplementId && l.timing === timing);
    if (existing) {
      await db.supplementLogs.update(existing.id!, { taken: !existing.taken });
    } else {
      await db.supplementLogs.add({ date, supplementId, timing, taken: true });
    }
  }

  const totalItems = supplements.reduce((acc, s) => acc + s.timing.length, 0);
  const completedItems = logs.filter(l => l.taken).length;
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const allDone = pct === 100;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-warm-400">
            {completedItems} of {totalItems} taken
          </span>
          <div className="flex items-center gap-1.5">
            {allDone && <Trophy size={12} className="text-amber-500" />}
            <span className={`text-xs font-bold ${allDone ? 'text-amber-500' : pct >= 50 ? 'text-emerald-500' : 'text-warm-400'}`}>
              {pct}%
            </span>
          </div>
        </div>
        <div className="h-3 bg-warm-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              allDone
                ? 'bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-300'
                : pct >= 50
                ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                : 'bg-gradient-to-r from-teal-400 to-teal-300'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {allDone && (
          <p className="text-xs text-amber-500 font-medium mt-1.5 text-center">
            All supplements taken today!
          </p>
        )}
      </div>

      {grouped.map(({ timing, label, items }) => (
        <div key={timing}>
          <h3 className="text-xs font-medium text-warm-400 uppercase tracking-widest mb-2.5">{label}</h3>
          <div className="space-y-1.5">
            {items.map(sup => {
              const done = isLogged(sup.id!, timing);
              return (
                <button
                  key={`${sup.id}-${timing}`}
                  onClick={() => toggleLog(sup.id!, timing)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 active:scale-[0.98] ${
                    done
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-warm-50/50 border border-warm-100 hover:bg-warm-50 hover:border-warm-200'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                    done ? 'bg-emerald-400 shadow-sm shadow-emerald-200' : 'border-2 border-warm-200'
                  }`}>
                    {done && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium transition-colors ${done ? 'text-emerald-600' : 'text-warm-600'}`}>
                      {sup.name}
                    </span>
                    <span className="text-xs text-warm-400 ml-2">{sup.dose}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
