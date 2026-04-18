import type { JournalEntry } from './journal-db';

/**
 * Full-text search across body, title, prompts, gratitude, tags, intention,
 * and emotional tone. Query tokens are whitespace-split; an entry must
 * contain every token somewhere to match (AND semantics).
 */
export function searchEntries(entries: JournalEntry[], query: string): JournalEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return entries;

  return entries.filter(entry => {
    const haystack = [
      entry.title ?? '',
      entry.body ?? '',
      entry.intention ?? '',
      entry.emotionalTone ?? '',
      entry.cyclePhase ?? '',
      ...(entry.tags ?? []),
      ...(entry.gratitude ?? []),
      ...(entry.prompts ?? []).flatMap(p => [p.prompt, p.response]),
    ]
      .join(' \u2022 ')
      .toLowerCase();
    return tokens.every(t => haystack.includes(t));
  });
}

/**
 * Groups entries into month buckets (newest first). Each bucket is internally
 * sorted newest first by `date` then `createdAt`.
 */
export function groupByMonth(
  entries: JournalEntry[],
): Array<{ label: string; entries: JournalEntry[] }> {
  const buckets = new Map<string, JournalEntry[]>();

  for (const e of entries) {
    const key = e.date.substring(0, 7); // yyyy-mm
    const arr = buckets.get(key);
    if (arr) arr.push(e);
    else buckets.set(key, [e]);
  }

  const keys = [...buckets.keys()].sort().reverse();

  return keys.map(key => {
    const list = (buckets.get(key) ?? []).slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    return { label: monthLabel(key), entries: list };
  });
}

function monthLabel(ym: string): string {
  const [yStr, mStr] = ym.split('-');
  const y = Number.parseInt(yStr ?? '', 10);
  const m = Number.parseInt(mStr ?? '', 10);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const d = new Date(y, m - 1, 1);
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  return `${month} ${y}`;
}

/**
 * Streak = number of consecutive days ending today (or yesterday) with at
 * least one entry. Missing today breaks today's credit but yesterday keeps
 * the streak alive.
 */
export function computeJournalStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;

  const uniqueDates = [...new Set(entries.map(e => e.date))].sort().reverse();
  if (uniqueDates.length === 0) return 0;

  const today = new Date().toISOString().substring(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);

  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1] + 'T00:00:00');
    const curr = new Date(uniqueDates[i] + 'T00:00:00');
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

/**
 * Average daily mood for the last N days (ending today). Days without an
 * entry or without a mood rating are returned as `null`.
 */
export function moodTrend(
  entries: JournalEntry[],
  days: number,
): Array<{ date: string; mood: number | null }> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    if (e.mood == null) continue;
    const bucket = sums.get(e.date) ?? { total: 0, count: 0 };
    bucket.total += e.mood;
    bucket.count += 1;
    sums.set(e.date, bucket);
  }

  const out: Array<{ date: string; mood: number | null }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().substring(0, 10);
    const bucket = sums.get(key);
    out.push({
      date: key,
      mood: bucket ? +(bucket.total / bucket.count).toFixed(2) : null,
    });
  }
  return out;
}
