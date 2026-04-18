import type { EmotionalTone } from '../../lib/journal-db';

export interface ToneVisual {
  emoji: string;
  label: string;
  /** Soft pill classes (bg + text + border) for read-only display. */
  soft: string;
}

const TONE_VISUALS: Record<EmotionalTone, ToneVisual> = {
  radiant: { emoji: '☀️', label: 'Radiant', soft: 'bg-honey-50 text-honey-700 border-honey-100' },
  calm: { emoji: '🌊', label: 'Calm', soft: 'bg-lavender-50 text-lavender-600 border-lavender-100' },
  neutral: { emoji: '🤍', label: 'Neutral', soft: 'bg-warm-100 text-warm-600 border-warm-200' },
  heavy: { emoji: '🌧', label: 'Heavy', soft: 'bg-slate-50 text-slate-600 border-slate-100' },
  anxious: { emoji: '⚡', label: 'Anxious', soft: 'bg-orange-50 text-orange-600 border-orange-100' },
  grieving: { emoji: '🕊', label: 'Grieving', soft: 'bg-rose-50 text-rose-500 border-rose-100' },
};

export function toneMeta(tone: EmotionalTone): ToneVisual {
  return TONE_VISUALS[tone] ?? TONE_VISUALS.neutral;
}
