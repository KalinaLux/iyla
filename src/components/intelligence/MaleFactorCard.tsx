import { ResponsiveContainer, LineChart, Line, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { Beaker, TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import type { SemenAnalysis } from '../../lib/male-factor-db';

interface Props {
  analyses: SemenAnalysis[];
  onAddClick?: () => void;
}

type ParamKey =
  | 'concentrationMillionsPerMl'
  | 'totalMotilePct'
  | 'progressiveMotilityPct'
  | 'morphologyPct'
  | 'dnaFragmentationPct'
  | 'volumeMl'
  | 'phAbove'
  | 'vitalityPct';

interface ParamConfig {
  key: ParamKey;
  label: string;
  unit: string;
  refLabel: string;
  refMin?: number;
  refMax?: number;
  inverted?: boolean;
  color: string;
  format: (v: number) => string;
}

const PARAMS: ParamConfig[] = [
  {
    key: 'concentrationMillionsPerMl',
    label: 'Concentration',
    unit: 'M/mL',
    refLabel: '≥16 M/mL',
    refMin: 16,
    color: '#10b981',
    format: (v) => v.toFixed(1),
  },
  {
    key: 'totalMotilePct',
    label: 'Total motility',
    unit: '%',
    refLabel: '≥42%',
    refMin: 42,
    color: '#0891b2',
    format: (v) => `${v.toFixed(0)}`,
  },
  {
    key: 'progressiveMotilityPct',
    label: 'Progressive motility',
    unit: '%',
    refLabel: '≥30%',
    refMin: 30,
    color: '#14b8a6',
    format: (v) => `${v.toFixed(0)}`,
  },
  {
    key: 'morphologyPct',
    label: 'Morphology (Kruger)',
    unit: '%',
    refLabel: '≥4%',
    refMin: 4,
    color: '#8b5cf6',
    format: (v) => v.toFixed(1),
  },
  {
    key: 'dnaFragmentationPct',
    label: 'DNA fragmentation',
    unit: '%',
    refLabel: '<15%',
    refMax: 15,
    inverted: true,
    color: '#f59e0b',
    format: (v) => `${v.toFixed(0)}`,
  },
  {
    key: 'volumeMl',
    label: 'Volume',
    unit: 'mL',
    refLabel: '1.5–5.0',
    refMin: 1.5,
    refMax: 5.0,
    color: '#64748b',
    format: (v) => v.toFixed(1),
  },
  {
    key: 'phAbove',
    label: 'pH',
    unit: '',
    refLabel: '≥7.2',
    refMin: 7.2,
    color: '#64748b',
    format: (v) => v.toFixed(1),
  },
  {
    key: 'vitalityPct',
    label: 'Vitality',
    unit: '%',
    refLabel: '≥58%',
    refMin: 58,
    color: '#0ea5e9',
    format: (v) => `${v.toFixed(0)}`,
  },
];

function inRange(p: ParamConfig, v: number): boolean {
  if (p.refMin != null && v < p.refMin) return false;
  if (p.refMax != null && v > p.refMax) return false;
  return true;
}

function getTrend(p: ParamConfig, values: number[]): 'up' | 'down' | 'flat' | null {
  if (values.length < 2) return null;
  const prev = values[values.length - 2];
  const curr = values[values.length - 1];
  if (prev === 0) return null;
  const rel = (curr - prev) / Math.abs(prev);
  if (Math.abs(rel) < 0.05) return 'flat';
  const improved = p.inverted ? rel < 0 : rel > 0;
  return improved ? 'up' : 'down';
}

function ParamTile({ p, analyses }: { p: ParamConfig; analyses: SemenAnalysis[] }) {
  const sortedAsc = [...analyses].sort((a, b) => (a.date < b.date ? -1 : 1));
  const points = sortedAsc
    .map((sa) => {
      const v = sa[p.key];
      if (typeof v !== 'number') return null;
      return { date: sa.date, value: v };
    })
    .filter((x): x is { date: string; value: number } => x != null);

  if (points.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-white border border-warm-100">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-warm-500">{p.label}</p>
            <p className="text-sm text-warm-300 mt-1">No data</p>
          </div>
          <span className="text-[10px] text-warm-400">{p.refLabel}</span>
        </div>
      </div>
    );
  }

  const values = points.map((pt) => pt.value);
  const latest = points[points.length - 1].value;
  const ok = inRange(p, latest);
  const trend = getTrend(p, values);
  const TrendIcon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }> | null =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : trend === 'flat' ? Minus : null;
  const trendColor =
    trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-warm-400';

  return (
    <div className="p-4 rounded-2xl bg-white border border-warm-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-warm-500 truncate">{p.label}</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-2xl font-bold tabular-nums ${ok ? 'text-warm-800' : 'text-amber-600'}`}>
              {p.format(latest)}
            </span>
            {p.unit && <span className="text-xs text-warm-400">{p.unit}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-medium ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
              {ok ? 'In range' : 'Out of range'}
            </span>
            <span className="text-[10px] text-warm-400">ref {p.refLabel}</span>
          </div>
        </div>
        {TrendIcon && (
          <div className={`flex items-center gap-0.5 ${trendColor} shrink-0`}>
            <TrendIcon size={14} strokeWidth={2.25} />
          </div>
        )}
      </div>
      {points.length >= 2 && (
        <div className="mt-3 h-16 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                cursor={{ stroke: '#ede9e7', strokeWidth: 1 }}
                contentStyle={{
                  background: 'white',
                  border: '1px solid #ede9e7',
                  borderRadius: '12px',
                  fontSize: '11px',
                  padding: '6px 10px',
                }}
                formatter={(v) => [p.format(Number(v)), p.label] as [string, string]}
                labelFormatter={(label) => String(label ?? '')}
              />
              {p.refMin != null && (
                <ReferenceLine y={p.refMin} stroke="#d6c9c3" strokeDasharray="3 3" />
              )}
              {p.refMax != null && (
                <ReferenceLine y={p.refMax} stroke="#d6c9c3" strokeDasharray="3 3" />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={p.color}
                strokeWidth={2}
                dot={{ r: 2.5, fill: p.color, stroke: 'white', strokeWidth: 1.5 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CardShell({ children, onAddClick }: { children: ReactNode; onAddClick?: () => void }) {
  return (
    <section className="p-5 bg-white rounded-3xl border border-warm-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Beaker size={16} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-warm-800">Semen Analysis</h3>
            <p className="text-[11px] text-warm-400">Lab parameters & trends</p>
          </div>
        </div>
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-colors"
          >
            <Plus size={12} strokeWidth={2.5} />
            New
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export default function MaleFactorCard({ analyses, onAddClick }: Props) {
  if (analyses.length === 0) {
    return (
      <CardShell>
        <div className="py-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <Beaker size={24} strokeWidth={1.5} />
          </div>
          <h4 className="text-sm font-semibold text-warm-800">No analysis on file yet</h4>
          <p className="text-xs text-warm-500 mt-1 max-w-xs mx-auto leading-relaxed">
            Add your first semen analysis to track concentration, motility, morphology, and more over time.
          </p>
          {onAddClick && (
            <button
              onClick={onAddClick}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-full transition-colors"
            >
              <Plus size={12} strokeWidth={2.5} />
              Add your first analysis
            </button>
          )}
        </div>
      </CardShell>
    );
  }

  const sortedDesc = [...analyses].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = sortedDesc[0];

  return (
    <CardShell onAddClick={onAddClick}>
      <div className="flex items-center justify-between mb-3 text-[11px] text-warm-400">
        <span>
          Latest:{' '}
          <span className="font-medium text-warm-600">
            {new Date(latest.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {latest.clinic && <span className="text-warm-400"> · {latest.clinic}</span>}
        </span>
        <span>
          {analyses.length} analysis{analyses.length === 1 ? '' : 'es'} tracked
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {PARAMS.map((p) => (
          <ParamTile key={p.key} p={p} analyses={analyses} />
        ))}
      </div>
    </CardShell>
  );
}
