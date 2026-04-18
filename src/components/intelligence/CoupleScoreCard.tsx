import { Heart, Sparkles } from 'lucide-react';
import type { CoupleScore } from '../../lib/couple-score';

interface Props {
  score: CoupleScore;
}

const GRADE_COLOR: Record<CoupleScore['grade'], { text: string; bg: string }> = {
  A: { text: 'text-emerald-700', bg: 'bg-emerald-50' },
  B: { text: 'text-teal-700', bg: 'bg-teal-50' },
  C: { text: 'text-amber-700', bg: 'bg-amber-50' },
  D: { text: 'text-orange-700', bg: 'bg-orange-50' },
  F: { text: 'text-rose-700', bg: 'bg-rose-50' },
};

function Ring({
  value,
  size = 96,
  strokeW = 9,
  gradientId,
  from,
  to,
  label,
}: {
  value: number;
  size?: number;
  strokeW?: number;
  gradientId: string;
  from: string;
  to: string;
  label: string;
}) {
  const r = (size - strokeW) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (value / 100);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3ebe8" strokeWidth={strokeW} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-warm-800 tabular-nums">{value}</span>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-wider font-semibold text-warm-500 mt-2">
        {label}
      </span>
    </div>
  );
}

export default function CoupleScoreCard({ score }: Props) {
  const gradeColor = GRADE_COLOR[score.grade];
  const hasHis = score.hisContribution > 0;

  return (
    <section className="p-6 bg-gradient-to-br from-rose-50 via-white to-emerald-50 rounded-3xl border border-warm-100 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <Heart size={16} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-warm-800">Couple Score</h3>
            <p className="text-[11px] text-warm-500">You two, together</p>
          </div>
        </div>
        {score.teamworkBonus > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
            <Sparkles size={11} strokeWidth={2.25} />
            +{score.teamworkBonus} teamwork
          </span>
        )}
      </div>

      {/* Rings */}
      <div className="flex items-center justify-around gap-4 mb-5">
        <Ring
          value={score.herContribution}
          gradientId="couple-her"
          from="#f43f5e"
          to="#ec4899"
          label="Her"
        />

        {/* Center total */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-white shadow-inner flex flex-col items-center justify-center border border-warm-100">
              <span className="text-4xl font-bold text-warm-800 tabular-nums leading-none">
                {score.total}
              </span>
              <span className={`text-[11px] font-semibold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full ${gradeColor.bg} ${gradeColor.text}`}>
                Grade {score.grade}
              </span>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-warm-500 mt-2">
            Together
          </span>
        </div>

        <Ring
          value={hasHis ? score.hisContribution : 0}
          gradientId="couple-him"
          from="#10b981"
          to="#06b6d4"
          label="His"
        />
      </div>

      {/* Shared factors */}
      {score.sharedFactors.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {score.sharedFactors.slice(0, 3).map((f) => (
            <div
              key={f.label}
              className="px-3 py-2 bg-white/70 rounded-2xl border border-warm-100 text-center"
            >
              <p className="text-[10px] uppercase tracking-wider font-semibold text-warm-500 truncate">
                {f.label}
              </p>
              <p className="text-lg font-bold text-warm-800 tabular-nums mt-0.5">{f.score}</p>
            </div>
          ))}
        </div>
      )}

      {!hasHis && (
        <div className="mb-4 p-3 rounded-2xl bg-white/70 border border-warm-100 text-center">
          <p className="text-[11px] text-warm-500 leading-relaxed">
            His data isn't connected yet — invite him to unlock the full team view.
          </p>
        </div>
      )}

      <p className="text-sm text-warm-700 leading-relaxed text-center italic">
        {score.narrative}
      </p>

      <p className="text-[10px] text-warm-400 text-center mt-3">
        Updated{' '}
        {new Date(score.computedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </p>
    </section>
  );
}
