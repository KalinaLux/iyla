// ──────────────────────────────────────────────────────────────────────────
// iyla — Achievements engine
// ──────────────────────────────────────────────────────────────────────────
// Deterministic milestone detection over the user's existing data.
// No new DB tables — we compute what's been earned and persist only the
// "claimed" timestamps (when the user dismissed/celebrated the toast) so
// we don't re-celebrate them again.
//
// Categories:
//   • consistency  — logging streaks, cycle tracking diligence
//   • body         — healthy luteal length, clear ovulation, BBT shift
//   • partner      — intercourse coverage in window, pairing, dad score
//   • wellness     — breathwork streaks, journal streaks, reconnect sessions
//   • knowledge    — baselines earned, cycles retrospected
// ──────────────────────────────────────────────────────────────────────────

import type { Cycle, DailyReading } from './types';
import type { PersonalBaselines } from './baselines';
import type { DadScore } from './dad-score';

// ── Public types ────────────────────────────────────────────────────────

export type AchievementCategory =
  | 'consistency'
  | 'body'
  | 'partner'
  | 'wellness'
  | 'knowledge';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface Achievement {
  id: string;                           // stable key
  title: string;                        // "Consistency, embodied"
  description: string;                  // why you earned it
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;                         // emoji
  earnedAt: string | null;              // ISO timestamp when achieved, null if not yet
  /** 0-1 progress toward earning */
  progress: number;
  progressLabel?: string;               // "12/14 days"
}

export interface AchievementsInput {
  cycles: Cycle[];
  readings: DailyReading[];
  baselines: PersonalBaselines | null;
  dadScore: DadScore | null;
  breathworkStreak?: number;            // from breathwork rewards
  journalStreak?: number;               // from journal
  reconnectSessionCount?: number;
  pairedSince?: string | null;          // pair code created date
}

// ── Storage ─────────────────────────────────────────────────────────────

const CLAIMED_KEY = 'iyla.achievements.claimed.v1';

interface ClaimedMap {
  [id: string]: string; // ISO timestamp
}

function loadClaimed(): ClaimedMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CLAIMED_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ClaimedMap;
  } catch {
    return {};
  }
}

function saveClaimed(m: ClaimedMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CLAIMED_KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}

/** Mark a set of IDs as celebrated so toast doesn't fire again. */
export function claimAchievements(ids: string[]): void {
  const m = loadClaimed();
  const now = new Date().toISOString();
  for (const id of ids) if (!m[id]) m[id] = now;
  saveClaimed(m);
}

export function hasClaimed(id: string): boolean {
  return !!loadClaimed()[id];
}

// ── Helper — consecutive reading streak ──────────────────────────────────

function longestReadingStreak(readings: DailyReading[]): number {
  if (readings.length === 0) return 0;
  const dates = Array.from(new Set(readings.map(r => r.date))).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00').getTime();
    const now = new Date(dates[i] + 'T00:00:00').getTime();
    const diff = Math.round((now - prev) / 86400000);
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}

function currentReadingStreak(readings: DailyReading[]): number {
  if (readings.length === 0) return 0;
  const dates = Array.from(new Set(readings.map(r => r.date))).sort().reverse();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let cursor = today.getTime();
  for (const d of dates) {
    const t = new Date(d + 'T00:00:00').getTime();
    if (t === cursor) {
      streak++;
      cursor -= 86400000;
    } else if (t < cursor) {
      break;
    }
  }
  return streak;
}

// ── Definition factory ───────────────────────────────────────────────────

function def(
  id: string,
  title: string,
  description: string,
  category: AchievementCategory,
  tier: AchievementTier,
  icon: string,
  progress: number,
  progressLabel?: string,
  earnedAt: string | null = null,
): Achievement {
  return { id, title, description, category, tier, icon, earnedAt, progress, progressLabel };
}

// ── Main engine ─────────────────────────────────────────────────────────

