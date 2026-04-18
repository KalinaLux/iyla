import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import type { CyclePhase } from '../../lib/types';
import type {
  SymptomPattern,
  SymptomCategory,
} from '../../lib/symptom-patterns';

interface Props {
  patterns: SymptomPattern[];
  limit?: number;
}

const CATEGORY_EMOJI: Record<SymptomCategory, string> = {
  physical: '🌿',
  mood: '💭',
  energy: '⚡️',
  sleep: '🌙',
  digestion: '🌀',
  skin: '✨',
  libido: '💞',
  other: '•',
};

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
};

const PHASE_BADGE: Record<CyclePhase, string> = {
  menstrual: 'bg-rose-200 text-rose-700 border-rose-300',
  follicular: 'bg-honey-100 text-honey-700 border-honey-200',
  ovulatory: 'bg-coral-100 text-coral-500 border-coral-400',
  luteal: 'bg-lavender-100 text-lavender-600 border-lavender-200',
};

const SEVERITY_DOT: Record<SymptomPattern['severity'], string> = {
  significant: 'bg-lavender-500',
  notable: 'bg-lavender-300',
  informational: 'bg-warm-200',
};

function formatRange(range: { min: number; max: number }): string {
  if (range.min === range.max) return `CD ${range.min}`;
  return `CD ${range.min}–${range.max}`;
}

function PatternRow({ p }: { p: SymptomPattern }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-warm-100 bg-warm-50/60 overflow-hidden">
      <div className="p-3.5 flex items-start gap-3">
        <div className="text-lg mt-0.5 shrink-0" aria-hidden>
          {CATEGORY_EMOJI[p.category]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-warm-800 leading-tight">
              {p.symptom}
            </h4>
            <span
              className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border font-semibold ${PHASE_BADGE[p.dominantPhase]}`}
            >
              {PHASE_LABEL[p.dominantPhase]}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[p.severity]}`}
              aria-label={p.severity}
            />
          </div>

          <div className="mt-1 flex items-center gap-2.5 text-[11px] text-warm-500 font-medium tabular-nums">
            <span>{formatRange(p.cycleDayRange)}</span>
            <span className="text-warm-300">•</span>
            <span>
              Seen in {p.cyclesObserved} cycle{p.cyclesObserved === 1 ? '' : 's'}
            </span>
            <span className="text-warm-300">•</span>
            <span>
              {p.occurrences}× logged
            </span>
          </div>

          <p className="mt-1.5 text-[13px] text-warm-600 leading-relaxed">
            {p.narrative}
          </p>

          <button
            onClick={() => setOpen(v => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-lavender-600 hover:text-lavender-700"
          >
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {open ? 'Hide' : 'Why this happens'}
          </button>

          {open && (
            <p className="mt-2 p-3 rounded-xl bg-white border border-warm-100 text-[12px] text-warm-600 leading-relaxed">
              {p.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SymptomPatternsCard({ patterns, limit = 5 }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (patterns.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className="text-warm-500" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-warm-700">Your body's patterns</h3>
        </div>
        <p className="text-sm text-warm-400 leading-relaxed">
          Log symptoms over a few cycles to see your unique patterns emerge. iyla looks
          for what your body does reliably, not what it does once.
        </p>
      </div>
    );
  }

  const shown = showAll ? patterns : patterns.slice(0, limit);

  return (
    <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-warm-500" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-warm-700">Your body's patterns</h3>
        </div>
        <span className="text-[11px] text-warm-400 font-medium">
          {patterns.length} pattern{patterns.length === 1 ? '' : 's'}
        </span>
      </div>

      <p className="text-[12px] text-warm-500 leading-relaxed mb-1">
        Symptoms you've logged in at least two cycles. Phase tags show when they most
        reliably appear.
      </p>

      <div className="space-y-2">
        {shown.map(p => (
          <PatternRow key={p.symptom} p={p} />
        ))}
      </div>

      {patterns.length > limit && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full py-2 rounded-2xl bg-warm-50 hover:bg-warm-100 text-[12px] font-semibold text-warm-600 transition-colors"
        >
          {showAll
            ? 'Show fewer'
            : `Show all ${patterns.length} patterns`}
        </button>
      )}
    </div>
  );
}
