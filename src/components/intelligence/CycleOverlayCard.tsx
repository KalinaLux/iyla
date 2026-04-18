import { useMemo, useState } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
import type { Cycle, DailyReading } from '../../lib/types';
import CycleOverlayChart, { type OverlayMetric } from './CycleOverlayChart';

interface Props {
  cycles: Cycle[];
  readings: DailyReading[];
}

type CycleLimit = 3 | 6 | 'all';

const METRIC_OPTIONS: Array<{ value: OverlayMetric; label: string }> = [
  { value: 'bbt', label: 'BBT' },
  { value: 'lh', label: 'LH' },
  { value: 'e3g', label: 'E3G' },
  { value: 'pdg', label: 'PdG' },
  { value: 'keggImpedance', label: 'Kegg' },
];

const LIMIT_OPTIONS: Array<{ value: CycleLimit; label: string }> = [
  { value: 3, label: 'Last 3' },
  { value: 6, label: 'Last 6' },
  { value: 'all', label: 'All' },
];

export default function CycleOverlayCard({ cycles, readings }: Props) {
  const [metric, setMetric] = useState<OverlayMetric>('bbt');
  const [cycleLimit, setCycleLimit] = useState<CycleLimit>(3);

  const cyclesWithReadings = useMemo(() => {
    const sorted = [...cycles].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );
    const limited = cycleLimit === 'all' ? sorted : sorted.slice(0, cycleLimit);
    return limited
      .filter((c) => c.id != null)
      .map((c) => ({
        cycle: c,
        readings: readings
          .filter((r) => r.cycleId === c.id)
          .sort((a, b) => a.cycleDay - b.cycleDay),
      }));
  }, [cycles, readings, cycleLimit]);

  return (
    <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LineChartIcon size={16} className="text-warm-500" strokeWidth={1.75} />
            <h3 className="text-base font-semibold text-warm-700">Your cycles, side-by-side</h3>
          </div>
          <p className="text-xs text-warm-400 mt-1">See how this cycle compares to your history.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {METRIC_OPTIONS.map((opt) => {
            const active = metric === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMetric(opt.value)}
                className={
                  'text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-[0.97] ' +
                  (active
                    ? 'bg-warm-800 border-warm-800 text-white shadow-sm'
                    : 'bg-white border-warm-200 text-warm-600 hover:border-warm-300')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {LIMIT_OPTIONS.map((opt) => {
            const active = cycleLimit === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setCycleLimit(opt.value)}
                className={
                  'text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-[0.97] ' +
                  (active
                    ? 'bg-warm-100 border-warm-200 text-warm-800'
                    : 'bg-white border-warm-100 text-warm-500 hover:border-warm-200')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <CycleOverlayChart cyclesWithReadings={cyclesWithReadings} metric={metric} height={280} />
    </div>
  );
}
