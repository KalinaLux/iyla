import { useState } from 'react';
import { AlertTriangle, ShieldCheck, Info, ChevronDown, ChevronUp, Droplets, TrendingDown, Activity, Clock, Beaker } from 'lucide-react';
import type { ConcordanceResult, ConcordanceFlag } from '../../lib/signal-concordance';

interface Props {
  concordance: ConcordanceResult;
  /** Hide when confidence is high and there are no flags (the ideal state) */
  hideWhenHealthy?: boolean;
}

const FLAG_ICON: Record<ConcordanceFlag['kind'], React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  dilute_sample: Droplets,
  single_signal_contradiction: TrendingDown,
  impossible_lh_drop: Activity,
  kegg_double_dip: Beaker,
  historical_surge_expected: Clock,
};

const FLAG_LABEL: Record<ConcordanceFlag['kind'], string> = {
  dilute_sample: 'Dilute sample suspected',
  single_signal_contradiction: 'Outlier reading detected',
  impossible_lh_drop: 'Implausible LH drop',
  kegg_double_dip: 'Double-dip fertile pattern',
  historical_surge_expected: 'Surge expected now',
};

export default function ConcordanceBanner({ concordance, hideWhenHealthy = true }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasFlags = concordance.flags.length > 0;
  const isHealthy = !hasFlags && concordance.confidence === 'high';
  if (hideWhenHealthy && isHealthy && concordance.signals.length < 2) return null;
  if (hideWhenHealthy && isHealthy) {
    // Compact success pill
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 rounded-2xl border border-emerald-200">
        <ShieldCheck size={14} className="text-emerald-600 shrink-0" strokeWidth={2} />
        <span className="text-xs font-medium text-emerald-800 leading-tight">
          All {concordance.signals.length} signals agree today — concordance {concordance.concordanceScore}/100.
        </span>
      </div>
    );
  }

  // Determine severity
  const severity: 'critical' | 'warning' | 'info' = hasFlags
    ? concordance.flags.some(f => f.kind === 'dilute_sample' || f.kind === 'impossible_lh_drop' || f.kind === 'single_signal_contradiction')
      ? 'critical'
      : 'warning'
    : concordance.confidence === 'low'
    ? 'warning'
    : 'info';

  const style = {
    critical: {
      bg: 'bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50',
      border: 'border-amber-300',
      iconBg: 'bg-amber-500',
      iconColor: 'text-white',
      titleColor: 'text-amber-900',
      bodyColor: 'text-amber-800',
      headerIcon: AlertTriangle,
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconBg: 'bg-amber-400',
      iconColor: 'text-white',
      titleColor: 'text-amber-900',
      bodyColor: 'text-amber-700',
      headerIcon: AlertTriangle,
    },
    info: {
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      iconBg: 'bg-sky-400',
      iconColor: 'text-white',
      titleColor: 'text-sky-900',
      bodyColor: 'text-sky-700',
      headerIcon: Info,
    },
  }[severity];

  const HeaderIcon = style.headerIcon;

  return (
    <div className={`${style.bg} ${style.border} border rounded-3xl p-5 shadow-sm`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 text-left"
      >
        <div className={`shrink-0 w-10 h-10 rounded-2xl ${style.iconBg} flex items-center justify-center shadow-sm`}>
          <HeaderIcon size={18} className={style.iconColor} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`text-sm font-semibold ${style.titleColor} leading-snug`}>
              {hasFlags ? 'Signal concordance check' : 'Low confidence reading'}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${style.titleColor}/70`}>
                {concordance.concordanceScore}/100
              </span>
              {expanded ? <ChevronUp size={14} className={style.bodyColor} /> : <ChevronDown size={14} className={style.bodyColor} />}
            </div>
          </div>
          <p className={`text-[13px] ${style.bodyColor} mt-1 leading-relaxed`}>
            {concordance.narrative}
          </p>
          {concordance.statusLock.preventRegression && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-white/70 border border-amber-200">
              <ShieldCheck size={11} className="text-amber-700" strokeWidth={2.5} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                Status protected
              </span>
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-amber-200/60 space-y-3">
          {/* Flags */}
          {concordance.flags.map((flag, i) => {
            const Icon = FLAG_ICON[flag.kind];
            return (
              <div key={i} className="p-3 bg-white/70 rounded-2xl border border-amber-200/60">
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-0.5">
                    <Icon size={14} className={style.titleColor} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-xs font-semibold ${style.titleColor} uppercase tracking-wider`}>
                      {FLAG_LABEL[flag.kind]}
                    </h4>
                    <p className={`text-xs ${style.bodyColor} mt-1.5 leading-relaxed`}>
                      {flag.explanation}
                    </p>
                    <p className={`text-xs ${style.bodyColor}/90 mt-1.5 italic leading-relaxed`}>
                      → {flag.suggestion}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Sample quality */}
          {concordance.sampleQuality.quality !== 'unknown' && concordance.sampleQuality.quality !== 'acceptable' && (
            <div className="px-3 py-2 bg-white/50 rounded-xl">
              <p className={`text-[11px] ${style.bodyColor}`}>
                <span className="font-semibold uppercase tracking-wider mr-1.5">Sample:</span>
                {concordance.sampleQuality.message}
              </p>
            </div>
          )}

          {/* Signal breakdown */}
          {concordance.signals.length > 0 && (
            <div>
              <h4 className={`text-[10px] font-semibold uppercase tracking-wider ${style.titleColor} mb-2 px-1`}>
                Signals tracked today
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {concordance.signals.map((s, i) => (
                  <div key={i} className="px-2.5 py-1.5 bg-white/70 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-semibold ${style.titleColor}`}>{s.label}</span>
                      <span className={`text-[10px] tabular-nums ${style.bodyColor}`}>{String(s.value)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className={`text-[9px] uppercase tracking-wider ${
                        s.supports === 'fertile' ? 'text-emerald-600' :
                        s.supports === 'post_ovulatory' ? 'text-violet-600' :
                        s.supports === 'pre_ovulatory' ? 'text-sky-600' :
                        'text-warm-400'
                      }`}>
                        {s.supports.replace('_', '-')}
                      </span>
                      <span className={`text-[9px] ${style.bodyColor}/70`}>w {s.weight.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
