import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, Zap, Brain } from 'lucide-react';
import { useCycles } from '../lib/hooks';
import { generateCycleInsights, type CycleInsight } from '../lib/cycle-intelligence';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { DailyReading } from '../lib/types';

const iconMap = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'alert': AlertTriangle,
  'check': CheckCircle,
  'info': Info,
  'zap': Zap,
};

const severityStyles = {
  positive: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-500',
    titleColor: 'text-emerald-800',
    textColor: 'text-emerald-600',
  },
  neutral: {
    bg: 'bg-warm-50',
    border: 'border-warm-200',
    iconBg: 'bg-warm-100',
    iconColor: 'text-warm-400',
    titleColor: 'text-warm-700',
    textColor: 'text-warm-500',
  },
  attention: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-800',
    textColor: 'text-amber-600',
  },
};

export default function Insights() {
  const cycles = useCycles();
  const supplementLogs = useLiveQuery(() => db.supplementLogs.toArray()) ?? [];

  // Fetch readings for ALL cycles, grouped by cycle
  const allReadingsByCycle = useLiveQuery(async () => {
    if (cycles.length === 0) return [] as DailyReading[][];
    const groups = await Promise.all(
      cycles.map(c =>
        c.id != null
          ? db.readings.where('cycleId').equals(c.id).sortBy('cycleDay')
          : Promise.resolve([] as DailyReading[]),
      ),
    );
    return groups.filter(g => g.length > 0);
  }, [cycles]) ?? [];

  const insights = generateCycleInsights(cycles, allReadingsByCycle, supplementLogs);

  return (
    <div className="space-y-7">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center shadow-sm">
            <Brain size={16} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-semibold text-warm-800">Cycle Intelligence</h1>
        </div>
        <p className="text-sm text-warm-400 mt-1">
          Patterns, anomalies, and correlations across your cycles.
        </p>
      </div>

      <div className="space-y-3">
        {insights.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-warm-600 mb-3">How iyla learns</h3>
        <div className="space-y-3 text-xs text-warm-400 leading-relaxed">
          <p>
            iyla analyzes patterns across your cycles — LH surge timing, estrogen peaks, thermal shifts,
            luteal phase length, and supplement compliance. The more cycles you track, the smarter these insights become.
          </p>
          <p>
            These insights are informational, not medical advice. Always discuss significant findings with your RE or OB/GYN.
          </p>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: CycleInsight }) {
  const Icon = iconMap[insight.icon];
  const style = severityStyles[insight.severity];

  return (
    <div className={`${style.bg} border ${style.border} rounded-3xl p-5 flex gap-4`}>
      <div className={`w-10 h-10 rounded-2xl ${style.iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={style.iconColor} strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-semibold ${style.titleColor} mb-1`}>{insight.title}</h3>
        <p className={`text-xs leading-relaxed ${style.textColor}`}>{insight.detail}</p>
      </div>
    </div>
  );
}
