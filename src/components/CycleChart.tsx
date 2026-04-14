import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { DailyReading } from '../lib/types';

interface Props {
  readings: DailyReading[];
  cycleDay: number;
}

export default function CycleChart({ readings, cycleDay }: Props) {
  if (readings.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 text-warm-300 text-sm">
        Your cycle chart will appear here once you log your first reading.
      </div>
    );
  }

  const allCycleDays = Array.from({ length: cycleDay }, (_, i) => i + 1);
  const readingMap = new Map(readings.map(r => [r.cycleDay, r]));

  const chartData = allCycleDays.map(cd => {
    const r = readingMap.get(cd);
    return {
      cycleDay: cd,
      label: `${cd}`,
      bbt: r?.bbt,
      lh: r?.lh,
      e3g: r?.e3g,
      pdg: r?.pdg,
      keggImpedance: r?.keggImpedance,
      keggScore: r?.keggScore,
    };
  });

  const hasBBT = readings.some(r => r.bbt != null);
  const hasLH = readings.some(r => r.lh != null);
  const hasE3G = readings.some(r => r.e3g != null);
  const hasPdG = readings.some(r => r.pdg != null);
  const hasKegg = readings.some(r => r.keggImpedance != null);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#ede9e7" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#a69e9b' }}
          axisLine={{ stroke: '#ede9e7' }}
          tickLine={false}
        />

        {hasBBT && (
          <YAxis
            yAxisId="bbt"
            orientation="left"
            domain={[96.5, 99]}
            tick={{ fontSize: 10, fill: '#a69e9b' }}
            axisLine={false}
            tickLine={false}
            label={{ value: '°F', position: 'insideTopLeft', style: { fontSize: 10, fill: '#a69e9b' } }}
          />
        )}

        {(hasLH || hasE3G || hasPdG) && (
          <YAxis
            yAxisId="hormones"
            orientation="right"
            tick={{ fontSize: 10, fill: '#a69e9b' }}
            axisLine={false}
            tickLine={false}
          />
        )}

        {hasKegg && !hasBBT && (
          <YAxis
            yAxisId="kegg"
            orientation="left"
            tick={{ fontSize: 10, fill: '#a69e9b' }}
            axisLine={false}
            tickLine={false}
          />
        )}

        <Tooltip
          contentStyle={{
            background: 'white',
            border: '1px solid #ede9e7',
            borderRadius: '16px',
            fontSize: '11px',
            boxShadow: '0 8px 24px rgba(44,38,36,0.06)',
            padding: '12px 16px',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', color: '#8a7f7b' }}
          iconType="circle"
          iconSize={8}
        />

        {hasBBT && (
          <Line
            yAxisId="bbt"
            type="natural"
            dataKey="bbt"
            stroke="#c9878f"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#c9878f', stroke: 'white', strokeWidth: 2 }}
            connectNulls
            name="BBT (°F)"
          />
        )}

        {hasLH && (
          <Line
            yAxisId="hormones"
            type="natural"
            dataKey="lh"
            stroke="#c99a3d"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#c99a3d', stroke: 'white', strokeWidth: 2 }}
            connectNulls
            name="LH (mIU/mL)"
          />
        )}

        {hasE3G && (
          <Line
            yAxisId="hormones"
            type="natural"
            dataKey="e3g"
            stroke="#0d9488"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#0d9488', stroke: 'white', strokeWidth: 2 }}
            connectNulls
            name="E3G (pg/mL)"
          />
        )}

        {hasPdG && (
          <Line
            yAxisId="hormones"
            type="natural"
            dataKey="pdg"
            stroke="#9b8ec4"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#9b8ec4', stroke: 'white', strokeWidth: 2 }}
            connectNulls
            name="PdG (µg/mL)"
          />
        )}

        {hasKegg && (
          <Bar
            yAxisId={hasBBT ? 'bbt' : 'kegg'}
            dataKey="keggScore"
            fill="#0d9488"
            opacity={0.2}
            name="Kegg Score"
            barSize={14}
            radius={[8, 8, 0, 0]}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
