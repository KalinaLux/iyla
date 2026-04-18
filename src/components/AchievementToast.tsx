import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Achievement } from '../lib/achievements';
import { claimAchievements } from '../lib/achievements';

interface Props {
  newlyEarned: Achievement[];
  onAllClaimed?: () => void;
}

/**
 * Floating celebration toast for newly-earned achievements.
 * Shows one at a time, auto-dismisses after 6s, or tap to dismiss.
 */
export default function AchievementToast({ newlyEarned, onAllClaimed }: Props) {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (newlyEarned.length > 0) {
      setQueue(q => {
        const seen = new Set(q.map(a => a.id));
        const next = newlyEarned.filter(a => !seen.has(a.id));
        return [...q, ...next];
      });
    }
  }, [newlyEarned]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    setEntered(false);
    const enter = setTimeout(() => setEntered(true), 50);
    const dismiss = setTimeout(() => handleDismiss(), 6000);
    return () => { clearTimeout(enter); clearTimeout(dismiss); };
     
  }, [current]);

  function handleDismiss() {
    if (!current) return;
    claimAchievements([current.id]);
    setEntered(false);
    setTimeout(() => {
      setCurrent(null);
      if (queue.length === 0 && onAllClaimed) onAllClaimed();
    }, 300);
  }

  if (!current) return null;

  return (
    <div
      className="fixed z-50 top-[calc(1rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 pointer-events-none"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto bg-white rounded-3xl shadow-2xl border border-amber-100 px-5 py-4 flex items-center gap-4 min-w-[280px] max-w-[420px] transition-all duration-300 ${
          entered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'
        }`}
      >
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 via-rose-300 to-lavender-300 flex items-center justify-center text-2xl shadow-inner ring-4 ring-amber-100 animate-pulse-slow">
            {current.icon}
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
            ✨
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">
            Milestone unlocked
          </div>
          <div className="text-sm font-semibold text-warm-800 leading-tight">{current.title}</div>
          <div className="text-xs text-warm-500 mt-1 line-clamp-2">{current.description}</div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-warm-400 hover:text-warm-700 p-1 rounded-full hover:bg-warm-50 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
