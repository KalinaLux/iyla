import { LinkIcon, TrendingUp, TrendingDown } from 'lucide-react';
import type { Correlation } from '../../lib/intelligence';

interface Props {
  correlations: Correlation[];
}

const STRENGTH_STYLE = {
  strong:   { dot: 'bg-emerald-500', label: 'text-emerald-600', bar: 'bg-emerald-400' },
  moderate: { dot: 'bg-teal-500',    label: 'text-teal-600',    bar: 'bg-teal-400' },
  weak:     { dot: 'bg-warm-400',    label: 'text-warm-500',    bar: 'bg-warm-300' },
};

export default function CorrelationsCard({ correlations }: Props) {
  if (correlations.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <LinkIcon size={16} className="text-warm-500" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-warm-700">What's moving the needle for you</h3>
        </div>
        <p className="text-sm text-warm-400 mt-2">
          After 3 tracked cycles, iyla will find the lifestyle factors that correlate most strongly with your cycle quality. Keep logging — your personalized insights are being built.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <LinkIcon size={16} className="text-warm-500" strokeWidth={1.75} />
        <h3 className="text-base font-semibold text-warm-700">What's moving the needle for you</h3>
      </div>
      <p className="text-[11px] text-warm-400 mb-4">Patterns found in your own data — not population averages.</p>
      <div className="space-y-4">
        {correlations.map(c => {
          const st = STRENGTH_STYLE[c.strength];
          const DirIcon = c.direction === 'positive' ? TrendingUp : TrendingDown;
          return (
            <div key={c.id} className="border-b border-warm-100 last:border-0 pb-4 last:pb-0">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h4 className="text-sm font-semibold text-warm-800 leading-snug">{c.title}</h4>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${st.label}`}>{c.strength}</span>
                </div>
              </div>
              <p className="text-sm text-warm-600 leading-relaxed">{c.narrative}</p>
              <div className="flex items-center gap-3 mt-3 text-[11px] text-warm-400">
                <span className="flex items-center gap-1">
                  <DirIcon size={11} strokeWidth={2} className={c.direction === 'positive' ? 'text-emerald-500' : 'text-rose-500'} />
                  r = <span className="tabular-nums font-semibold text-warm-600">{c.r.toFixed(2)}</span>
                </span>
                <span>n = {c.sampleSize}</span>
                <span>confidence {Math.round(c.confidence * 100)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
