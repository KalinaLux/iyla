import { useState } from 'react';
import { Check, Circle, Dot } from 'lucide-react';
import { PREGNANCY_MILESTONES, type WeeklyMilestone } from '../../lib/pregnancy';

interface Props {
  currentWeek: number;
}

const TRIMESTER_SECTIONS: { trimester: 1 | 2 | 3; label: string; range: string }[] = [
  { trimester: 1, label: 'First trimester', range: 'Weeks 1–13' },
  { trimester: 2, label: 'Second trimester', range: 'Weeks 14–27' },
  { trimester: 3, label: 'Third trimester', range: 'Weeks 28–40' },
];

export default function PregnancyTimeline({ currentWeek }: Props) {
  const [expanded, setExpanded] = useState<number | null>(currentWeek);

  const byTrimester: Record<1 | 2 | 3, WeeklyMilestone[]> = { 1: [], 2: [], 3: [] };
  for (const m of PREGNANCY_MILESTONES) byTrimester[m.trimester].push(m);

  return (
    <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-warm-800">Timeline</h3>
          <p className="text-xs text-warm-400 mt-0.5">
            All 40 weeks. Tap any week to read its milestone.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-lavender-600 bg-lavender-50 px-3 py-1 rounded-full">
          Week {currentWeek}
        </span>
      </div>

      <div className="space-y-6">
        {TRIMESTER_SECTIONS.map(({ trimester, label, range }) => (
          <div key={trimester}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-warm-400">
                {label}
              </p>
              <p className="text-[10px] text-warm-300">{range}</p>
            </div>
            <div className="space-y-1">
              {byTrimester[trimester].map((m) => {
                const done = m.week < currentWeek;
                const current = m.week === currentWeek;
                const isOpen = expanded === m.week;

                return (
                  <div key={m.week}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : m.week)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${
                        current
                          ? 'bg-gradient-to-r from-lavender-100 to-rose-50 border border-lavender-200'
                          : isOpen
                            ? 'bg-warm-50 border border-warm-150'
                            : 'hover:bg-warm-50 border border-transparent'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                          done
                            ? 'bg-emerald-100 text-emerald-600'
                            : current
                              ? 'bg-lavender-500 text-white shadow-sm shadow-lavender-300'
                              : 'bg-warm-100 text-warm-400'
                        }`}
                      >
                        {done ? (
                          <Check size={13} strokeWidth={2.5} />
                        ) : current ? (
                          <Dot size={22} strokeWidth={3} />
                        ) : (
                          <Circle size={11} strokeWidth={2} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold ${
                            current ? 'text-warm-800' : done ? 'text-warm-600' : 'text-warm-500'
                          }`}
                        >
                          Week {m.week}
                          <span className="font-normal text-warm-400 ml-2">
                            {m.babySize}
                          </span>
                        </p>
                        {!isOpen && (
                          <p className="text-xs text-warm-400 truncate">
                            {m.developmentHighlight}
                          </p>
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-11 py-3 pb-4 space-y-2.5">
                        <p className="text-sm text-warm-700 leading-relaxed">
                          {m.developmentHighlight}
                        </p>
                        <div className="bg-lavender-50/60 rounded-2xl px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-lavender-600 mb-1">
                            This week
                          </p>
                          <p className="text-sm text-warm-700 leading-relaxed">
                            {m.momTip}
                          </p>
                        </div>
                        {m.lossRiskNote && (
                          <p className="text-xs text-warm-500 italic leading-relaxed px-1">
                            {m.lossRiskNote}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
