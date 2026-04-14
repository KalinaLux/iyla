import { useState } from 'react';
import { CalendarDays, ChevronRight, Plus, Circle, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useCycles, useCycleReadings } from '../lib/hooks';
import { db } from '../lib/db';
import Modal from '../components/Modal';
import CycleChart from '../components/CycleChart';
import { format, differenceInDays } from 'date-fns';
import type { Cycle, CycleOutcome } from '../lib/types';

const outcomeConfig: Record<CycleOutcome, { label: string; icon: React.ReactNode; color: string }> = {
  ongoing: { label: 'Ongoing', icon: <Circle size={14} strokeWidth={1.5} />, color: 'text-warm-600' },
  negative: { label: 'Not Pregnant', icon: <XCircle size={14} strokeWidth={1.5} />, color: 'text-warm-400' },
  positive: { label: 'Positive', icon: <CheckCircle size={14} strokeWidth={1.5} />, color: 'text-green-500' },
  chemical: { label: 'Chemical Pregnancy', icon: <AlertTriangle size={14} strokeWidth={1.5} />, color: 'text-honey-600' },
  miscarriage: { label: 'Loss', icon: <AlertTriangle size={14} strokeWidth={1.5} />, color: 'text-rose-500' },
};

export default function CycleHistory() {
  const cycles = useCycles();
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [newStartDate, setNewStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  async function handleStartNewCycle() {
    const ongoing = cycles.find(c => c.outcome === 'ongoing');
    if (ongoing?.id) {
      await db.cycles.update(ongoing.id, {
        endDate: newStartDate,
        outcome: 'negative',
      });
    }
    await db.cycles.add({ startDate: newStartDate, outcome: 'ongoing' });
    setShowNewCycle(false);
  }

  async function updateOutcome(cycleId: number, outcome: CycleOutcome) {
    await db.cycles.update(cycleId, { outcome });
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800">Cycle History</h1>
          <p className="text-sm text-warm-400 mt-0.5">
            {cycles.length} cycle{cycles.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <button
          onClick={() => setShowNewCycle(true)}
          className="flex items-center gap-2 bg-warm-800 text-white px-5 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all shadow-sm"
        >
          <Plus size={16} />
          New Cycle
        </button>
      </div>

      {cycles.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm-100 p-14 text-center shadow-sm shadow-warm-100/50">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5">
            <CalendarDays size={28} className="text-rose-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-warm-600 mb-2">No cycles yet</h3>
          <p className="text-sm text-warm-400">Start tracking from the dashboard to see your history.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map(cycle => (
            <CycleCard
              key={cycle.id}
              cycle={cycle}
              isSelected={selectedCycleId === cycle.id}
              onSelect={() => setSelectedCycleId(selectedCycleId === cycle.id ? null : cycle.id!)}
              onUpdateOutcome={(outcome) => updateOutcome(cycle.id!, outcome)}
            />
          ))}
        </div>
      )}

      <Modal open={showNewCycle} onClose={() => setShowNewCycle(false)} title="Start New Cycle">
        <div className="space-y-5">
          <p className="text-sm text-warm-400 leading-relaxed">
            Starting a new cycle will close your current one. Enter the first day of your new period.
          </p>
          <div>
            <label className="block text-sm font-medium text-warm-600 mb-1.5">First Day of Period</label>
            <input
              type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
              className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent bg-warm-50/30"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowNewCycle(false)} className="px-5 py-2.5 text-sm text-warm-400 rounded-2xl">Cancel</button>
            <button
              onClick={handleStartNewCycle}
              className="px-7 py-2.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-900 shadow-sm"
            >
              Start Cycle
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CycleCard({ cycle, isSelected, onSelect, onUpdateOutcome }: {
  cycle: Cycle;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateOutcome: (outcome: CycleOutcome) => void;
}) {
  const readings = useCycleReadings(isSelected ? cycle.id : undefined);
  const startDate = new Date(cycle.startDate + 'T00:00:00');
  const endDate = cycle.endDate ? new Date(cycle.endDate + 'T00:00:00') : new Date();
  const length = differenceInDays(endDate, startDate) + 1;
  const config = outcomeConfig[cycle.outcome];

  return (
    <div className="bg-white rounded-3xl border border-warm-100 overflow-hidden shadow-sm shadow-warm-100/50">
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-warm-50/50 transition-all"
      >
        <div className="bg-gradient-to-br from-warm-50 to-warm-100 rounded-2xl p-3">
          <CalendarDays size={20} className="text-warm-500" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-warm-700">
            {format(startDate, 'MMM d, yyyy')}
            {cycle.endDate && ` — ${format(new Date(cycle.endDate + 'T00:00:00'), 'MMM d, yyyy')}`}
          </span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-warm-400">{length} days</span>
            <span className={`flex items-center gap-1 text-xs font-medium ${config.color}`}>
              {config.icon} {config.label}
            </span>
            {cycle.ovulationDay && (
              <span className="text-xs text-warm-300">Ovulation: CD{cycle.ovulationDay}</span>
            )}
          </div>
        </div>
        <ChevronRight
          size={16}
          className={`text-warm-300 transition-transform duration-200 ${isSelected ? 'rotate-90' : ''}`}
          strokeWidth={1.5}
        />
      </button>

      {isSelected && (
        <div className="px-6 pb-6 border-t border-warm-100 pt-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-2.5">Cycle Outcome</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(outcomeConfig) as CycleOutcome[]).map(o => {
                const c = outcomeConfig[o];
                return (
                  <button
                    key={o}
                    onClick={() => onUpdateOutcome(o)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-medium border transition-all duration-200 ${
                      cycle.outcome === o
                        ? 'bg-warm-50 border-warm-200 text-warm-800'
                        : 'border-warm-100 text-warm-400 hover:bg-warm-50'
                    }`}
                  >
                    {c.icon} {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <CycleChart readings={readings} cycleDay={length} />
        </div>
      )}
    </div>
  );
}
