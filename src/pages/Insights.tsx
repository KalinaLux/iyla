import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, Zap, Brain } from 'lucide-react';
import { useCycles, useIntelligence } from '../lib/hooks';
import { generateCycleInsights, type CycleInsight } from '../lib/cycle-intelligence';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { DailyReading } from '../lib/types';
import WeeklyDigestCard from '../components/intelligence/WeeklyDigestCard';
import CorrelationsCard from '../components/intelligence/CorrelationsCard';
import PatternsCard from '../components/intelligence/PatternsCard';
import PredictionsCard from '../components/intelligence/PredictionsCard';
import ConcordanceBanner from '../components/intelligence/ConcordanceBanner';
import CycleOverlayCard from '../components/intelligence/CycleOverlayCard';
import CycleYearCalendar from '../components/intelligence/CycleYearCalendar';
import SymptomPatternsCard from '../components/intelligence/SymptomPatternsCard';
import CycleRetrospectiveCard from '../components/intelligence/CycleRetrospectiveCard';
import { format } from 'date-fns';

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
  const intelligence = useIntelligence();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const readings = allReadingsByCycle.flat();

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
          Patterns, anomalies, predictions, and correlations from your own data.
        </p>
      </div>

      {/* Weekly Digest — narrative summary at the top */}
      {intelligence && (
        <WeeklyDigestCard digest={intelligence.digest} />
      )}

      {/* Signal Concordance — today's multi-device outlier detection */}
      {intelligence?.concordance && (
        <ConcordanceBanner concordance={intelligence.concordance} hideWhenHealthy={false} />
      )}

      {/* Patterns */}
      {intelligence && (
        <PatternsCard patterns={intelligence.patterns} limit={20} />
      )}

      {/* Predictions */}
      {intelligence && (
        <PredictionsCard predictions={intelligence.predictions} today={todayStr} />
      )}

      {/* Correlations — the "what's moving the needle for you" card */}
      {intelligence && (
        <CorrelationsCard correlations={intelligence.correlations} />
      )}

      {/* Latest cycle retrospective */}
      {intelligence?.latestRetrospective && (
        <CycleRetrospectiveCard retrospective={intelligence.latestRetrospective} />
      )}

      {/* Symptom patterns — recurring symptoms tied to cycle phase */}
      {intelligence && intelligence.symptoms.length > 0 && (
        <SymptomPatternsCard patterns={intelligence.symptoms} />
      )}

      {/* Year at a glance — visual cycle calendar */}
      <CycleYearCalendar cycles={cycles} readings={readings} />

      {/* Cycle overlay — compare this cycle to history */}
      <CycleOverlayCard cycles={cycles} readings={readings} />

      {/* Personalized baselines summary */}
      {intelligence?.baselines && intelligence.baselines.sampleSize > 0 && (
        <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-warm-700 mb-4">Your personalized baselines</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <BaselineStat label="Avg cycle length" value={intelligence.baselines.cycleLength.mean > 0 ? `${intelligence.baselines.cycleLength.mean.toFixed(1)} days` : '—'} />
            <BaselineStat label="Avg luteal phase" value={intelligence.baselines.lutealPhase.meanDays > 0 ? `${intelligence.baselines.lutealPhase.meanDays.toFixed(1)} days` : '—'} />
            <BaselineStat label="Typical ovulation" value={intelligence.baselines.ovulation.typicalCycleDay ? `CD${intelligence.baselines.ovulation.typicalCycleDay}` : '—'} />
            <BaselineStat label="Your LH peak" value={intelligence.baselines.lhSurge.typicalPeakValue ? `${intelligence.baselines.lhSurge.typicalPeakValue.toFixed(1)} mIU/mL` : '—'} />
            <BaselineStat label="BBT baseline" value={intelligence.baselines.bbt.follicularBaseline ? `${intelligence.baselines.bbt.follicularBaseline.toFixed(2)}°F` : '—'} />
            <BaselineStat label="Kegg dry peak" value={intelligence.baselines.kegg.peakImpedance ? `${intelligence.baselines.kegg.peakImpedance.toFixed(0)}` : '—'} />
          </div>
          {intelligence.baselines.adaptiveRules.notes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-warm-100 space-y-2">
              {intelligence.baselines.adaptiveRules.notes.slice(0, 3).map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-warm-600 leading-relaxed">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-warm-400 shrink-0" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-[10px] uppercase tracking-wider text-warm-400 font-medium">
            Built from {intelligence.baselines.sampleSize} completed cycle{intelligence.baselines.sampleSize === 1 ? '' : 's'}
          </div>
        </div>
      )}

      {/* Legacy cycle-intelligence insights (still useful) */}
      {insights.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-warm-700 mb-3 px-1">Additional cycle insights</h2>
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-warm-600 mb-3">How iyla learns</h3>
        <div className="space-y-3 text-xs text-warm-400 leading-relaxed">
          <p>
            iyla analyzes patterns across your cycles — LH surge timing, estrogen peaks, thermal shifts,
            luteal phase length, sleep, stress, supplement adherence, and lab optimization. The engine
            blends your history with real-time signals to produce your <strong>iyla Score</strong>,
            pattern alerts, personalized correlations, and conception-odds forecasting.
          </p>
          <p>
            These insights are informational, not medical advice. Always discuss significant findings with your RE or OB/GYN.
          </p>
        </div>
      </div>
    </div>
  );
}

function BaselineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-warm-50 rounded-2xl p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-warm-400 font-semibold mb-1">{label}</div>
      <div className="text-lg font-bold text-warm-800 tabular-nums">{value}</div>
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
