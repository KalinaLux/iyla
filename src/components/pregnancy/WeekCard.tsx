import { Sparkles } from 'lucide-react';
import type { WeeklyMilestone } from '../../lib/pregnancy';

interface Props {
  week: number;
  day: number;
  trimester: 1 | 2 | 3;
  milestone: WeeklyMilestone;
  daysUntilDue: number;
}

const TRIMESTER_LABEL: Record<1 | 2 | 3, string> = {
  1: 'First trimester',
  2: 'Second trimester',
  3: 'Third trimester',
};

/** A tiny emoji cue paired with baby size for warmth without being twee. */
function sizeEmoji(week: number): string {
  if (week <= 4) return '🌱';
  if (week <= 7) return '🫐';
  if (week <= 10) return '🫒';
  if (week <= 13) return '🍋';
  if (week <= 17) return '🥑';
  if (week <= 21) return '🥭';
  if (week <= 25) return '🌽';
  if (week <= 29) return '🍆';
  if (week <= 33) return '🍍';
  if (week <= 37) return '🍈';
  return '🍉';
}

export default function WeekCard({ week, day, trimester, milestone, daysUntilDue }: Props) {
  const weekPct = Math.min(100, Math.max(0, (week / 40) * 100));

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-lavender-100 via-rose-50 to-amber-50 p-7 shadow-sm border border-white/50">
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/30 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex items-start justify-between gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} className="text-lavender-500" strokeWidth={2} />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-warm-500">
              {TRIMESTER_LABEL[trimester]}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <h2 className="text-5xl font-bold text-warm-800 tracking-tight leading-none">
              {week}
            </h2>
            <div className="pb-1">
              <p className="text-sm font-semibold text-warm-700 leading-tight">
                weeks
              </p>
              <p className="text-xs text-warm-500">{day} day{day === 1 ? '' : 's'}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span className="text-2xl leading-none">{sizeEmoji(week)}</span>
            <p className="text-sm text-warm-700">
              <span className="text-warm-500">About the size of </span>
              <span className="font-semibold text-warm-800">{milestone.babySize}</span>
            </p>
          </div>

          <p className="text-sm text-warm-600 leading-relaxed mt-3 max-w-md">
            {milestone.developmentHighlight}
          </p>
        </div>

        {/* Days until due ring */}
        <div className="shrink-0 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center border border-white/80 shadow-sm">
            <span className="text-[10px] font-medium text-warm-400 -mb-0.5">
              {daysUntilDue >= 0 ? 'to go' : 'past due'}
            </span>
            <span className="text-2xl font-bold text-warm-800">
              {Math.abs(daysUntilDue)}
            </span>
            <span className="text-[10px] text-warm-400">
              {Math.abs(daysUntilDue) === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>
      </div>

      {/* 40-week progress bar */}
      <div className="relative z-10 mt-6">
        <div className="flex items-center justify-between text-[10px] text-warm-400 mb-1.5 font-medium">
          <span>1w</span>
          <span>13w</span>
          <span>27w</span>
          <span>40w</span>
        </div>
        <div className="h-2 bg-white/60 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-rose-300 via-lavender-400 to-lavender-600 transition-all duration-700 ease-out rounded-full"
            style={{ width: `${weekPct}%` }}
          />
          {/* Trimester ticks */}
          {[13, 27].map((t) => (
            <div
              key={t}
              className="absolute top-0 bottom-0 w-px bg-white/80"
              style={{ left: `${(t / 40) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