export function computeAchievements(input: AchievementsInput): Achievement[] {
  const out: Achievement[] = [];
  const now = new Date().toISOString();
  const claimed = loadClaimed();
  const earned = (id: string): string | null => claimed[id] ?? null;
  const mark = (id: string, unlocked: boolean): string | null =>
    unlocked ? (earned(id) ?? now) : null;

  const readings = input.readings;
  const cycles = input.cycles;
  const cycleCount = cycles.filter(c => c.outcome !== 'ongoing').length;

  // ── Consistency ──────────────────────────────────────────────────────
  const longest = longestReadingStreak(readings);
  const current = currentReadingStreak(readings);

  out.push(def(
    'consistency-7',
    'A steady week',
    'Logged 7 days in a row. You\'re building a real rhythm.',
    'consistency', 'bronze', '🌱',
    Math.min(1, longest / 7),
    `${longest}/7 days`,
    mark('consistency-7', longest >= 7),
  ));

  out.push(def(
    'consistency-30',
    'A full moon of data',
    'Logged 30 days in a row. iyla knows your rhythm now.',
    'consistency', 'silver', '🌙',
    Math.min(1, longest / 30),
    `${longest}/30 days`,
    mark('consistency-30', longest >= 30),
  ));

  out.push(def(
    'consistency-100',
    'A hundred days of presence',
    'One hundred consecutive days of tracking. This is devotion.',
    'consistency', 'gold', '💎',
    Math.min(1, longest / 100),
    `${longest}/100 days`,
    mark('consistency-100', longest >= 100),
  ));

  out.push(def(
    'consistency-current-14',
    'Two weeks strong',
    'You\'re on a 14-day streak right now.',
    'consistency', 'bronze', '🔥',
    Math.min(1, current / 14),
    `${current}/14 days (current)`,
    mark('consistency-current-14', current >= 14),
  ));

  out.push(def(
    'cycle-first',
    'Your first cycle',
    'Completed your first full cycle of tracking.',
    'consistency', 'bronze', '🌸',
    Math.min(1, cycleCount),
    `${cycleCount}/1 cycle`,
    mark('cycle-first', cycleCount >= 1),
  ));

  out.push(def(
    'cycle-three',
    'Three cycles of wisdom',
    'Three completed cycles — enough for iyla to learn your unique rhythm.',
    'consistency', 'silver', '🌺',
    Math.min(1, cycleCount / 3),
    `${cycleCount}/3 cycles`,
    mark('cycle-three', cycleCount >= 3),
  ));

  // ── Body signals ──────────────────────────────────────────────────────
  const bbtValues = readings.filter(r => r.bbt != null).length;
  const lhValues = readings.filter(r => r.lh != null).length;

  out.push(def(
    'bbt-30',
    'Thermal wisdom',
    '30 BBT readings logged. You\'re mastering the morning ritual.',
    'body', 'bronze', '🌡️',
    Math.min(1, bbtValues / 30),
    `${bbtValues}/30`,
    mark('bbt-30', bbtValues >= 30),
  ));

  out.push(def(
    'lh-20',
    'Surge literate',
    '20 LH readings logged. You can read your own hormone signals.',
    'body', 'bronze', '⚡',
    Math.min(1, lhValues / 20),
    `${lhValues}/20`,
    mark('lh-20', lhValues >= 20),
  ));

  // Healthy luteal phase (>= 11 days across at least 2 cycles)
  const lutealHealthy = input.baselines && input.baselines.lutealPhase.meanDays >= 11 && input.baselines.lutealPhase.confidence !== 'low';
  out.push(def(
    'luteal-healthy',
    'Strong luteal phase',
    `Your average luteal phase is ${input.baselines?.lutealPhase.meanDays.toFixed(0) ?? '—'} days — a healthy signal of progesterone support.`,
    'body', 'silver', '🌾',
    lutealHealthy ? 1 : 0,
    lutealHealthy ? 'Achieved' : 'Needs 2+ cycles with luteal ≥ 11 days',
    mark('luteal-healthy', !!lutealHealthy),
  ));

  // Clear ovulation signal (BBT shift >= 0.3°F)
  const clearOv = input.baselines && input.baselines.bbt.thermalShiftSize != null && input.baselines.bbt.thermalShiftSize >= 0.3;
  out.push(def(
    'bbt-shift-clear',
    'Clear thermal shift',
    `Your ovulation shows a ${input.baselines?.bbt.thermalShiftSize?.toFixed(2) ?? '—'}°F rise — a confident ovulation signal.`,
    'body', 'silver', '📈',
    clearOv ? 1 : 0,
    clearOv ? 'Achieved' : 'Needs a measured thermal shift',
    mark('bbt-shift-clear', !!clearOv),
  ));

  // ── Partner ───────────────────────────────────────────────────────────
  out.push(def(
    'partner-paired',
    'Partnered up',
    'Connected with your partner — you\'re in this together.',
    'partner', 'bronze', '💞',
    input.pairedSince ? 1 : 0,
    input.pairedSince ? 'Connected' : 'Not yet',
    mark('partner-paired', !!input.pairedSince),
  ));

  // Intercourse coverage in fertile window across at least one cycle
  const cycleCoverage = cycles.map(c => {
    const cr = readings.filter(r => r.cycleId === c.id);
    const inWindow = cr.filter(r => {
      const cd = r.cycleDay;
      return cd >= 10 && cd <= 17 && r.intercourse === true;
    });
    return inWindow.length;
  });
  const bestCoverage = cycleCoverage.length > 0 ? Math.max(...cycleCoverage) : 0;
  out.push(def(
    'window-covered',
    'Well-timed',
    `Intercourse logged on ${bestCoverage} fertile-window days in a single cycle — solid timing.`,
    'partner', 'silver', '💫',
    Math.min(1, bestCoverage / 3),
    `${bestCoverage}/3 days`,
    mark('window-covered', bestCoverage >= 3),
  ));

  const dadGrade = input.dadScore?.grade;
  out.push(def(
    'dad-b',
    'Partner pulling weight',
    'Dad Score is B or better — both of you are in this.',
    'partner', 'bronze', '🧬',
    dadGrade ? (['A', 'B'].includes(dadGrade) ? 1 : 0.4) : 0,
    dadGrade ? `Grade ${dadGrade}` : 'No data yet',
    mark('dad-b', !!dadGrade && ['A', 'B'].includes(dadGrade)),
  ));

  // ── Wellness ──────────────────────────────────────────────────────────
  const bw = input.breathworkStreak ?? 0;
  out.push(def(
    'breathwork-7',
    'Nervous system care',
    '7-day breathwork streak. Cortisol is listening.',
    'wellness', 'bronze', '🌬️',
    Math.min(1, bw / 7),
    `${bw}/7 days`,
    mark('breathwork-7', bw >= 7),
  ));

  out.push(def(
    'breathwork-30',
    'Breath as practice',
    '30 days of breathwork — this is a new baseline for you.',
    'wellness', 'silver', '🕯️',
    Math.min(1, bw / 30),
    `${bw}/30 days`,
    mark('breathwork-30', bw >= 30),
  ));

  const jr = input.journalStreak ?? 0;
  out.push(def(
    'journal-7',
    'Witnessed',
    '7 days of journaling. Your inner life has a voice.',
    'wellness', 'bronze', '📖',
    Math.min(1, jr / 7),
    `${jr}/7 days`,
    mark('journal-7', jr >= 7),
  ));

  const rc = input.reconnectSessionCount ?? 0;
  out.push(def(
    'reconnect-5',
    'Tenderness practiced',
    '5 Reconnect sessions. Intimacy as practice, not performance.',
    'wellness', 'silver', '🫂',
    Math.min(1, rc / 5),
    `${rc}/5 sessions`,
    mark('reconnect-5', rc >= 5),
  ));

  // ── Knowledge ─────────────────────────────────────────────────────────
  const baselineReady = input.baselines && input.baselines.sampleSize >= 2;
  out.push(def(
    'baselines-earned',
    'Personalized intelligence',
    'iyla has enough data to tune thresholds to YOUR body.',
    'knowledge', 'silver', '🧠',
    input.baselines ? Math.min(1, input.baselines.sampleSize / 2) : 0,
    `${input.baselines?.sampleSize ?? 0}/2 cycles`,
    mark('baselines-earned', !!baselineReady),
  ));

  out.push(def(
    'baselines-deep',
    'Deep pattern recognition',
    '4+ cycles tracked — iyla\'s predictions are now confident and personalized.',
    'knowledge', 'gold', '🪐',
    input.baselines ? Math.min(1, input.baselines.sampleSize / 4) : 0,
    `${input.baselines?.sampleSize ?? 0}/4 cycles`,
    mark('baselines-deep', !!input.baselines && input.baselines.sampleSize >= 4),
  ));

  return out;
}

