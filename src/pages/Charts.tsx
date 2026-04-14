import { useState } from 'react';
import { useCycles, useCycleReadings } from '../lib/hooks';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import type { DailyReading } from '../lib/types';

const CYCLE_COLORS = ['#0d9488', '#8b5cf6', '#d97706', '#e11d48', '#0ea5e9', '#6366f1'];

type ChartMetric = 'bbt' | 'lh' | 'e3g' | 'pdg' | 'keggImpedance';

const metricLabels: Record<ChartMetric, string> = {
  bbt: 'BBT (°F)',
  lh: 'LH (mIU/mL)',
  e3g: 'E3G (pg/mL)',
  pdg: 'PdG (µg/mL)',
  keggImpedance: 'Kegg Impedance',
};

export default function Charts() {
  const cycles = useCycles();
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>('bbt');
  const [selectedCycleIds, setSelectedCycleIds] = useState<number[]>(() =>
    cycles.slice(0, 3).map(c => c.id!).filter(Boolean)
  );

  function toggleCycle(id: number) {
    setSelectedCycleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold text-warm-800">Cycle Comparison</h1>
        <p className="text-sm text-warm-400 mt-0.5">Overlay cycles to see your patterns</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(Object.entries(metricLabels) as [ChartMetric, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedMetric(key)}
            className={`px-4 py-2 rounded-2xl text-xs font-medium border transition-all duration-200 ${
              selectedMetric === key
                ? 'bg-warm-50 border-warm-200 text-warm-800'
                : 'border-warm-200 text-warm-400 hover:bg-warm-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {cycles.map((cycle, i) => (
          <button
            key={cycle.id}
            onClick={() => toggleCycle(cycle.id!)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium border transition-all duration-200 ${
              selectedCycleIds.includes(cycle.id!)
                ? 'bg-white border-warm-200 shadow-sm shadow-warm-100'
                : 'border-warm-100 text-warm-300 hover:bg-warm-50'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: CYCLE_COLORS[i % CYCLE_COLORS.length] }}
            />
            {format(new Date(cycle.startDate + 'T00:00:00'), 'MMM d')}
            {cycle.outcome === 'ongoing' && ' (current)'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-warm-100 p-7 shadow-sm shadow-warm-100/50">
        <h2 className="text-base font-semibold text-warm-700 mb-5">
          {metricLabels[selectedMetric]} — Overlay
        </h2>
        <OverlayChart
          cycleIds={selectedCycleIds}
          metric={selectedMetric}
          cycles={cycles}
        />
      </div>
    </div>
  );
}

function OverlayChart({ cycleIds, metric, cycles }: {
  cycleIds: number[];
  metric: ChartMetric;
  cycles: ReturnType<typeof useCycles>;
}) {
  const readings0 = useCycleReadings(cycleIds[0]);
  const readings1 = useCycleReadings(cycleIds[1]);
  const readings2 = useCycleReadings(cycleIds[2]);

  const allReadings: [number, DailyReading[]][] = [
    [cycleIds[0], readings0],
    [cycleIds[1], readings1],
    [cycleIds[2], readings2],
  ].filter(([id]) => id != null) as [number, DailyReading[]][];

  const maxDays = Math.max(1, ...allReadings.map(([, r]) => r.length > 0 ? Math.max(...r.map(x => x.cycleDay)) : 0));
  const cycleDays = Array.from({ length: maxDays }, (_, i) => i + 1);

  const chartData = cycleDays.map(cd => {
    const point: Record<string, number | undefined> = { cycleDay: cd };
    allReadings.forEach(([cycleId, readings]) => {
      const r = readings.find(x => x.cycleDay === cd);
      if (r) {
        point[`cycle_${cycleId}`] = r[metric] as number | undefined;
      }
    });
    return point;
  });

  if (allReadings.every(([, r]) => r.length === 0)) {
    return (
      <div className="flex items-center justify-center h-56 text-warm-300 text-sm">
        Select cycles with data to see the overlay.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#ede9e7" />
        <XAxis
          dataKey="cycleDay"
          tick={{ fontSize: 10, fill: '#a69e9b' }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Cycle Day', position: 'insideBottom', offset: -5, style: { fontSize: 10, fill: '#a69e9b' } }}
        />
        <YAxis tick={{ fontSize: 10, fill: '#a69e9b' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'white', border: '1px solid #ede9e7', borderRadius: '16px', fontSize: '11px', boxShadow: '0 8px 24px rgba(44,38,36,0.06)' }}
        />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#8a7f7b' }} iconType="circle" iconSize={8} />

        {allReadings.map(([cycleId], i) => {
          const cycle = cycles.find(c => c.id === cycleId);
          const label = cycle ? format(new Date(cycle.startDate + 'T00:00:00'), 'MMM d') : `Cycle ${cycleId}`;
          return (
            <Line
              key={cycleId}
              type="natural"
              dataKey={`cycle_${cycleId}`}
              stroke={CYCLE_COLORS[i % CYCLE_COLORS.length]}
              strokeWidth={2.5}
              dot={{ r: 2.5, stroke: 'white', strokeWidth: 2 }}
              connectNulls
              name={label}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
