import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  Moon,
  Bed,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Brain,
  Droplets,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';
import type { CyclePhase } from '../lib/types';

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual: '#c9878f',
  follicular: '#0d9488',
  ovulatory: '#d4af61',
  luteal: '#9b8ec4',
};

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
};

function getCyclePhase(cycleDay: number, ovulationDay?: number): CyclePhase {
  if (cycleDay <= 5) return 'menstrual';
  if (!ovulationDay) {
    if (cycleDay <= 13) return 'follicular';
    if (cycleDay <= 16) return 'ovulatory';
    return 'luteal';
  }
  if (cycleDay < ovulationDay - 1) return 'follicular';
  if (cycleDay <= ovulationDay + 1) return 'ovulatory';
  return 'luteal';
}

interface SleepMetrics {
  avgScore: number | null;
  avgDeepSleep: number | null;
  avgInterruptions: number | null;
  trend: 'improving' | 'declining' | 'stable';
  prevAvgScore: number | null;
}

interface ScatterPoint {
  sleepScore: number;
  pdg: number;
  cycleDay: number;
  phase: CyclePhase;
}

interface TimelinePoint {
  cycleDay: number;
  sleepScore: number | null;
  interruptions: number | null;
  isFertile: boolean;
  date: string;
}

interface Insight {
  icon: LucideIcon;
  text: string;
  color: string;
}

const SLEEP_TIPS: {
  phase: CyclePhase;
  label: string;
  icon: LucideIcon;
  bg: string;
  border: string;
  iconColor: string;
  titleColor: string;
  textColor: string;
  text: string;
}[] = [
  {
    phase: 'follicular',
    label: 'Follicular Phase',
    icon: Activity,
    bg: 'bg-teal-50',
    border: 'border-teal-100',
    iconColor: 'text-teal-500',
    titleColor: 'text-teal-800',
    textColor: 'text-teal-600',
    text: 'Estrogen is building energy. Light exercise helps but avoid intense workouts after 6pm.',
  },
  {
    phase: 'ovulatory',
    label: 'Ovulatory Phase',
    icon: Thermometer,
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-800',
    textColor: 'text-amber-600',
    text: 'Your body temperature is about to shift. Keep your bedroom cool (65\u201368\u00b0F).',
  },
  {
    phase: 'luteal',
    label: 'Luteal Phase',
    icon: Moon,
    bg: 'bg-violet-50',
    border: 'border-violet-100',
    iconColor: 'text-violet-500',
    titleColor: 'text-violet-800',
    textColor: 'text-violet-600',
    text: 'Progesterone is a natural sedative \u2014 honor the drowsiness. This is your body preparing.',
  },
  {
    phase: 'menstrual',
    label: 'Menstrual Phase',
    icon: Bed,
    bg: 'bg-rose-50',
    border: 'border-rose-100',
    iconColor: 'text-rose-500',
    titleColor: 'text-rose-800',
    textColor: 'text-rose-600',
    text: 'Iron loss can disrupt sleep. Consider magnesium glycinate 400mg 1 hour before bed.',
  },
];

