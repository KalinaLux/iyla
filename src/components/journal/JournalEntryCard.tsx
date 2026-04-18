import { format, formatDistanceToNow, isToday, isYesterday, differenceInDays } from 'date-fns';
import type { JournalEntry } from '../../lib/journal-db';
import { toneMeta } from './tone-meta';

interface Props {
  entry: JournalEntry;
  onClick: () => void;
}

const KIND_EMOJI: Record<JournalEntry['kind'], { emoji: string; label: string }> = {
  morning: { emoji: '🌅', label: 'Morning' },
  evening: { emoji: '🌙', label: 'Evening' },
  freeform: { emoji: '✍️', label: 'Freeform' },
};

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  const daysAgo = differenceInDays(new Date(), d);
  if (daysAgo < 7) return formatDistanceToNow(d, { addSuffix: true });
  return format(d, 'EEE, MMM d');
}

function snippet(entry: JournalEntry): string {
  if (entry.title?.trim()) return entry.title.trim();
  if (entry.body?.trim()) return entry.body.trim();
  if (entry.intention?.trim()) return `Intention: ${entry.intention.trim()}`;
  const firstResponse = entry.prompts?.find(p => p.response?.trim())?.response;
  if (firstResponse) return firstResponse.trim();
  if (entry.gratitude && entry.gratitude.length > 0) {
    return `Grateful for: ${entry.gratitude.filter(Boolean).join(' · ')}`;
  }
  return '(empty entry)';
}

export default function JournalEntryCard({ entry, onClick }: Props) {
  const kind = KIND_EMOJI[entry.kind];
  const tone = entry.emotionalTone ? toneMeta(entry.emotionalTone) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-3xl border border-warm-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-warm-400">
            {dateLabel(entry.date)}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warm-50 text-[11px] font-medium text-warm-600">
            <span className="text-sm leading-none">{kind.emoji}</span>
            {kind.label}
          </span>
          {tone && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tone.soft}`}
            >
              <span className="leading-none">{tone.emoji}</span>
              {tone.label}
            </span>
          )}
          {entry.cyclePhase && (
            <span className="px-2 py-0.5 rounded-full bg-warm-50 text-[11px] font-medium text-warm-500 capitalize">
              {entry.cyclePhase}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {entry.mood != null && <MiniStat label="Mood" value={entry.mood} />}
          {entry.stress != null && <MiniStat label="Stress" value={entry.stress} inverted />}
        </div>
      </div>

      <p className="text-sm text-warm-800 font-medium leading-snug line-clamp-2">
        {snippet(entry)}
      </p>

      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {entry.tags.slice(0, 6).map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-lavender-50 text-lavender-600 text-[10px] font-medium"
            >
              {tag}
            </span>
          ))}
          {entry.tags.length > 6 && (
            <span className="px-2 py-0.5 text-[10px] font-medium text-warm-400">
              +{entry.tags.length - 6}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function MiniStat({ label, value, inverted }: { label: string; value: number; inverted?: boolean }) {
  const pct = Math.max(0, Math.min(1, (value - 1) / 9));
  const goodHue = inverted ? 1 - pct : pct; // high mood = good, low stress = good
  const color =
    goodHue > 0.66 ? '#93bf96' : goodHue > 0.33 ? '#e2c88a' : '#d9a3aa';
  return (
    <div className="flex items-center gap-1.5" title={`${label} ${value}/10`}>
      <div className="w-10 h-1 rounded-full bg-warm-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${((value - 1) / 9) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] uppercase tracking-wider text-warm-400 font-semibold">
        {label[0]}
      </span>
    </div>
  );
}
