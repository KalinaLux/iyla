import { useState } from 'react';
import { Sparkles, Share2, Copy, Check, BookOpen } from 'lucide-react';
import type { WeeklyDigest } from '../../lib/intelligence';

interface Props {
  digest: WeeklyDigest;
}

const hasWebShare = typeof navigator !== 'undefined' && 'share' in navigator;

export default function WeeklyDigestCard({ digest }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const text = digest.shareableSnippet;
    if (hasWebShare) {
      try {
        await navigator.share({ text, title: 'My iyla weekly digest' });
        return;
      } catch { /* fallback below */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <div className="bg-gradient-to-br from-warm-800 via-warm-900 to-warm-800 text-white rounded-3xl p-7 shadow-lg overflow-hidden relative">
      {/* Ambient sparkles */}
      <div className="absolute top-4 right-4 opacity-20">
        <Sparkles size={48} strokeWidth={1} className="text-white" />
      </div>

      <div className="flex items-center gap-2 mb-2 relative z-10">
        <BookOpen size={12} className="text-white/60" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-white/60">Weekly Digest</span>
      </div>

      <h2 className="text-xl font-bold leading-tight relative z-10">{digest.headline}</h2>
      <p className="text-sm text-white/70 mt-1 relative z-10">{digest.subheadline}</p>

      {/* Score + Cycle */}
      <div className="mt-5 grid grid-cols-3 gap-3 relative z-10">
        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
          <p className="text-[10px] text-white/60 uppercase tracking-wider font-medium">Score</p>
          <p className="text-2xl font-bold tabular-nums leading-tight">{digest.scoreSummary.current}</p>
          <p className="text-[10px] text-white/60">
            {digest.scoreSummary.delta > 0 ? '+' : ''}{digest.scoreSummary.delta} vs last week
          </p>
        </div>
        {digest.cycleStatus.cycleDay !== null && (
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
            <p className="text-[10px] text-white/60 uppercase tracking-wider font-medium">Cycle</p>
            <p className="text-2xl font-bold tabular-nums leading-tight">CD{digest.cycleStatus.cycleDay}</p>
            <p className="text-[10px] text-white/60 capitalize">{digest.cycleStatus.phase}</p>
          </div>
        )}
        {digest.cycleStatus.daysUntilPeriod !== null && (
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
            <p className="text-[10px] text-white/60 uppercase tracking-wider font-medium">Next period</p>
            <p className="text-2xl font-bold tabular-nums leading-tight">
              {digest.cycleStatus.daysUntilPeriod > 0 ? digest.cycleStatus.daysUntilPeriod : '—'}
            </p>
            <p className="text-[10px] text-white/60">days away</p>
          </div>
        )}
      </div>

      {/* Celebrate + Watch */}
      {digest.celebrate.length > 0 && (
        <div className="mt-5 relative z-10">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-300/80 mb-2">Celebrate</p>
          <ul className="space-y-1.5">
            {digest.celebrate.map((c, i) => (
              <li key={i} className="text-sm text-white/90 flex items-start gap-2">
                <span className="text-emerald-300 mt-0.5">✓</span>
                <span className="leading-relaxed">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {digest.watchOut.length > 0 && (
        <div className="mt-4 relative z-10">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-300/80 mb-2">Watch</p>
          <ul className="space-y-1.5">
            {digest.watchOut.map((w, i) => (
              <li key={i} className="text-sm text-white/85 flex items-start gap-2">
                <span className="text-amber-300 mt-0.5">•</span>
                <span className="leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prediction */}
      <div className="mt-5 p-4 bg-white/10 rounded-2xl border border-white/10 relative z-10">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-white/60 mb-1">What's next</p>
        <p className="text-sm text-white/90 leading-relaxed">{digest.prediction}</p>
      </div>

      {/* Encouragement */}
      <p className="mt-5 text-sm text-white/80 italic leading-relaxed relative z-10">
        {digest.encouragement}
      </p>

      {/* Share */}
      <button
        onClick={handleShare}
        className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 bg-white/15 hover:bg-white/25 rounded-2xl text-xs font-semibold transition-all active:scale-[0.98] relative z-10"
      >
        {copied ? <Check size={13} /> : hasWebShare ? <Share2 size={13} /> : <Copy size={13} />}
        {copied ? 'Copied to clipboard' : hasWebShare ? 'Share with your provider' : 'Copy digest'}
      </button>
    </div>
  );
}
