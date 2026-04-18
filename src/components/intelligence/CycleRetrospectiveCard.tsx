import { format, parseISO } from 'date-fns';
import {
  ScrollText,
  CheckCircle2,
  Target,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import type { CycleRetrospective } from '../../lib/cycle-retrospective';

interface Props {
  retrospective: CycleRetrospective;
}

type DeltaTone = 'positive' | 'neutral' | 'muted';

function formatIsoDate(iso: string): string {
  try {
    return format(parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso), 'MMM d');
  } catch {
    return iso;
  }
}

function formatPercent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function deltaPill(
  label: string,
  delta: number | null,
  tone: (d: number) => DeltaTone,
  formatFn: (d: number) => string,
): { label: string; text: string; tone: DeltaTone } | null {
  if (delta == null) return null;
  return {
    label,
    text: formatFn(delta),
    tone: tone(delta),
  };
}

const TONE_CLASSES: Record<DeltaTone, string> = {
  positive: 'bg-green-100 text-green-600 border-green-200',
  neutral: 'bg-lavender-100 text-lavender-600 border-lavender-200',
  muted: 'bg-warm-100 text-warm-500 border-warm-200',
};

const TONE_ICONS: Record<DeltaTone, typeof ArrowUp> = {
  positive: ArrowUp,
  neutral: Minus,
  muted: ArrowDown,
};

export default function CycleRetrospectiveCard({ retrospective: r }: Props) {
  const stats: Array<{ label: string; value: string; sub?: string }> = [
    {
      label: 'Cycle length',
      value: `${r.cycleLength}d`,
      sub: 'start to next period',
    },
    {
      label: 'Ovulation',
      value: r.ovulationDay != null ? `CD${r.ovulationDay}` : '—',
      sub: r.ovulationDay != null ? 'detected' : 'not detected',
    },
    {
      label: 'Luteal phase',
      value: r.lutealLength != null ? `${r.lutealLength}d` : '—',
      sub: r.lutealLength != null && r.lutealLength >= 12 ? 'strong' : r.lutealLength != null && r.lutealLength < 10 ? 'short' : undefined,
    },
    {
      label: 'BBT shift',
      value: r.bbtShift != null ? `+${r.bbtShift.toFixed(2)}°F` : '—',
      sub: r.peakBbt != null ? `peak ${r.peakBbt.toFixed(2)}°F` : undefined,
    },
    {
      label: 'Peak LH',
      value: r.lhPeakValue != null ? `${r.lhPeakValue}` : '—',
      sub: r.lhPeakDay != null ? `CD${r.lhPeakDay}` : 'no data',
    },
    {
      label: 'Adherence',
      value: formatPercent(r.adherenceRate),
      sub: `${r.daysLogged} / ${r.cycleLength} days`,
    },
  ];

  const pills = [
    deltaPill(
      'Cycle length',
      r.vs.cycleLengthDelta,
      d => (Math.abs(d) <= 1 ? 'neutral' : 'muted'),
      d => `${d > 0 ? '+' : ''}${d.toFixed(1)}d vs avg`,
    ),
    deltaPill(
      'Luteal',
      r.vs.lutealDelta,
      d => (d > 0 ? 'positive' : d === 0 ? 'neutral' : 'muted'),
      d => `${d > 0 ? '+' : ''}${d.toFixed(1)}d vs avg`,
    ),
    deltaPill(
      'Peak BBT',
      r.vs.peakBbtDelta,
      d => (d > 0 ? 'positive' : d === 0 ? 'neutral' : 'muted'),
      d => `${d > 0 ? '+' : ''}${d.toFixed(2)}°F vs avg`,
    ),
  ].filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <div className="rounded-3xl p-6 shadow-sm border border-lavender-100 bg-gradient-to-br from-lavender-50 to-rose-50 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 opacity-30 pointer-events-none">
        <Sparkles size={120} strokeWidth={0.75} className="text-lavender-300" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <ScrollText size={14} className="text-lavender-600" strokeWidth={1.75} />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-lavender-600">
          Cycle retrospective
        </span>
      </div>

      <div className="flex items-baseline justify-between flex-wrap gap-x-3 gap-y-1 relative z-10">
        <h3 className="text-sm font-semibold text-warm-700">{r.cycleLabel}</h3>
        <p className="text-[11px] text-warm-500 tabular-nums">
          {formatIsoDate(r.startDate)} → {formatIsoDate(r.endDate)}
        </p>
      </div>

      {/* Headline */}
      <h2 className="mt-3 text-xl font-bold text-warm-900 leading-snug relative z-10">
        {r.headline}
      </h2>
      <p className="mt-2 text-sm text-warm-600 leading-relaxed relative z-10">
        {r.summary}
      </p>

      {/* Stats grid */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 relative z-10">
        {stats.map(s => (
          <div
            key={s.label}
            className="p-3 bg-white/70 backdrop-blur-sm rounded-2xl border border-white"
          >
            <p className="text-[10px] uppercase tracking-wider font-semibold text-warm-400">
              {s.label}
            </p>
            <p className="text-lg font-bold tabular-nums text-warm-900 leading-tight mt-0.5">
              {s.value}
            </p>
            {s.sub && (
              <p className="text-[10px] text-warm-500 mt-0.5">{s.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* vs previous pills */}
      {pills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 relative z-10">
          {pills.map(p => {
            const Icon = TONE_ICONS[p.tone];
            return (
              <span
                key={p.label}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${TONE_CLASSES[p.tone]}`}
              >
                <Icon size={10} strokeWidth={2} />
                <span className="text-warm-500">{p.label}:</span>
                <span className="tabular-nums">{p.text}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Celebrate */}
      {r.celebrate.length > 0 && (
        <div className="mt-5 relative z-10">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-green-600 mb-2">
            To celebrate
          </p>
          <ul className="space-y-1.5">
            {r.celebrate.map((c, i) => (
              <li key={i} className="text-sm text-warm-700 flex items-start gap-2 leading-relaxed">
                <CheckCircle2
                  size={14}
                  className="text-green-500 mt-0.5 shrink-0"
                  strokeWidth={2}
                />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Growth edges */}
      {r.growthEdge.length > 0 && (
        <div className="mt-4 relative z-10">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-rose-400 mb-2">
            Gentle growth edges
          </p>
          <ul className="space-y-1.5">
            {r.growthEdge.map((g, i) => (
              <li key={i} className="text-sm text-warm-700 flex items-start gap-2 leading-relaxed">
                <Target
                  size={14}
                  className="text-rose-400 mt-0.5 shrink-0"
                  strokeWidth={1.75}
                />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Standout */}
      {r.standout && (
        <div className="mt-5 p-4 rounded-2xl bg-white/80 border border-lavender-200 flex items-start gap-2.5 relative z-10">
          <Sparkles
            size={16}
            className="text-lavender-500 mt-0.5 shrink-0"
            strokeWidth={1.75}
          />
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-lavender-600 mb-0.5">
              Standout
            </p>
            <p className="text-sm text-warm-700 leading-relaxed">{r.standout}</p>
          </div>
        </div>
      )}
    </div>
  );
}
