import { useMemo, useState } from 'react';
import { Trophy, Lock, Filter, Sparkles } from 'lucide-react';
import { useAchievements } from '../lib/hooks';
import type { Achievement, AchievementCategory } from '../lib/achievements';
import { summarize } from '../lib/achievements';

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

type FilterMode = 'all' | 'earned' | 'locked' | AchievementCategory;

export default function Achievements() {
  const { all } = useAchievements();
  const [filter, setFilter] = useState<FilterMode>('all');

  const stats = useMemo(() => summarize(all), [all]);
  const pct = stats.total > 0 ? Math.round((stats.earned / stats.total) * 100) : 0;

  const filtered = useMemo(() => {
    if (filter === 'all') return all;
    if (filter === 'earned') return all.filter(a => a.earnedAt);
    if (filter === 'locked') return all.filter(a => !a.earnedAt);
    return all.filter(a => a.category === filter);
  }, [all, filter]);

  const grouped = useMemo(() => {
    const earned = filtered.filter(a => a.earnedAt);
    const almost = filtered.filter(a => !a.earnedAt && a.progress >= 0.5);
    const locked = filtered.filter(a => !a.earnedAt && a.progress < 0.5);
    return { earned, almost, locked };
  }, [filtered]);

  if (all.length === 0) {
    return (
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800">Milestones</h1>
          <p className="text-sm text-warm-400 mt-0.5">Your fertility journey, celebrated.</p>
        </div>
        <div className="bg-white rounded-3xl border border-warm-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-warm-50 mx-auto mb-4 flex items-center justify-center">
            <Trophy size={28} strokeWidth={1.5} className="text-warm-400" />
          </div>
          <p className="text-sm text-warm-600">
            Start tracking to unlock your first milestone. Every day counts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-warm-800">Milestones</h1>
        <p className="text-sm text-warm-400 mt-0.5">Your fertility journey, celebrated.</p>
      </div>

      {/* Progress hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-100 via-rose-50 to-lavender-100 rounded-3xl p-7 shadow-sm">
        <div className="relative z-10 flex items-center gap-5">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke="url(#grad)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 213.6} 213.6`}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#f472b6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-bold text-warm-800">{pct}%</div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">
              Progress
            </div>
            <div className="text-lg font-semibold text-warm-800">
              {stats.earned} of {stats.total} milestones
            </div>
            {stats.nextUp && (
              <div className="text-xs text-warm-600 mt-1 flex items-center gap-1">
                <Sparkles size={11} strokeWidth={2} className="text-amber-600" />
                Next: {stats.nextUp.title}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <Filter size={14} strokeWidth={2} className="text-warm-400 shrink-0" />
        {([
          ['all', 'All'],
          ['earned', 'Earned'],
          ['locked', 'Locked'],
          ['consistency', 'Consistency'],
          ['body', 'Body'],
          ['partner', 'Partner'],
          ['wellness', 'Wellness'],
          ['knowledge', 'Knowledge'],
        ] as Array<[FilterMode, string]>).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === id
                ? 'bg-warm-800 text-white'
                : 'bg-white border border-warm-100 text-warm-600 hover:bg-warm-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Earned */}
      {grouped.earned.length > 0 && (
        <Section title="Earned" count={grouped.earned.length}>
          {grouped.earned.map(a => <AchievementRow key={a.id} a={a} />)}
        </Section>
      )}

      {/* Almost there */}
      {grouped.almost.length > 0 && (
        <Section title="Almost there" count={grouped.almost.length}>
          {grouped.almost.map(a => <AchievementRow key={a.id} a={a} />)}
        </Section>
      )}

      {/* Locked */}
      {grouped.locked.length > 0 && (
        <Section title="Still to earn" count={grouped.locked.length} icon={<Lock size={12} />}>
          {grouped.locked.map(a => <AchievementRow key={a.id} a={a} />)}
        </Section>
      )}
    </div>
  );
}

function Section({
  title, count, icon, children,
}: { title: string; count: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-warm-500">{title}</h2>
        <span className="text-xs text-warm-400">· {count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AchievementRow({ a }: { a: Achievement }) {
  const earned = !!a.earnedAt;
  return (
    <div className={`bg-white rounded-2xl border border-warm-100 p-4 flex items-start gap-4 ${!earned ? 'opacity-80' : ''}`}>
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0 ${
          earned
            ? `bg-gradient-to-br ${CATEGORY_COLORS[a.category]} ring-2 ${TIER_RING[a.tier]} shadow-sm`
            : 'bg-warm-50 ring-2 ring-warm-100 opacity-60'
        }`}
      >
        {a.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-warm-800 leading-tight">{a.title}</div>
            <div className="text-xs text-warm-400 mt-0.5">
              {CATEGORY_LABELS[a.category]} · <span className="capitalize">{a.tier}</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-warm-600 mt-2 leading-relaxed">{a.description}</div>
        {!earned && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-warm-100 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${CATEGORY_COLORS[a.category]} transition-all`}
                style={{ width: `${a.progress * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-warm-500 font-medium whitespace-nowrap">{a.progressLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
