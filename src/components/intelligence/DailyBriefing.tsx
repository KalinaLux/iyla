import {
  Sparkles, Heart, Moon, Zap, Shield, AlertTriangle,
  Flower2, Sprout, ArrowRight,
} from 'lucide-react';
import type { DailyBriefing as Briefing, BriefingAction } from '../../lib/daily-briefing';

interface Props {
  briefing: Briefing;
  onAction?: (action: BriefingAction) => void;
}

const EMOJI_ICON: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  sparkles: Sparkles,
  heart: Heart,
  moon: Moon,
  zap: Zap,
  shield: Shield,
  alert: AlertTriangle,
  flower: Flower2,
  sprout: Sprout,
};

export default function DailyBriefing({ briefing, onAction }: Props) {
  const Icon = EMOJI_ICON[briefing.emoji] ?? Heart;

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${briefing.gradient} p-7 shadow-lg text-white`}>
      {/* Decorative soft orbs */}
      <div aria-hidden className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/20 blur-3xl" />
      <div aria-hidden className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10">
        {/* Label row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center">
              <Icon size={14} className="text-white" strokeWidth={2} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
              iyla · today
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/60 italic">
            {briefing.citation}
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-2xl font-bold tracking-tight leading-tight">
          {briefing.headline}
        </h2>

        {/* Body */}
        <p className="text-white/90 text-[15px] mt-2.5 leading-relaxed max-w-xl">
          {briefing.body}
        </p>

        {/* Actions */}
        {briefing.actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-5">
            {briefing.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => onAction?.(action)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-semibold transition-all active:scale-[0.97] ${
                  action.kind === 'primary'
                    ? 'bg-white text-warm-800 hover:bg-white/95 shadow-sm'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
              >
                {action.label}
                {action.kind === 'primary' && <ArrowRight size={12} strokeWidth={2.5} />}
              </button>
            ))}
          </div>
        )}

        {/* Secondary bullets */}
        {briefing.secondary.length > 0 && (
          <div className="mt-5 pt-5 border-t border-white/20 space-y-2">
            {briefing.secondary.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-white/80 leading-relaxed">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-white/60 shrink-0" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
