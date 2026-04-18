import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import type { Cycle, DailyReading } from '../../lib/types';

export type OverlayMetric = 'bbt' | 'lh' | 'e3g' | 'pdg' | 'keggImpedance';

interface Props {
  cyclesWithReadings: Array<{
    cycle: Cycle;
    readings: DailyReading[];
  }>;
  metric: OverlayMetric;
  height?: number;
}

const PALETTE = ['#0d9488', '#9333ea', '#f59e0b', '#e11d48', '#059669', '#2563eb'];

const METRIC_LABELS: Record<OverlayMetric, string> = {
  bbt: 'Temperature (°F)',
  lh: 'LH (mIU/mL)',
  e3g: 'Estrogen (pg/mL)',
  pdg: 'PdG (µg/mL)',
  keggImpedance: 'Impedance',
};

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function isOngoing(cycle: Cycle): boolean {
  return cycle.outcome === 'ongoing' || !cycle.endDate;
}

export default function CycleOverlayChart({ cyclesWithReadings, metric, height = 260 }: Props) {
  if (cyclesWithReadings.length === 0) {
    return (
      <div
        className="w-full rounded-3xl border border-warm-100 bg-warm-50/60 flex flex-col items-center justify-center text-warm-400 gap-2 px-4 text-center"
        style={{ height }}
      >
        <LineChartIcon size={28} strokeWidth={1.5} />
        <p className="text-sm leading-relaxed">Log at least one cycle to see overlay comparison</p>
      </div>
    );
  }

  // Sort by startDate descending — most recent first
  const sorted = [...cyclesWithReadings].sort(
    (a, b) => new Date(b.cycle.startDate).getTime() - new Date(a.cycle.startDate).getTime(),
  );
  const maxDay = Math.max(
    ...sorted.flatMap((cwr) => cwr.readings.map((r) => r.cycleDay)),
    1,
  );

  // Build merged data keyed by cycleDay with one column per cycle id
  const dataByDay = new Map<number, Record<string, number | string | null>>();
  for (let cd = 1; cd <= maxDay; cd++) {
    dataByDay.set(cd, { cycleDay: cd, label: String(cd) });
  }
  sorted.forEach((cwr) => {
    const key = `c${cwr.cycle.id ?? cwr.cycle.startDate}`;
    for (const r of cwr.readings) {
      const row = dataByDay.get(r.cycleDay);
      if (!row) continue;
      const value = r[metric];
      row[key] = value != null ? value : null;
    }
  });
  const chartData = Array.from(dataByDay.values());

  // Map each cycle to its line metadata. Most recent gets full opacity + darkest color.
  let pastSeen = 0;
  const lines = sorted.map((cwr, index) => {
    const key = `c${cwr.cycle.id ?? cwr.cycle.startDate}`;
    const color = PALETTE[index % PALETTE.length];
    const ongoing = isOngoing(cwr.cycle);
    // Opacity: newest = 1.0, oldest ~0.4
    const span = Math.max(sorted.length - 1, 1);
    const opacity = 1 - (index / span) * 0.6;

    let label: string;
    if (ongoing) {
      label = 'Current cycle';
    } else {
      pastSeen += 1;
      label = `Cycle ${pastSeen} (started ${formatShortDate(cwr.cycle.startDate)})`;
    }

    return { key, color, opacity, label, ongoing };
  });

  const decimals = 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 18 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#ede9e7" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#a69e9b' }}
          axisLine={{ stroke: '#ede9e7' }}
          tickLine={false}
          label={{
            value: 'Cycle Day',
            position: 'insideBottom',
            offset: -6,
            style: { fontSize: 10, fill: '#a69e9b' },
          }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#a69e9b' }}
          axisLine={false}
          tickLine={false}
          domain={metric === 'bbt' ? [96.5, 99] : ['auto', 'auto']}
          label={{
            value: METRIC_LABELS[metric],
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 10, fill: '#a69e9b', textAnchor: 'middle' },
          }}
        />
        <Tooltip
          contentStyle={{
            background: 'white',
            border: '1px solid #ede9e7',
            borderRadius: '16px',
            fontSize: '11px',
            boxShadow: '0 8px 24px rgba(44,38,36,0.06)',
            padding: '10px 14px',
          }}
          formatter={(value) => {
            if (value == null || value === '') return ['—', ''];
            const num = typeof value === 'number' ? value : Number(value);
            if (Number.isNaN(num)) return [String(value), ''];
            return [num.toFixed(decimals), ''];
          }}
          labelFormatter={(label) => `Cycle Day ${label}`}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', color: '#8a7f7b', paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />

        {metric === 'bbt' && (
          <ReferenceLine
            y={97.7}
            stroke="#c9878f"
            strokeDasharray="4 4"
            strokeOpacity={0.45}
            label={{ value: 'Coverline 97.7°F', position: 'insideTopRight', fontSize: 9, fill: '#c9878f' }}
          />
        )}

        {lines.map((ln) => (
          <Line
            key={ln.key}
            type="monotone"
            dataKey={ln.key}
            name={ln.label}
            stroke={ln.color}
            strokeOpacity={ln.opacity}
            strokeWidth={ln.ongoing ? 2.5 : 2}
            dot={{ r: 2.5, fill: ln.color, fillOpacity: ln.opacity, stroke: 'white', strokeWidth: 1.2 }}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