export default function SleepAnalysis() {
  const currentCycle = useLiveQuery(() =>
    db.cycles.where('outcome').equals('ongoing').first()
  );

  const allCycles = useLiveQuery(() =>
    db.cycles.orderBy('startDate').reverse().toArray()
  ) ?? [];

  const cycleId = currentCycle?.id;

  const readings = useLiveQuery(
    () => cycleId ? db.readings.where('cycleId').equals(cycleId).sortBy('cycleDay') : [],
    [cycleId]
  ) ?? [];

  const previousCycle = allCycles.find(c => c.id !== cycleId);
  const prevCycleId = previousCycle?.id;

  const prevReadings = useLiveQuery(
    () => prevCycleId ? db.readings.where('cycleId').equals(prevCycleId).sortBy('cycleDay') : [],
    [prevCycleId]
  ) ?? [];

  const sleepMetrics = useMemo<SleepMetrics>(() => {
    const withSleep = readings.filter(r => r.sleepScore != null);
    const prevWithSleep = prevReadings.filter(r => r.sleepScore != null);

    if (withSleep.length === 0) {
      return { avgScore: null, avgDeepSleep: null, avgInterruptions: null, trend: 'stable', prevAvgScore: null };
    }

    const avgScore = Math.round(
      withSleep.reduce((s, r) => s + r.sleepScore!, 0) / withSleep.length
    );

    const deepEntries = withSleep.filter(r => r.deepSleepMin != null);
    const avgDeepSleep = deepEntries.length > 0
      ? Math.round(deepEntries.reduce((s, r) => s + r.deepSleepMin!, 0) / deepEntries.length)
      : null;

    const intEntries = withSleep.filter(r => r.sleepInterruptions != null);
    const avgInterruptions = intEntries.length > 0
      ? +(intEntries.reduce((s, r) => s + r.sleepInterruptions!, 0) / intEntries.length).toFixed(1)
      : null;

    const prevAvgScore = prevWithSleep.length > 0
      ? Math.round(prevWithSleep.reduce((s, r) => s + r.sleepScore!, 0) / prevWithSleep.length)
      : null;

    let trend: SleepMetrics['trend'] = 'stable';
    if (prevAvgScore != null) {
      const diff = avgScore - prevAvgScore;
      if (diff >= 3) trend = 'improving';
      else if (diff <= -3) trend = 'declining';
    }

    return { avgScore, avgDeepSleep, avgInterruptions, trend, prevAvgScore };
  }, [readings, prevReadings]);

  const scatterData = useMemo<ScatterPoint[]>(() =>
    readings
      .filter(r => r.sleepScore != null && r.pdg != null)
      .map(r => ({
        sleepScore: r.sleepScore!,
        pdg: r.pdg!,
        cycleDay: r.cycleDay,
        phase: getCyclePhase(r.cycleDay, currentCycle?.ovulationDay),
      })),
    [readings, currentCycle?.ovulationDay]
  );

  const timelineData = useMemo<TimelinePoint[]>(() => {
    const ovDay = currentCycle?.ovulationDay;
    const fertileStart = ovDay ? ovDay - 5 : null;
    const fertileEnd = ovDay ?? null;

    return readings.map(r => ({
      cycleDay: r.cycleDay,
      sleepScore: r.sleepScore ?? null,
      interruptions: r.sleepInterruptions ?? null,
      isFertile: fertileStart != null && fertileEnd != null && r.cycleDay >= fertileStart && r.cycleDay <= fertileEnd,
      date: r.date,
    }));
  }, [readings, currentCycle?.ovulationDay]);

  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];

    const paired = readings.filter(r => r.sleepScore != null && r.pdg != null);
    if (paired.length >= 3) {
      const scores = paired.map(r => r.sleepScore!).sort((a, b) => a - b);
      const threshold = scores[Math.floor(scores.length * 0.33)] ?? 60;
      const lowSleep = paired.filter(r => r.sleepScore! <= threshold);
      const goodSleep = paired.filter(r => r.sleepScore! > threshold);

      if (lowSleep.length > 0 && goodSleep.length > 0) {
        const avgPdgLow = lowSleep.reduce((s, r) => s + r.pdg!, 0) / lowSleep.length;
        const avgPdgGood = goodSleep.reduce((s, r) => s + r.pdg!, 0) / goodSleep.length;
        if (avgPdgGood > avgPdgLow * 1.05) {
          result.push({
            icon: Droplets,
            text: `Your worst PdG readings followed nights with sleep scores below ${threshold}. Average PdG was ${avgPdgLow.toFixed(1)} vs ${avgPdgGood.toFixed(1)} on well-rested nights.`,
            color: 'amber',
          });
        }
      }
    }

    const ovDay = currentCycle?.ovulationDay;
    if (ovDay) {
      const luteal = readings.filter(r => r.sleepScore != null && r.cycleDay > ovDay + 1);
      const follicular = readings.filter(r => r.sleepScore != null && r.cycleDay > 5 && r.cycleDay < ovDay - 1);

      if (luteal.length > 0 && follicular.length > 0) {
        const avgLuteal = luteal.reduce((s, r) => s + r.sleepScore!, 0) / luteal.length;
        const avgFollicular = follicular.reduce((s, r) => s + r.sleepScore!, 0) / follicular.length;
        result.push({
          icon: Moon,
          text: avgLuteal >= avgFollicular
            ? `Your sleep quality improves during the luteal phase (avg ${Math.round(avgLuteal)} vs ${Math.round(avgFollicular)} follicular).`
            : `Your sleep quality declines during the luteal phase (avg ${Math.round(avgLuteal)} vs ${Math.round(avgFollicular)} follicular).`,
          color: avgLuteal >= avgFollicular ? 'emerald' : 'violet',
        });
      }
    }

    for (let i = 0; i < readings.length - 1; i++) {
      if (readings[i].sleepInterruptions != null && readings[i + 1].e3g != null) {
        const highInterrupt: { e3g: number }[] = [];
        const lowInterrupt: { e3g: number }[] = [];

        for (let j = 0; j < readings.length - 1; j++) {
          if (readings[j].sleepInterruptions != null && readings[j + 1].e3g != null) {
            const bucket = readings[j].sleepInterruptions! >= 2 ? highInterrupt : lowInterrupt;
            bucket.push({ e3g: readings[j + 1].e3g! });
          }
        }

        if (highInterrupt.length > 0 && lowInterrupt.length > 0) {
          const avgHigh = highInterrupt.reduce((s, d) => s + d.e3g, 0) / highInterrupt.length;
          const avgLow = lowInterrupt.reduce((s, d) => s + d.e3g, 0) / lowInterrupt.length;
          if (avgLow > avgHigh) {
            result.push({
              icon: Activity,
              text: `Nights with 2+ interruptions correlate with lower next-day estrogen (${Math.round(avgHigh)} vs ${Math.round(avgLow)} pg/mL).`,
              color: 'rose',
            });
          }
        }
        break;
      }
    }

    if (result.length === 0) {
      result.push(
        {
          icon: Moon,
          text: 'Keep logging sleep data \u2014 iyla needs at least a few days of paired sleep + hormone readings to surface correlations.',
          color: 'warm',
        },
        {
          icon: Lightbulb,
          text: 'Track your TempDrop sleep score each morning for the most accurate analysis.',
          color: 'warm',
        },
      );
    }

    return result;
  }, [readings, currentCycle?.ovulationDay]);

  const hasSleepData = readings.some(r => r.sleepScore != null);

  return (
    <div className="space-y-7">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
            <Moon size={16} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-semibold text-warm-800">Sleep &amp; Hormones</h1>
        </div>
        <p className="text-sm text-warm-400 mt-1">
          How your sleep quality impacts your hormone readings and cycle outcomes.
        </p>
      </div>

      <SleepOverviewCard metrics={sleepMetrics} />

      <div className="bg-white rounded-3xl border border-warm-100 p-7 shadow-sm">
        <h2 className="text-base font-semibold text-warm-700 mb-1">
          Does your sleep affect your progesterone?
        </h2>
        <p className="text-xs text-warm-400 mb-5">Each dot is one day&apos;s sleep score paired with its PdG reading</p>
        {scatterData.length >= 2 ? (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e0e0e0" />
                <XAxis
                  type="number"
                  dataKey="sleepScore"
                  name="Sleep Score"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#a0a0a0' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Sleep Score', position: 'insideBottom', offset: -5, style: { fontSize: 10, fill: '#a0a0a0' } }}
                />
                <YAxis
                  type="number"
                  dataKey="pdg"
                  name="PdG"
                  tick={{ fontSize: 10, fill: '#a0a0a0' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'PdG (\u00b5g/mL)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#a0a0a0' } }}
                />
                <Tooltip content={<ScatterTooltipContent />} />
                <Scatter data={scatterData} fillOpacity={0.85}>
                  {scatterData.map((entry, i) => (
                    <Cell key={i} fill={PHASE_COLORS[entry.phase]} r={6} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-4 flex-wrap">
              {(Object.entries(PHASE_LABELS) as [CyclePhase, string][]).map(([phase, label]) => (
                <div key={phase} className="flex items-center gap-1.5 text-xs text-warm-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PHASE_COLORS[phase] }} />
                  {label}
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState message="Need at least 2 days with both sleep score and PdG readings to show this chart." />
        )}
      </div>

      <div className="bg-white rounded-3xl border border-warm-100 p-7 shadow-sm">
        <h2 className="text-base font-semibold text-warm-700 mb-1">Sleep Quality Timeline</h2>
        <p className="text-xs text-warm-400 mb-5">
          Daily sleep score across your cycle
          {currentCycle?.ovulationDay ? ' \u2014 highlighted bars show your fertile window' : ''}
        </p>
        {hasSleepData ? (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={timelineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e0e0e0" vertical={false} />
                <XAxis
                  dataKey="cycleDay"
                  tick={{ fontSize: 10, fill: '#a0a0a0' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Cycle Day', position: 'insideBottom', offset: -5, style: { fontSize: 10, fill: '#a0a0a0' } }}
                />
                <YAxis
                  yAxisId="score"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#a0a0a0' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Sleep Score', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#a0a0a0' } }}
                />
                <YAxis
                  yAxisId="interruptions"
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#a0a0a0' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<TimelineTooltipContent />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', color: '#a0a0a0' }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar
                  yAxisId="score"
                  dataKey="sleepScore"
                  name="Sleep Score"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                >
                  {timelineData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isFertile ? '#d4af61' : '#818cf8'}
                      fillOpacity={entry.sleepScore != null ? 0.8 : 0}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="interruptions"
                  type="monotone"
                  dataKey="interruptions"
                  name="Interruptions"
                  stroke="#e11d48"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#e11d48', stroke: 'white', strokeWidth: 2 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-warm-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400" />
                Regular nights
              </div>
              {currentCycle?.ovulationDay && (
                <div className="flex items-center gap-1.5 text-xs text-warm-400">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#d4af61' }} />
                  Fertile window
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-warm-400">
                <span className="w-2.5 h-0.5 rounded bg-rose-500" />
                Interruptions
              </div>
            </div>
          </>
        ) : (
          <EmptyState message="No sleep data recorded this cycle yet." />
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold text-warm-700 mb-3 flex items-center gap-2">
          <Brain size={18} className="text-warm-400" strokeWidth={1.5} />
          Sleep Insights
        </h2>
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-warm-700 mb-3 flex items-center gap-2">
          <Lightbulb size={18} className="text-warm-400" strokeWidth={1.5} />
          Sleep Tips by Cycle Phase
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SLEEP_TIPS.map(tip => (
            <div key={tip.phase} className={`${tip.bg} rounded-3xl p-5 border ${tip.border}`}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className={`w-8 h-8 rounded-xl ${tip.bg} flex items-center justify-center`}>
                  <tip.icon size={16} className={tip.iconColor} strokeWidth={1.5} />
                </div>
                <h3 className={`text-sm font-semibold ${tip.titleColor}`}>{tip.label}</h3>
              </div>
              <p className={`text-xs leading-relaxed ${tip.textColor}`}>{tip.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
        <p className="text-xs text-warm-400 leading-relaxed">
          Sleep correlation data is observational, not causal. These patterns help you understand your body&apos;s
          unique rhythms. Always discuss concerns with your healthcare provider.
        </p>
      </div>
    </div>
  );
}

function SleepOverviewCard({ metrics }: { metrics: SleepMetrics }) {
  const TrendIcon = metrics.trend === 'improving' ? TrendingUp : metrics.trend === 'declining' ? TrendingDown : Minus;
  const trendLabel = metrics.trend === 'improving' ? 'Improving' : metrics.trend === 'declining' ? 'Declining' : 'Stable';
  const trendColor = metrics.trend === 'improving' ? 'text-emerald-200' : metrics.trend === 'declining' ? 'text-rose-200' : 'text-white/60';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 p-7 text-white shadow-lg">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-5">
          <Moon size={20} strokeWidth={1.5} />
          <h2 className="text-base font-semibold">Sleep This Cycle</h2>
        </div>

        {metrics.avgScore != null ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div>
              <p className="text-xs text-white/60 mb-1">Avg Sleep Score</p>
              <p className="text-3xl font-bold tracking-tight">{metrics.avgScore}</p>
              <p className="text-xs text-white/50 mt-0.5">out of 100</p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">Avg Deep Sleep</p>
              <p className="text-3xl font-bold tracking-tight">
                {metrics.avgDeepSleep != null ? metrics.avgDeepSleep : '\u2014'}
              </p>
              <p className="text-xs text-white/50 mt-0.5">minutes</p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">Avg Interruptions</p>
              <p className="text-3xl font-bold tracking-tight">
                {metrics.avgInterruptions != null ? metrics.avgInterruptions : '\u2014'}
              </p>
              <p className="text-xs text-white/50 mt-0.5">per night</p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">vs Last Cycle</p>
              <div className="flex items-center gap-2 mt-1">
                <TrendIcon size={24} className={trendColor} strokeWidth={2} />
                <span className={`text-sm font-medium ${trendColor}`}>{trendLabel}</span>
              </div>
              {metrics.prevAvgScore != null && (
                <p className="text-xs text-white/40 mt-1">
                  prev avg {metrics.prevAvgScore}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-3">
            <Bed size={20} className="text-white/40" />
            <p className="text-sm text-white/60">
              No sleep data this cycle yet. Log your TempDrop readings to see your sleep overview.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScatterTooltipContent({ active, payload }: { active?: boolean; payload?: { payload: ScatterPoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-warm-100 rounded-2xl shadow-lg p-3 text-xs">
      <p className="font-medium text-warm-700 mb-1">Cycle Day {d.cycleDay}</p>
      <p className="text-warm-500">Sleep Score: <span className="font-medium text-warm-700">{d.sleepScore}</span></p>
      <p className="text-warm-500">PdG: <span className="font-medium text-warm-700">{d.pdg} \u00b5g/mL</span></p>
      <p className="text-warm-400 capitalize mt-1">{d.phase} phase</p>
    </div>
  );
}

function TimelineTooltipContent({ active, payload }: { active?: boolean; payload?: { value: number; dataKey: string; payload: TimelinePoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-warm-100 rounded-2xl shadow-lg p-3 text-xs">
      <p className="font-medium text-warm-700 mb-1">
        Day {d.cycleDay}
        {d.date ? ` \u2022 ${format(new Date(d.date + 'T00:00:00'), 'MMM d')}` : ''}
      </p>
      {d.sleepScore != null && (
        <p className="text-warm-500">Sleep Score: <span className="font-medium text-warm-700">{d.sleepScore}</span></p>
      )}
      {d.interruptions != null && (
        <p className="text-warm-500">Interruptions: <span className="font-medium text-warm-700">{d.interruptions}</span></p>
      )}
      {d.isFertile && (
        <p className="text-amber-500 mt-1 font-medium">Fertile window</p>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const Icon = insight.icon;
  const styles: Record<string, { bg: string; border: string; iconBg: string; iconColor: string; text: string }> = {
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   iconBg: 'bg-amber-100',   iconColor: 'text-amber-500',   text: 'text-amber-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-500', text: 'text-emerald-700' },
    violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  iconBg: 'bg-violet-100',  iconColor: 'text-violet-500',  text: 'text-violet-700' },
    rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    iconBg: 'bg-rose-100',    iconColor: 'text-rose-500',    text: 'text-rose-700' },
    warm:    { bg: 'bg-warm-50',    border: 'border-warm-200',    iconBg: 'bg-warm-100',    iconColor: 'text-warm-400',    text: 'text-warm-600' },
  };
  const s = styles[insight.color] ?? styles.warm;

  return (
    <div className={`${s.bg} border ${s.border} rounded-3xl p-5 flex gap-4`}>
      <div className={`w-10 h-10 rounded-2xl ${s.iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={s.iconColor} strokeWidth={1.5} />
      </div>
      <p className={`text-xs leading-relaxed ${s.text} pt-2.5`}>{insight.text}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <Moon size={28} className="text-warm-200 mb-3" strokeWidth={1.5} />
      <p className="text-sm text-warm-300 max-w-xs">{message}</p>
    </div>
  );
}
