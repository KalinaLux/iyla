import type { EmotionalTone } from '../../lib/journal-db';

interface Props {
  value: EmotionalTone | undefined;
  onChange: (tone: EmotionalTone | undefined) => void;
}

interface ToneMeta {
  tone: EmotionalTone;
  emoji: string;
  label: string;
  /** Unselected pill classes */
  soft: string;
  /** Selected pill classes */
  active: string;
}

const TONES: ToneMeta[] = [
  {
    tone: 'radiant',
    emoji: '☀️',
    label: 'Radiant',
    soft: 'bg-honey-50 text-honey-700 border-honey-100',
    active: 'bg-honey-200 text-honey-700 border-honey-300 ring-2 ring-honey-200',
  },
  {
    tone: 'calm',
    emoji: '🌊',
    label: 'Calm',
    soft: 'bg-lavender-50 text-lavender-600 border-lavender-100',
    active: 'bg-lavender-200 text-lavender-600 border-lavender-300 ring-2 ring-lavender-200',
  },
  {
    tone: 'neutral',
    emoji: '🤍',
    label: 'Neutral',
    soft: 'bg-warm-100 text-warm-600 border-warm-200',
    active: 'bg-warm-200 text-warm-700 border-warm-300 ring-2 ring-warm-200',
  },
  {
    tone: 'heavy',
    emoji: '🌧',
    label: 'Heavy',
    soft: 'bg-slate-50 text-slate-600 border-slate-100',
    active: 'bg-slate-200 text-slate-700 border-slate-300 ring-2 ring-slate-200',
  },
  {
    tone: 'anxious',
    emoji: '⚡',
    label: 'Anxious',
    soft: 'bg-orange-50 text-orange-600 border-orange-100',
    active: 'bg-orange-200 text-orange-700 border-orange-300 ring-2 ring-orange-200',
  },
  {
    tone: 'grieving',
    emoji: '🕊',
    label: 'Grieving',
    soft: 'bg-rose-50 text-rose-500 border-rose-100',
    active: 'bg-rose-200 text-rose-500 border-rose-300 ring-2 ring-rose-200',
  },
];

export default function EmotionalToneSelector({ value, onChange }: Props) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-warm-700">
          How does the day feel?
        </h3>
        <p className="text-[11px] text-warm-400">Optional — pick what fits</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TONES.map(t => {
          const isActive = value === t.tone;
          return (
            <button
              key={t.tone}
              type="button"
              onClick={() => onChange(isActive ? undefined : t.tone)}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 active:scale-95 ${
                isActive ? t.active : `${t.soft} hover:brightness-[0.97]`
              }`}
            >
              <span className="text-base leading-none">{t.emoji}</span>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

