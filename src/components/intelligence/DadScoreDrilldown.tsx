import { TrendingUp, TrendingDown, Sparkles, AlertCircle, Moon, Dumbbell, Beaker, Pill, CalendarCheck } from 'lucide-react';
import type { ComponentType } from 'react';
import Modal from '../Modal';
import { getDadScoreHistory, type DadScore, type DadDomainId } from '../../lib/dad-score';

interface Props {
  open: boolean;
  onClose: () => void;
  score: DadScore;
}

const STATUS_STYLE: Record<string, { bar: string; label: string }> = {
  excellent: { bar: 'bg-emerald-500', label: 'text-emerald-600' },
  good: { bar: 'bg-teal-500', label: 'text-teal-600' },
  fair: { bar: 'bg-amber-500', label: 'text-amber-600' },
  needs_attention: { bar: 'bg-rose-400', label: 'text-rose-500' },
};

const STATUS_LABEL: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  needs_attention: 'Needs attention',
};

const DOMAIN_ICONS: Record<DadDomainId, ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  sleep: Moon,
  lifestyle: Dumbbell,
  semen_quality: Beaker,
  supplements: Pill,
  consistency: CalendarCheck,
};

export default function DadScoreDrilldown({ open, onClose, score }: Props) {
  const history = getDadScoreHistory().slice(-30);

  const sparkPath = (() => {
    if (history.length < 2) return null;
    const w = 260;
    const h = 60;
    const min = Math.min(...history.map((h) => h.total));
    const max = Math.max(...history.map((h) => h.total));
    const range = max - min || 1;
    const points = history.map((pt, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((pt.total - min) / range) * h;
      return `${x},${y}`;
    });
    return { w, h, d: `M ${points.join(' L ')}` };
  })();

  return (
    <Modal open={open} onClose={onClose} title="Your Dad Score">
      <div className="space-y-5 px-1 pb-1">
        {/* Summary */}
        <div className="bg-gradient-to-br from-emerald-600 to-cyan-700 text-white rounded-3xl p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-medium text-white/60">Your Score</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-5xl font-bold tabular-nums">{score.total}</span>
                <span className="text-lg font-medium text-white/70">{score.grade}</span>
              </div>
            </div>
            <div className="text-right text-xs text-white/70 space-y-0.5">
              <div className="flex items-center gap-1 justify-end">
                {score.delta7Day > 0 ? <TrendingUp size={11} /> : score.delta7Day < 0 ? <TrendingDown size={11} /> : null}
                <span className="font-medium">
                  {score.delta7Day > 0 ? '+' : ''}
                  {score.delta7Day} this week
                </span>
              </div>
              <div>
                {score.delta30Day > 0 ? '+' : ''}
                {score.delta30Day} over 30 days
              </div>
            </div>
          </div>
          {sparkPath && (
            <svg width="100%" viewBox={`0 0 ${sparkPath.w} ${sparkPath.h}`} className="mt-4 opacity-80">
              <path d={sparkPath.d} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <p className="text-[11px] text-white/60 mt-3 leading-snug">{score.summary}</p>
          <p className="text-[11px] text-white/50 mt-1">
            {history.length < 2 ? 'Trend will appear as more data is captured' : `${history.length}-day trend`}
          </p>
        </div>

        {/* Top factors */}
        <div className="grid sm:grid-cols-2 gap-3">
          {score.topPositiveFactor && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={12} className="text-emerald-600" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700">Working for you</span>
              </div>
              <p className="text-sm text-emerald-800 font-medium leading-snug">{score.topPositiveFactor}</p>
            </div>
          )}
          {score.topNegativeFactor && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle size={12} className="text-amber-600" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-700">Worth attention</span>
              </div>
              <p className="text-sm text-amber-800 font-medium leading-snug">{score.topNegativeFactor}</p>
            </div>
          )}
        </div>

        {/* Domains */}
        <div>
          <h3 className="text-sm font-semibold text-warm-700 mb-3 px-1">How each domain contributes</h3>
          <div className="space-y-3">
            {score.domains.map((d) => {
              const st = STATUS_STYLE[d.status] ?? STATUS_STYLE.fair;
              const Icon = DOMAIN_ICONS[d.id];
              return (
                <div key={d.id} className="p-4 bg-white rounded-2xl border border-warm-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Icon size={16} strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-warm-800">{d.label}</p>
                        <p className={`text-[11px] font-medium ${st.label}`}>
                          {STATUS_LABEL[d.status] ?? d.status}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-warm-800 tabular-nums">{d.score}</span>
                      <span className="text-[10px] text-warm-400 ml-1">/ 100</span>
                      <p className="text-[10px] text-warm-400">Weight {Math.round(d.weight * 100)}%</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${st.bar} rounded-full transition-all duration-700`}
                      style={{ width: `${d.score}%` }}
                    />
                  </div>
                  {d.note && <p className="text-xs text-warm-500 mt-2 leading-relaxed">{d.note}</p>}
                  {d.contributingSignals.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {d.contributingSignals.slice(0, 4).map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-warm-500 truncate">{s.label}</span>
                          <span className="text-warm-600 font-medium tabular-nums ml-2 shrink-0">{s.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] text-warm-400 text-center pt-1">
          Data completeness: {Math.round(score.dataCompleteness * 100)}% · Updated{' '}
          {new Date(score.computedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>
    </Modal>
  );
}
