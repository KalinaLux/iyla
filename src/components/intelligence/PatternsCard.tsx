import { AlertTriangle, AlertCircle, Info, CheckCircle2, Lightbulb } from 'lucide-react';
import type { DetectedPattern } from '../../lib/intelligence';

interface Props {
  patterns: DetectedPattern[];
  limit?: number;
}

const STYLE = {
  alert:    { bg: 'bg-rose-50',    border: 'border-rose-200',   icon: AlertTriangle, iconColor: 'text-rose-500',    label: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700' },
  watch:    { bg: 'bg-amber-50',   border: 'border-amber-200',  icon: AlertCircle,   iconColor: 'text-amber-500',   label: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  info:     { bg: 'bg-sky-50',     border: 'border-sky-200',    icon: Info,          iconColor: 'text-sky-500',     label: 'text-sky-700',     badge: 'bg-sky-100 text-sky-700' },
  positive: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2, iconColor: 'text-emerald-500', label: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
};

export default function PatternsCard({ patterns, limit = 5 }: Props) {
  if (patterns.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-warm-700 mb-1">Pattern Detection</h3>
        <p className="text-sm text-warm-400">Once you log a full cycle, iyla will start surfacing patterns here — things like strengthening LH surges, lengthening luteal phases, and early anomaly warnings.</p>
      </div>
    );
  }

  const shown = patterns.slice(0, limit);

  return (
    <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-warm-500" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-warm-700">What iyla is noticing</h3>
        </div>
        <span className="text-[11px] text-warm-400 font-medium">{patterns.length} signal{patterns.length !== 1 ? 's' : ''}</span>
      </div>
      {shown.map(p => {
        const style = STYLE[p.severity];
        const Icon = style.icon;
        return (
          <div key={p.id} className={`${style.bg} ${style.border} border rounded-2xl p-4`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 ${style.iconColor}`}>
                <Icon size={17} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`text-sm font-semibold ${style.label}`}>{p.title}</h4>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold ${style.badge}`}>
                    {p.category}
                  </span>
                </div>
                <p className="text-sm text-warm-600 mt-1 leading-relaxed">{p.description}</p>
                {p.actionable && (
                  <p className="text-xs text-warm-500 mt-2 italic leading-relaxed">→ {p.actionable}</p>
                )}
                {p.dataPoints.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.dataPoints.slice(0, 3).map((dp, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/60 text-warm-600 font-medium">
                        {dp.label}: <span className="tabular-nums">{dp.value}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {patterns.length > limit && (
        <p className="text-[11px] text-warm-400 text-center pt-1">
          + {patterns.length - limit} more on the Insights page
        </p>
      )}
    </div>
  );
}
