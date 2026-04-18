import { Target, Calendar, Activity } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import type { CyclePredictions } from '../../lib/intelligence';

interface Props {
  predictions: CyclePredictions;
  today: string;
}

function formatDate(iso: string | null | undefined, today: string): { label: string; relative: string } {
  if (!iso) return { label: '—', relative: '' };
  const d = parseISO(iso);
  const diff = differenceInCalendarDays(d, parseISO(today));
  const label = format(d, 'EEE MMM d');
  let relative = '';
  if (diff === 0) relative = 'today';
  else if (diff === 1) relative = 'tomorrow';
  else if (diff === -1) relative = 'yesterday';
  else if (diff > 0) relative = `in ${diff} days`;
  else relative = `${Math.abs(diff)} days ago`;
  return { label, relative };
}

export default function PredictionsCard({ predictions: p, today }: Props) {
  if (p.predictionBasis === 'insufficient_data') {
    return (
      <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Target size={16} className="text-warm-500" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-warm-700">Predictions</h3>
        </div>
        <p className="text-sm text-warm-400 mt-2">Track a full cycle to unlock smart forecasting.</p>
      </div>
    );
  }

  const nextOv = formatDate(p.nextOvulation?.date, today);
  const nextPeriod = formatDate(p.nextPeriod?.date, today);
  const odds = p.conceptionOddsThisCycle;

  const basisLabel = {
    historical: 'Based on your cycle history',
    current_cycle_signals: 'Live — adjusted from today\'s signals',
    population_default: 'Population average (need more cycles)',
    insufficient_data: 'Not enough data yet',
  }[p.predictionBasis];

  return (
    <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-warm-500" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-warm-700">Predictions</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-warm-100 text-warm-500">
          {p.predictionBasis === 'current_cycle_signals' ? 'Live' : 'Forecast'}
        </span>
      </div>

      {/* Odds gauge */}
      {odds !== null && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-50 to-violet-50 border border-rose-100">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-600">Conception odds this cycle</span>
          </div>
          <div className="flex items-end gap-3 mt-1">
            <span className="text-4xl font-bold text-warm-800 tabular-nums">{odds}%</span>
            <span className="text-xs text-warm-500 pb-1.5">based on timing + signals</span>
          </div>
          <div className="mt-3 h-2 bg-white/60 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-400 to-violet-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(odds, 100)}%` }} />
          </div>
        </div>
      )}

      {/* Key dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-warm-50 rounded-2xl">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity size={12} className="text-teal-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-warm-500">Next ovulation</span>
          </div>
          <p className="text-sm font-semibold text-warm-800">{nextOv.label}</p>
          <p className="text-[11px] text-warm-400">{nextOv.relative}{p.nextOvulation && ` · ${p.nextOvulation.confidence}% conf`}</p>
        </div>
        <div className="p-4 bg-warm-50 rounded-2xl">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar size={12} className="text-rose-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-warm-500">Next period</span>
          </div>
          <p className="text-sm font-semibold text-warm-800">{nextPeriod.label}</p>
          <p className="text-[11px] text-warm-400">{nextPeriod.relative}{p.nextPeriod && ` · ${p.nextPeriod.confidence}% conf`}</p>
        </div>
      </div>

      {/* Best days */}
      {p.bestConceptionDays.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-warm-500 mb-2">Best conception days</p>
          <div className="space-y-2">
            {p.bestConceptionDays.slice(0, 5).map((d) => {
              const fmt = formatDate(d.date, today);
              return (
                <div key={d.date} className="flex items-center gap-3 p-2.5 rounded-xl bg-warm-50">
                  <div className="w-10 text-center">
                    <span className="text-[9px] text-warm-400 uppercase block">CD</span>
                    <span className="text-sm font-bold text-warm-700 tabular-nums">{d.cycleDay}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-warm-700">{fmt.label}</p>
                    <p className="text-[10px] text-warm-400 truncate">{d.reason}</p>
                  </div>
                  <div className="shrink-0 w-16">
                    <div className="h-1.5 bg-warm-200 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-400 rounded-full" style={{ width: `${d.relativeOdds}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-warm-400 italic text-center">{basisLabel}</p>
    </div>
  );
}
