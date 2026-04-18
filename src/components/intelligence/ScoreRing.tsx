import { ArrowUpRight, ArrowDownRight, Minus, Info } from 'lucide-react';
import type { IylaScore } from '../../lib/intelligence';

interface Props {
  score: IylaScore;
  onClick?: () => void;
  compact?: boolean;
}

const GRADE_COLORS: Record<string, { ring: string; text: string; bg: string; glow: string }> = {
  A: { ring: 'stroke-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', glow: 'shadow-emerald-100/50' },
  B: { ring: 'stroke-teal-500', text: 'text-teal-600', bg: 'bg-teal-50', glow: 'shadow-teal-100/50' },
  C: { ring: 'stroke-amber-500', text: 'text-amber-600', bg: 'bg-amber-50', glow: 'shadow-amber-100/50' },
  D: { ring: 'stroke-orange-500', text: 'text-orange-600', bg: 'bg-orange-50', glow: 'shadow-orange-100/50' },
  F: { ring: 'stroke-rose-500', text: 'text-rose-600', bg: 'bg-rose-50', glow: 'shadow-rose-100/50' },
};

export default function ScoreRing({ score, onClick, compact = false }: Props) {
  const color = GRADE_COLORS[score.grade] ?? GRADE_COLORS.C;
  const size = compact ? 72 : 120;
  const strokeW = compact ? 7 : 10;
  const r = (size - strokeW) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (score.total / 100);
  const delta = score.delta7Day;
  const DeltaIcon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const deltaColor = delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-rose-500' : 'text-warm-400';

  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-4 ${compact ? 'p-3' : 'p-5'} bg-white rounded-3xl border border-warm-100 shadow-sm hover:shadow-md transition-all duration-300 active:scale-[0.98] w-full text-left`}
    >
      {/* Ring */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeW} className="text-warm-100" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className={`${color.ring} transition-all duration-700 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${compact ? 'text-xl' : 'text-3xl'} font-bold text-warm-800 tabular-nums leading-none`}>{score.total}</span>
          <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} uppercase tracking-wider font-medium ${color.text} mt-0.5`}>
            {score.grade}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${color.bg} ${color.text}`}>
            iyla Score
          </span>
          {delta !== 0 && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${deltaColor}`}>
              <DeltaIcon size={12} strokeWidth={2.5} />
              {Math.abs(delta)}
            </span>
          )}
        </div>
        {!compact && (
          <>
            <p className="text-sm text-warm-700 font-medium mt-1 leading-snug line-clamp-2">
              {score.topPositiveFactor ?? score.topNegativeFactor ?? 'Tracking your fertility intelligence.'}
            </p>
            <div className="flex items-center gap-1 mt-2 text-[11px] text-warm-400 font-medium group-hover:text-warm-600 transition-colors">
              <Info size={11} />
              Tap to see what's moving your score
            </div>
          </>
        )}
      </div>
    </button>
  );
}