/** Newly earned achievements that haven't been claimed yet (for toast / celebration). */
export function unclaimedEarned(achievements: Achievement[]): Achievement[] {
  const claimed = loadClaimed();
  return achievements.filter(a => a.earnedAt != null && !claimed[a.id]);
}

/** Quick stats for the Achievements UI header */
export function summarize(achievements: Achievement[]): {
  total: number;
  earned: number;
  byCategory: Record<AchievementCategory, { total: number; earned: number }>;
  nextUp: Achievement | null;
} {
  const byCat: Record<AchievementCategory, { total: number; earned: number }> = {
    consistency: { total: 0, earned: 0 },
    body: { total: 0, earned: 0 },
    partner: { total: 0, earned: 0 },
    wellness: { total: 0, earned: 0 },
    knowledge: { total: 0, earned: 0 },
  };

  let earned = 0;
  for (const a of achievements) {
    byCat[a.category].total++;
    if (a.earnedAt) {
      byCat[a.category].earned++;
      earned++;
    }
  }

  // Next up = highest-progress unearned achievement
  const unearned = achievements.filter(a => !a.earnedAt);
  unearned.sort((a, b) => b.progress - a.progress);
  const nextUp = unearned[0] ?? null;

  return { total: achievements.length, earned, byCategory: byCat, nextUp };
}
