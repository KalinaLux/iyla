import { useState, useMemo } from 'react';
import { Trophy, Sparkles, ChevronRight, Lock } from 'lucide-react';
import type { Achievement, AchievementCategory } from '../../lib/achievements';
import { summarize } from '../../lib/achievements';

interface Props {
  achievements: Achievement[];
  onSeeAll?: () => void;
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  consistency: 'Consistency',
  body: 'Body signals',
  partner: 'Partner',
  wellness: 'Wellness',
  knowledge: 'Knowledge',
};

const CATEGORY_COLORS: Record<AchievementCategory, string> = {
  consistency: 'from-emerald-400 to-teal-400',
  body: 'from-rose-400 to-amber-400',
  partner: 'from-violet-400 to-indigo-400',
  wellness: 'from-lavender-400 to-rose-300',
  knowledge: 'from-amber-400 to-orange-400',
};

const TIER_RING: Record<Achievement['tier'], string> = {
  bronze: 'ring-amber-300',
  silver: 'ring-warm-400',
  gold: 'ring-amber-400',
};

export default function AchievementsCard({ achievements, onSeeAll }: Props) {
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => summarize(achievements), [achievements]);
  const earnedList = achievements.filter(a => a.earnedAt).slice(0, 6);
  const pct = stats.total > 0 ? Math.round((stats.earned / stats.total) * 100) : 0;

  if (achievements.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl border border-warm-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full p-6 flex items-center justify-between hover:bg-warm-50/50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center shadow-sm">
            <Trophy size={22} strokeWidth={1.5} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-warm-800">Milestones</h3>
            <p className="text-sm text-warm-400 mt-0.5">
              {stats.earned} earned of {stats.total} · {pct}% complete
            </p>
          </div>
        </div>
        <ChevronRight
          size={20}
          strokeWidth={1.5}
          className={`text-warm-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {!expanded && earnedList.length > 0 && (
        <div className="px-6 pb-6 flex items-center gap-2 flex-wrap">
          {earnedList.map(a => (
            <div
              key={a.id}
              className={`w-12 h-12 rounded-full bg-gradient-to-br ${CATEGORY_COLORS[a.category]} ring-2 ${TIER_RING[a.tier]} flex items-center justify-center text-xl shadow-sm`}
              title={a.title}
            >
              {a.icon}
            </div>
          ))}
          {stats.earned > earnedList.length && (
            <div className="text-xs text-warm-500 ml-1">+{stats.earned - earnedList.length} more</div>
          )}
        </div>
      )}

      {expanded && (
        <div className="px-6 pb-6 space-y-4">
          {/* Next up */}
          {stats.nextUp && (
            <div className="bg-gradient-to-br from-warm-50 to-amber-50 rounded-2xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} strokeWidth={2} className="text-amber-600" />
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Next up</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl opacity-60">
                  {stats.nextUp.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-warm-800">{stats.nextUp.title}</div>
                  <div className="text-xs text-warm-500 mt-0.5">{stats.nextUp.description}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-warm-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all"
                        style={{ width: `${stats.nextUp.progress * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-warm-500 font-medium">
                      {stats.nextUp.progressLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Earned grid */}
          {earnedList.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-3">Earned</div>
              <div className="grid grid-cols-2 gap-2">
                {earnedList.map(a => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 bg-warm-50 rounded-2xl p-3"
                  >
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${CATEGORY_COLORS[a.category]} ring-2 ${TIER_RING[a.tier]} flex items-center justify-center text-lg shrink-0`}>
                      {a.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-warm-800 leading-tight">{a.title}</div>
                      <div className="text-[10px] text-warm-500 mt-0.5 line-clamp-2">{a.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          <div>
            <div className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-3">Progress by area</div>
            <div className="space-y-2">
              {(Object.keys(stats.byCategory) as AchievementCategory[]).map(cat => {
                const c = stats.byCategory[cat];
                const pct = c.total > 0 ? (c.earned / c.total) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${CATEGORY_COLORS[cat]}`} />
                    <span className="text-xs font-medium text-warm-600 w-24">{CATEGORY_LABELS[cat]}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-warm-100 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${CATEGORY_COLORS[cat]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-warm-500 font-medium w-10 text-right">
                      {c.earned}/{c.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Locked preview */}
          {achievements.some(a => !a.earnedAt) && (
            <div>
              <div className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                <Lock size={10} strokeWidth={2} /> Still to earn
              </div>
              <div className="flex flex-wrap gap-2">
                {achievements.filter(a => !a.earnedAt).slice(0, 6).map(a => (
                  <div
                    key={a.id}
                    className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-base opacity-40"
                    title={`${a.title} — ${a.progressLabel ?? 'locked'}`}
                  >
                    {a.icon}
                  </div>
                ))}
              </div>
            </div>
          )}

          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="w-full py-2.5 text-xs font-medium text-warm-600 hover:text-warm-800 transition-colors"
            >
              See all milestones
            </button>
          )}
        </div>
      )}
    </div>
  );
}
