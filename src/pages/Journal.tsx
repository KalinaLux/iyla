import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Flame, Sunrise, Moon, Feather, Search, Sparkles } from 'lucide-react';
import Modal from '../components/Modal';
import JournalEntryCard from '../components/journal/JournalEntryCard';
import JournalEntryEditor from '../components/journal/JournalEntryEditor';
import {
  journalDb,
  type EntryKind,
  type JournalEntry,
} from '../lib/journal-db';
import {
  computeJournalStreak,
  groupByMonth,
  moodTrend,
  searchEntries,
} from '../lib/journal-search';
import type { CyclePhaseKey } from '../lib/journal-prompts';
import { useCurrentCycle, useCycleReadings, useIntelligence, useCycles, useRecentReadings } from '../lib/hooks';
import { assessFertility } from '../lib/fertility-engine';
import type { FertilityStatus } from '../lib/types';

const PAGE_SIZE = 20;
const NO_ENTRIES: JournalEntry[] = [];

function toPhaseKey(v: string | undefined): CyclePhaseKey {
  if (v === 'menstrual' || v === 'follicular' || v === 'ovulatory' || v === 'luteal') return v;
  return 'unknown';
}

export default function Journal() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const entries = useLiveQuery(
    () => journalDb.entries.orderBy('date').reverse().toArray(),
    [],
  ) ?? NO_ENTRIES;

  // Detect today's cycle phase so the editor and prompt card are aware.
  const cycle = useCurrentCycle();
  const allCycles = useCycles();
  const readings = useCycleReadings(cycle?.id);
  const todayReading = readings.find(r => r.date === todayStr) ?? null;
  const recent = useRecentReadings(cycle?.id, todayStr, 7);
  const intelligence = useIntelligence();

  const { phaseKey, cycleDay } = useMemo(() => {
    if (!cycle) return { phaseKey: 'unknown' as CyclePhaseKey, cycleDay: undefined };
    const start = new Date(cycle.startDate + 'T00:00:00');
    const now = new Date(todayStr + 'T00:00:00');
    const cd = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (!todayReading) {
      // Fall back to CD-based heuristic: early = follicular, late = luteal.
      const fallback: CyclePhaseKey =
        cd <= 5 ? 'menstrual' : cd <= 13 ? 'follicular' : cd <= 16 ? 'ovulatory' : 'luteal';
      return { phaseKey: fallback, cycleDay: cd };
    }

    const completed = allCycles.filter(c => c.id !== cycle.id);
    const cycleHistory = completed.map(c => {
      const cr = readings.filter(r => r.cycleId === c.id && r.lh != null);
      if (cr.length === 0) return { peakLhDay: null, peakLhValue: null };
      let peak = cr[0];
      for (const r of cr) if ((r.lh ?? 0) > (peak.lh ?? 0)) peak = r;
      return { peakLhDay: peak.cycleDay, peakLhValue: peak.lh ?? null };
    });
    const prior = readings
      .filter(r => r.date < todayReading.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    const priorStatus: FertilityStatus | null = prior?.fertilityStatus ?? null;
    const assessment = assessFertility(todayReading, recent, cd, {
      yesterdayReading: prior,
      cycleHistory,
      priorStatus,
      baselines: intelligence?.baselines ?? null,
    });
    return { phaseKey: toPhaseKey(assessment.phase), cycleDay: cd };
  }, [cycle, todayStr, todayReading, readings, allCycles, recent, intelligence]);

  const [search, setSearch] = useState('');
  const filtered = useMemo(() => searchEntries(entries, search), [entries, search]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleEntries = filtered.slice(0, visibleCount);
  const groups = useMemo(() => groupByMonth(visibleEntries), [visibleEntries]);

  const streak = useMemo(() => computeJournalStreak(entries), [entries]);
  const trend = useMemo(() => moodTrend(entries, 14), [entries]);
  const todayEntries = entries.filter(e => e.date === todayStr);
  const hasMorning = todayEntries.some(e => e.kind === 'morning');
  const hasEvening = todayEntries.some(e => e.kind === 'evening');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKind, setEditorKind] = useState<EntryKind>('morning');
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  function openNew(kind: EntryKind) {
    setEditorKind(kind);
    setEditingEntry(null);
    setEditorOpen(true);
  }

  function openExisting(entry: JournalEntry) {
    setEditorKind(entry.kind);
    setEditingEntry(entry);
    setEditorOpen(true);
  }

  const totalMatched = filtered.length;
  const totalHidden = totalMatched - visibleEntries.length;

  return (
    <div className="space-y-7">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-honey-300 via-rose-200 to-lavender-200 p-7 text-warm-800">
        <div aria-hidden className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-warm-700/70" strokeWidth={1.8} />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-warm-700/70">
              Daily Journal · private to you
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Your quiet page</h1>
          <p className="text-warm-700/90 text-sm mt-2 max-w-md leading-relaxed">
            A soft place to set your intention, reflect on the day, and honor what
            your body is carrying. Never synced. Never shared. Just yours.
          </p>

          <div className="flex items-center gap-6 mt-5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-white/50 flex items-center justify-center">
                <Flame size={15} className="text-rose-500" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none">{streak}</p>
                <p className="text-[11px] text-warm-700/70 mt-0.5">day streak</p>
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold leading-none">{todayEntries.length}</p>
              <p className="text-[11px] text-warm-700/70 mt-0.5">today's entries</p>
            </div>
            <div>
              <p className="text-lg font-semibold leading-none">{entries.length}</p>
              <p className="text-[11px] text-warm-700/70 mt-0.5">total entries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's action row */}
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-3">
        {!hasMorning && (
          <button
            onClick={() => openNew('morning')}
            className="flex-1 flex items-center gap-3 px-6 py-5 rounded-3xl bg-gradient-to-br from-honey-100 to-honey-200/80 text-warm-800 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.99] text-left border border-honey-200/60"
          >
            <div className="w-11 h-11 rounded-2xl bg-white/80 flex items-center justify-center shrink-0">
              <Sunrise size={20} strokeWidth={1.6} className="text-honey-700" />
            </div>
            <div>
              <p className="text-base font-semibold">Set morning intention</p>
              <p className="text-xs text-warm-700/70 mt-0.5">
                Two gentle questions. Thirty seconds is enough.
              </p>
            </div>
          </button>
        )}
        {!hasEvening && (
          <button
            onClick={() => openNew('evening')}
            className="flex-1 flex items-center gap-3 px-6 py-5 rounded-3xl bg-gradient-to-br from-lavender-100 to-lavender-200/80 text-warm-800 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.99] text-left border border-lavender-200/60"
          >
            <div className="w-11 h-11 rounded-2xl bg-white/80 flex items-center justify-center shrink-0">
              <Moon size={20} strokeWidth={1.6} className="text-lavender-600" />
            </div>
            <div>
              <p className="text-base font-semibold">Evening reflection</p>
              <p className="text-xs text-warm-700/70 mt-0.5">
                Three questions and a breath of gratitude.
              </p>
            </div>
          </button>
        )}
        <button
          onClick={() => openNew('freeform')}
          className="sm:w-auto flex items-center justify-center gap-2 px-5 py-4 rounded-3xl bg-white border border-warm-100 text-warm-600 hover:text-warm-800 hover:bg-warm-50 transition-all active:scale-[0.99] text-sm font-medium"
        >
          <Feather size={15} strokeWidth={1.6} />
          Freeform entry
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={15}
          strokeWidth={1.8}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-300 pointer-events-none"
        />
        <input
          type="search"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="Search your entries…"
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-warm-100 text-sm text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-300 transition-colors"
        />
      </div>

      {/* Mood trend sparkline */}
      {entries.length > 0 && <MoodSparkline points={trend} />}

      {/* Entries list */}
      {entries.length === 0 ? (
        <EmptyState onStart={() => openNew('morning')} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm-100 p-8 text-center">
          <p className="text-sm text-warm-500">
            No entries match <span className="font-medium text-warm-700">"{search}"</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <section key={group.label}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-3 px-1">
                {group.label}
              </h2>
              <div className="space-y-3">
                {group.entries.map(entry => (
                  <JournalEntryCard
                    key={entry.id}
                    entry={entry}
                    onClick={() => openExisting(entry)}
                  />
                ))}
              </div>
            </section>
          ))}
          {totalHidden > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="px-5 py-2.5 rounded-2xl bg-white border border-warm-100 text-sm font-medium text-warm-600 hover:bg-warm-50 transition-colors"
              >
                Load more ({totalHidden} more)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Editor modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingEntry ? 'Edit entry' : 'New entry'}
        maxWidth="max-w-2xl"
      >
        <JournalEntryEditor
          key={editingEntry?.id ?? `new-${editorKind}`}
          existingEntry={editingEntry}
          defaultKind={editorKind}
          cyclePhase={phaseKey}
          cycleDay={cycleDay}
          onSave={() => setEditorOpen(false)}
          onCancel={() => setEditorOpen(false)}
        />
      </Modal>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="bg-gradient-to-br from-warm-50 to-honey-50/40 rounded-3xl border border-warm-100 p-10 text-center">
      <div className="w-14 h-14 rounded-3xl bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
        <Feather size={22} className="text-warm-600" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-semibold text-warm-800 mb-2">
        Your journal begins with one breath.
      </h2>
      <p className="text-sm text-warm-500 max-w-sm mx-auto leading-relaxed">
        When you're ready, tap <span className="font-medium text-warm-700">Set morning intention</span>{' '}
        above. No pressure, no streak to chase — just a page that waits kindly for you.
      </p>
      <button
        onClick={onStart}
        className="mt-6 px-5 py-2.5 rounded-2xl bg-warm-800 text-white text-sm font-medium hover:bg-warm-900 transition-colors"
      >
        Begin gently
      </button>
    </div>
  );
}

function MoodSparkline({ points }: { points: Array<{ date: string; mood: number | null }> }) {
  const hasData = points.some(p => p.mood != null);
  if (!hasData) return null;

  const width = 640;
  const height = 72;
  const padY = 8;
  const n = points.length;
  const xFor = (i: number) => (i / Math.max(n - 1, 1)) * width;
  const yFor = (v: number) => {
    const norm = (v - 1) / 9;
    return height - padY - norm * (height - padY * 2);
  };

  // Build a polyline; null values break the line.
  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  points.forEach((p, i) => {
    if (p.mood == null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push([xFor(i), yFor(p.mood)]);
    }
  });
  if (current.length > 0) segments.push(current);

  const last = [...points].reverse().find(p => p.mood != null);

  return (
    <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-warm-700">Mood, last 14 days</h3>
          <p className="text-[11px] text-warm-400 mt-0.5">
            A quiet curve, not a grade.
          </p>
        </div>
        {last && (
          <div className="text-right">
            <p className="text-lg font-semibold text-warm-700 tabular-nums">{last.mood}</p>
            <p className="text-[10px] uppercase tracking-wider text-warm-400">latest</p>
          </div>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-16"
        role="img"
        aria-label="Mood over the last 14 days"
      >
        <defs>
          <linearGradient id="journal-mood-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93bf96" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e2c88a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {segments.map((seg, si) => {
          if (seg.length === 0) return null;
          const line = seg.map(([x, y]) => `${x},${y}`).join(' ');
          const area = `M ${seg[0][0]},${height} L ${line.replace(/,/g, ',')} L ${seg[seg.length - 1][0]},${height} Z`;
          return (
            <g key={si}>
              <path d={area} fill="url(#journal-mood-grad)" />
              <polyline
                points={line}
                fill="none"
                stroke="#c99a3d"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {seg.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={1.8} fill="#c99a3d" />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
