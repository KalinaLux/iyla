import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { SemenAnalysis, MaleDailyLog } from './male-factor-db';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type DadDomainId =
  | 'lifestyle'
  | 'sleep'
  | 'semen_quality'
  | 'supplements'
  | 'consistency';

export type DadDomainStatus =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'needs_attention';

export interface DadScoreDomain {
  id: DadDomainId;
  label: string;
  score: number;                // 0-100
  weight: number;               // 0-1
  status: DadDomainStatus;
  contributingSignals: Array<{ label: string; score: number; note?: string }>;
  note?: string;
}

export interface DadScore {
  total: number;                // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  domains: DadScoreDomain[];
  delta7Day: number;
  delta30Day: number;
  topPositiveFactor: string | null;
  topNegativeFactor: string | null;
  dataCompleteness: number;     // 0-1
  computedAt: string;
  summary: string;
}

export interface DadScoreInput {
  semenAnalyses: SemenAnalysis[];
  dailyLogs: MaleDailyLog[];
  today: string;                // ISO
}

export interface DadScoreSnapshot {
  timestamp: string;
  total: number;
  domains: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: Record<DadDomainId, number> = {
  sleep: 0.25,
  lifestyle: 0.25,
  semen_quality: 0.25,
  supplements: 0.15,
  consistency: 0.1,
};

const DOMAIN_LABELS: Record<DadDomainId, string> = {
  sleep: 'Sleep',
  lifestyle: 'Lifestyle',
  semen_quality: 'Semen Quality',
  supplements: 'Supplements',
  consistency: 'Consistency',
};

const HISTORY_KEY = 'iyla_dad_score_history';
const HISTORY_CAP = 90;

// ─────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────

function clamp(value: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function parseDateSafe(iso: string | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function statusFromScore(score: number): DadDomainStatus {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  return 'needs_attention';
}

function gradeFromTotal(total: number): DadScore['grade'] {
  if (total >= 90) return 'A';
  if (total >= 80) return 'B';
  if (total >= 70) return 'C';
  if (total >= 60) return 'D';
  return 'F';
}

/**
 * Linear interpolation between three anchor points:
 * value at or above `high` → 100, at `mid` → 60, at or below `low` → 20.
 * If `inverted` is true, the scale flips (lower is better).
 */
function interpScore(
  value: number,
  low: number,
  mid: number,
  high: number,
  inverted = false,
): number {
  if (inverted) {
    if (value <= high) return 100;
    if (value <= mid) return 60 + ((mid - value) / (mid - high)) * 40;
    if (value <= low) return 20 + ((low - value) / (low - mid)) * 40;
    return 20;
  }
  if (value >= high) return 100;
  if (value >= mid) return 60 + ((value - mid) / (high - mid)) * 40;
  if (value >= low) return 20 + ((value - low) / (mid - low)) * 40;
  return 20;
}

function logsInLastDays(
  logs: MaleDailyLog[],
  today: Date,
  days: number,
): MaleDailyLog[] {
  const cutoff = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  return logs.filter((l) => {
    const d = parseDateSafe(l.date);
    return d != null && d >= cutoff && d <= today;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Sleep
// ─────────────────────────────────────────────────────────────────────────

function computeSleepDomain(
  logs: MaleDailyLog[],
  today: Date,
): DadScoreDomain {
  const recent = logsInLastDays(logs, today, 14);
  const hours = recent.map((l) => l.sleepHours).filter((v): v is number => v != null);
  const qualities = recent.map((l) => l.sleepQuality).filter((v): v is number => v != null);

  const signals: DadScoreDomain['contributingSignals'] = [];

  if (hours.length === 0) {
    return {
      id: 'sleep',
      label: DOMAIN_LABELS.sleep,
      weight: DEFAULT_WEIGHTS.sleep,
      score: 50,
      status: 'needs_attention',
      contributingSignals: [],
      note: 'Log sleep hours to score this domain',
    };
  }

  const avgHours = mean(hours);
  const avgQuality = qualities.length > 0 ? mean(qualities) : 4;

  const hoursFactor = clamp(((avgHours - 5) / 3) * 100, 0, 100) / 100;
  const qualityFactor = clamp(avgQuality / 5, 0, 1);
  const raw = 100 * hoursFactor * qualityFactor;
  const score = clamp(Math.round(raw));

  signals.push({
    label: 'Average sleep duration',
    score: clamp(Math.round(hoursFactor * 100)),
    note: `${avgHours.toFixed(1)} hrs/night across ${hours.length} night${hours.length === 1 ? '' : 's'}`,
  });
  if (qualities.length > 0) {
    signals.push({
      label: 'Perceived sleep quality',
      score: clamp(Math.round(qualityFactor * 100)),
      note: `${avgQuality.toFixed(1)}/5 average`,
    });
  }

  let note: string;
  if (avgHours >= 7 && avgHours <= 9) note = 'Sleep duration is in the optimal 7–9 hour window.';
  else if (avgHours >= 6) note = 'Sleep is a little short — aim for 7+ hours for hormone recovery.';
  else note = 'Sleep is running low — sperm production depends on deep rest.';

  return {
    id: 'sleep',
    label: DOMAIN_LABELS.sleep,
    weight: DEFAULT_WEIGHTS.sleep,
    score,
    status: statusFromScore(score),
    contributingSignals: signals,
    note,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Lifestyle
// ─────────────────────────────────────────────────────────────────────────

function computeLifestyleDomain(
  logs: MaleDailyLog[],
  today: Date,
): DadScoreDomain {
  const recent = logsInLastDays(logs, today, 14);
  const signals: DadScoreDomain['contributingSignals'] = [];

  if (recent.length === 0) {
    return {
      id: 'lifestyle',
      label: DOMAIN_LABELS.lifestyle,
      weight: DEFAULT_WEIGHTS.lifestyle,
      score: 50,
      status: 'needs_attention',
      contributingSignals: [],
      note: 'Log daily lifestyle data to score this domain',
    };
  }

  let score = 100;

  const heatDays = recent.filter(
    (l) => (l.heatExposureMinutes ?? 0) > 15,
  ).length;
  if (heatDays > 0) {
    const penalty = 3 * heatDays;
    score -= penalty;
    signals.push({
      label: 'Heat exposure',
      score: clamp(100 - penalty * 2),
      note: `${heatDays} day${heatDays === 1 ? '' : 's'} >15 min in last 14`,
    });
  } else {
    signals.push({
      label: 'Heat exposure',
      score: 100,
      note: 'No significant heat exposure logged',
    });
  }

  const alcoholValues = recent.map((l) => l.alcoholDrinks ?? 0);
  const avgAlcohol = mean(alcoholValues);
  if (avgAlcohol > 0) {
    // Penalty per drink/day averaged — cap to avoid runaway.
    const perDayPenalty = clamp(2 * avgAlcohol, 0, 20);
    score -= perDayPenalty;
    signals.push({
      label: 'Alcohol',
      score: clamp(100 - perDayPenalty * 3),
      note: `${avgAlcohol.toFixed(1)} drinks/day avg`,
    });
  } else {
    signals.push({
      label: 'Alcohol',
      score: 100,
      note: 'No alcohol logged',
    });
  }

  const exerciseMinutes = recent.reduce(
    (a, l) => a + (l.exerciseMinutes ?? 0),
    0,
  );
  // 14-day window → weekly rate
  const weeklyExercise = exerciseMinutes / 2;
  if (weeklyExercise < 150) {
    score -= 5;
    signals.push({
      label: 'Exercise volume',
      score: clamp(Math.round((weeklyExercise / 150) * 100)),
      note: `${Math.round(weeklyExercise)} min/week avg`,
    });
  } else {
    signals.push({
      label: 'Exercise volume',
      score: 100,
      note: `${Math.round(weeklyExercise)} min/week avg`,
    });
  }

  const goodIntensityDays = recent.filter(
    (l) => l.exerciseIntensity === 'moderate' || l.exerciseIntensity === 'intense',
  ).length;
  // Normalize to weekly: last 14 days → /2
  const weeklyIntenseDays = goodIntensityDays / 2;
  if (weeklyIntenseDays >= 3) {
    score += 5;
    signals.push({
      label: 'Exercise intensity',
      score: 100,
      note: `${goodIntensityDays} moderate/intense session${goodIntensityDays === 1 ? '' : 's'} in last 14`,
    });
  } else if (goodIntensityDays > 0) {
    signals.push({
      label: 'Exercise intensity',
      score: 70,
      note: `${goodIntensityDays} moderate/intense session${goodIntensityDays === 1 ? '' : 's'} in last 14`,
    });
  }

  score = clamp(Math.round(score));

  let note: string;
  if (score >= 85) note = 'Lifestyle fundamentals are dialed in.';
  else if (score >= 70) note = 'Lifestyle looks solid with minor tweaks available.';
  else if (score >= 55) note = 'Lifestyle has room to improve — focus on heat or alcohol.';
  else note = 'Lifestyle needs attention — heat exposure or alcohol are likely drags.';

  return {
    id: 'lifestyle',
    label: DOMAIN_LABELS.lifestyle,
    weight: DEFAULT_WEIGHTS.lifestyle,
    score,
    status: statusFromScore(score),
    contributingSignals: signals,
    note,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Semen Quality
// ─────────────────────────────────────────────────────────────────────────

interface ParamScore {
  label: string;
  score: number;
  note: string;
  rawValue: number;
  key: keyof SemenAnalysis;
}

function scoreSemenAnalysis(sa: SemenAnalysis): ParamScore[] {
  const out: ParamScore[] = [];

  if (sa.concentrationMillionsPerMl != null) {
    const v = sa.concentrationMillionsPerMl;
    out.push({
      key: 'concentrationMillionsPerMl',
      label: 'Concentration',
      score: interpScore(v, 5, 16, 40),
      note: `${v.toFixed(1)} M/mL (ref ≥16)`,
      rawValue: v,
    });
  }
  if (sa.totalMotilePct != null) {
    const v = sa.totalMotilePct;
    out.push({
      key: 'totalMotilePct',
      label: 'Total motility',
      score: interpScore(v, 20, 42, 50),
      note: `${v.toFixed(0)}% (ref ≥42%)`,
      rawValue: v,
    });
  }
  if (sa.morphologyPct != null) {
    const v = sa.morphologyPct;
    out.push({
      key: 'morphologyPct',
      label: 'Morphology',
      score: interpScore(v, 1, 4, 14),
      note: `${v.toFixed(1)}% (Kruger ≥4%)`,
      rawValue: v,
    });
  }
  if (sa.progressiveMotilityPct != null) {
    const v = sa.progressiveMotilityPct;
    out.push({
      key: 'progressiveMotilityPct',
      label: 'Progressive motility',
      score: interpScore(v, 10, 30, 40),
      note: `${v.toFixed(0)}% (ref ≥30%)`,
      rawValue: v,
    });
  }
  if (sa.dnaFragmentationPct != null) {
    const v = sa.dnaFragmentationPct;
    out.push({
      key: 'dnaFragmentationPct',
      label: 'DNA fragmentation',
      score: interpScore(v, 30, 25, 15, true),
      note: `${v.toFixed(0)}% (optimal <15%)`,
      rawValue: v,
    });
  }
  if (sa.volumeMl != null) {
    const v = sa.volumeMl;
    const inRange = v >= 1.5 && v <= 5.0;
    out.push({
      key: 'volumeMl',
      label: 'Volume',
      score: inRange ? 100 : 60,
      note: `${v.toFixed(1)} mL (ref 1.5–5.0)`,
      rawValue: v,
    });
  }
  if (sa.phAbove != null) {
    const v = sa.phAbove;
    const inRange = v >= 7.2;
    out.push({
      key: 'phAbove',
      label: 'pH',
      score: inRange ? 100 : 60,
      note: `${v.toFixed(1)} (ref ≥7.2)`,
      rawValue: v,
    });
  }
  if (sa.vitalityPct != null) {
    const v = sa.vitalityPct;
    const inRange = v >= 58;
    out.push({
      key: 'vitalityPct',
      label: 'Vitality',
      score: inRange ? 100 : 60,
      note: `${v.toFixed(0)}% (ref ≥58%)`,
      rawValue: v,
    });
  }

  return out;
}

function computeSemenDomain(
  analyses: SemenAnalysis[],
): { domain: DadScoreDomain; available: boolean } {
  if (analyses.length === 0) {
    return {
      available: false,
      domain: {
        id: 'semen_quality',
        label: DOMAIN_LABELS.semen_quality,
        weight: DEFAULT_WEIGHTS.semen_quality,
        score: 50,
        status: 'needs_attention',
        contributingSignals: [],
        note: 'No semen analysis yet — weight redistributed to other domains',
      },
    };
  }

  const sorted = [...analyses].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = sorted[0];
  const previous = sorted[1] ?? null;
  const params = scoreSemenAnalysis(latest);

  if (params.length === 0) {
    return {
      available: false,
      domain: {
        id: 'semen_quality',
        label: DOMAIN_LABELS.semen_quality,
        weight: DEFAULT_WEIGHTS.semen_quality,
        score: 50,
        status: 'needs_attention',
        contributingSignals: [],
        note: 'Semen analysis had no measurable parameters',
      },
    };
  }

  const score = clamp(Math.round(mean(params.map((p) => p.score))));

  let trendNote: string | undefined;
  if (previous) {
    const prevParams = scoreSemenAnalysis(previous);
    const prevByKey = new Map(prevParams.map((p) => [p.key, p.rawValue]));
    const deltas: number[] = [];
    for (const p of params) {
      const prev = prevByKey.get(p.key);
      if (prev != null && prev !== 0) {
        const inverted = p.key === 'dnaFragmentationPct';
        const rel = inverted
          ? (prev - p.rawValue) / prev
          : (p.rawValue - prev) / prev;
        deltas.push(rel);
      }
    }
    if (deltas.length > 0) {
      const avgDelta = mean(deltas);
      if (avgDelta >= 0.1) {
        trendNote = `Trending up vs prior analysis (${Math.round(avgDelta * 100)}% improvement)`;
      } else if (avgDelta <= -0.1) {
        trendNote = `Trending down vs prior analysis (${Math.round(avgDelta * 100)}%)`;
      } else {
        trendNote = 'Roughly stable vs prior analysis';
      }
    }
  }

  let note: string;
  if (score >= 85) note = 'Semen parameters look strong across the board.';
  else if (score >= 70) note = 'Most semen parameters are in a healthy range.';
  else if (score >= 55) note = 'Several parameters have room to improve.';
  else note = 'Multiple parameters below reference — worth discussing with a specialist.';
  if (trendNote) note = `${note} ${trendNote}.`;

  return {
    available: true,
    domain: {
      id: 'semen_quality',
      label: DOMAIN_LABELS.semen_quality,
      weight: DEFAULT_WEIGHTS.semen_quality,
      score,
      status: statusFromScore(score),
      contributingSignals: params.map((p) => ({
        label: p.label,
        score: Math.round(p.score),
        note: p.note,
      })),
      note,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Supplements
// ─────────────────────────────────────────────────────────────────────────

function computeSupplementsDomain(
  logs: MaleDailyLog[],
  today: Date,
): DadScoreDomain {
  const recent = logsInLastDays(logs, today, 30);
  const planned = recent.reduce((a, l) => a + (l.supplementsPlannedCount ?? 0), 0);
  const taken = recent.reduce((a, l) => a + (l.supplementsTakenCount ?? 0), 0);

  if (planned === 0) {
    return {
      id: 'supplements',
      label: DOMAIN_LABELS.supplements,
      weight: DEFAULT_WEIGHTS.supplements,
      score: 50,
      status: 'needs_attention',
      contributingSignals: [],
      note: 'No supplement plan logged yet',
    };
  }

  const adherence = Math.min(1, taken / planned);
  const score = clamp(Math.round(adherence * 100));

  let note: string;
  if (score >= 85) note = 'Excellent supplement adherence.';
  else if (score >= 70) note = 'Adherence is good — a few missed doses.';
  else if (score >= 55) note = 'Consistent doses would lift this score.';
  else note = 'Supplement adherence is low — set a daily reminder.';

  return {
    id: 'supplements',
    label: DOMAIN_LABELS.supplements,
    weight: DEFAULT_WEIGHTS.supplements,
    score,
    status: statusFromScore(score),
    contributingSignals: [
      {
        label: 'Adherence',
        score,
        note: `${taken} of ${planned} doses in last 30 days`,
      },
    ],
    note,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Domain: Consistency
// ─────────────────────────────────────────────────────────────────────────

function computeConsistencyDomain(
  logs: MaleDailyLog[],
  today: Date,
): DadScoreDomain {
  const recent = logsInLastDays(logs, today, 30);
  const uniqueDays = new Set(recent.map((l) => l.date)).size;
  const score = clamp(Math.round((uniqueDays / 30) * 100));

  let note: string;
  if (score >= 85) note = 'Tracking consistently — the data can tell a story.';
  else if (score >= 70) note = 'Mostly consistent tracking.';
  else if (score >= 55) note = 'Tracking a few days a week — more data = better insights.';
  else note = 'Not many logs yet — even a quick daily check-in helps.';

  return {
    id: 'consistency',
    label: DOMAIN_LABELS.consistency,
    weight: DEFAULT_WEIGHTS.consistency,
    score,
    status: statusFromScore(score),
    contributingSignals: [
      {
        label: 'Logged days',
        score,
        note: `${uniqueDays} of last 30 days`,
      },
    ],
    note,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Top factors
// ─────────────────────────────────────────────────────────────────────────

function findTopFactors(domains: DadScoreDomain[]): {
  pos: string | null;
  neg: string | null;
} {
  let bestPos: { domain: DadScoreDomain; signal: DadScoreDomain['contributingSignals'][number] } | null = null;
  let worstNeg: { domain: DadScoreDomain; signal: DadScoreDomain['contributingSignals'][number] } | null = null;

  for (const d of domains) {
    for (const s of d.contributingSignals) {
      if (s.score >= 80) {
        if (!bestPos || s.score > bestPos.signal.score) bestPos = { domain: d, signal: s };
      }
      if (s.score < 60) {
        if (!worstNeg || s.score < worstNeg.signal.score) worstNeg = { domain: d, signal: s };
      }
    }
  }

  const phrase = (
    entry: { domain: DadScoreDomain; signal: DadScoreDomain['contributingSignals'][number] },
  ) => `${entry.domain.label}: ${entry.signal.note ?? entry.signal.label}`;

  return {
    pos: bestPos ? phrase(bestPos) : null,
    neg: worstNeg ? phrase(worstNeg) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// History / deltas
// ─────────────────────────────────────────────────────────────────────────

export function getDadScoreHistory(): DadScoreSnapshot[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is DadScoreSnapshot =>
        s != null &&
        typeof s === 'object' &&
        typeof s.timestamp === 'string' &&
        typeof s.total === 'number' &&
        s.domains != null &&
        typeof s.domains === 'object',
    );
  } catch {
    return [];
  }
}

export function saveDadScoreSnapshot(score: DadScore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const existing = getDadScoreHistory();
    const domains: Record<string, number> = {};
    for (const d of score.domains) domains[d.id] = d.score;
    const next: DadScoreSnapshot = {
      timestamp: score.computedAt,
      total: score.total,
      domains,
    };
    existing.push(next);
    const trimmed = existing.slice(-HISTORY_CAP);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

function computeDelta(currentTotal: number, daysAgo: number): number {
  const history = getDadScoreHistory();
  if (history.length === 0) return 0;
  const target = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  let closest: DadScoreSnapshot | null = null;
  let closestDiff = Infinity;
  for (const snap of history) {
    const d = parseDateSafe(snap.timestamp);
    if (!d) continue;
    const diff = Math.abs(differenceInCalendarDays(d, target));
    if (diff <= 2 && diff < closestDiff) {
      closest = snap;
      closestDiff = diff;
    }
  }
  if (!closest) return 0;
  return currentTotal - closest.total;
}

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────

function buildSummary(domains: DadScoreDomain[]): string {
  const strong = domains.filter((d) => d.status === 'excellent' || d.status === 'good');
  const watch = domains.filter((d) => d.status === 'needs_attention' || d.status === 'fair');

  if (strong.length === 0 && watch.length === 0) {
    return 'Log a few days to get a personalized read.';
  }

  const strongLabels = strong
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((d) => d.label.toLowerCase());
  const watchLabels = watch
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((d) => d.label.toLowerCase());

  const strongPart = strongLabels.length > 0
    ? `${strongLabels.join(' and ')} strong`
    : null;
  const watchPart = watchLabels.length > 0
    ? `${watchLabels.join(' and ')} to watch`
    : null;

  if (strongPart && watchPart) return `${strongPart} — ${watchPart}.`;
  if (strongPart) return `${strongPart} across the board.`;
  if (watchPart) return `${watchPart}.`;
  return 'Keep tracking — trends take a few weeks to show.';
}

// ─────────────────────────────────────────────────────────────────────────
// Public: compute
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute the Dad Score across five weighted domains (sleep, lifestyle,
 * semen quality, supplements, consistency).
 *
 * If no semen analysis exists, the semen-quality weight (0.25) is
 * redistributed proportionally across the remaining four domains.
 */
export function computeDadScore(input: DadScoreInput): DadScore {
  const { semenAnalyses = [], dailyLogs = [], today } = input;
  const todayDate = parseDateSafe(today) ?? new Date();

  const sleep = computeSleepDomain(dailyLogs, todayDate);
  const lifestyle = computeLifestyleDomain(dailyLogs, todayDate);
  const semen = computeSemenDomain(semenAnalyses);
  const supplements = computeSupplementsDomain(dailyLogs, todayDate);
  const consistency = computeConsistencyDomain(dailyLogs, todayDate);

  let domains: DadScoreDomain[];
  if (semen.available) {
    domains = [sleep, lifestyle, semen.domain, supplements, consistency];
  } else {
    const others = [sleep, lifestyle, supplements, consistency];
    const otherTotalWeight = others.reduce((a, d) => a + d.weight, 0);
    const redistributed = others.map((d) => ({
      ...d,
      weight: d.weight + (d.weight / otherTotalWeight) * DEFAULT_WEIGHTS.semen_quality,
    }));
    domains = [redistributed[0], redistributed[1], semen.domain, redistributed[2], redistributed[3]];
  }

  const contributing = semen.available
    ? domains
    : domains.filter((d) => d.id !== 'semen_quality');

  const total = clamp(
    Math.round(contributing.reduce((sum, d) => sum + d.score * d.weight, 0)),
  );

  const { pos, neg } = findTopFactors(contributing);
  const delta7Day = Math.round(computeDelta(total, 7));
  const delta30Day = Math.round(computeDelta(total, 30));

  // Data completeness — 5 signals: sleep, lifestyle, semen, supplements, consistency.
  const has = {
    sleep: dailyLogs.some((l) => l.sleepHours != null) ? 1 : 0,
    lifestyle: dailyLogs.some(
      (l) =>
        l.exerciseMinutes != null ||
        l.heatExposureMinutes != null ||
        l.alcoholDrinks != null,
    ) ? 1 : 0,
    semen: semen.available ? 1 : 0,
    supplements: dailyLogs.some((l) => l.supplementsPlannedCount != null) ? 1 : 0,
    consistency: dailyLogs.length > 0 ? 1 : 0,
  };
  const dataCompleteness =
    (has.sleep + has.lifestyle + has.semen + has.supplements + has.consistency) / 5;

  return {
    total,
    grade: gradeFromTotal(total),
    domains,
    delta7Day,
    delta30Day,
    topPositiveFactor: pos,
    topNegativeFactor: neg,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    computedAt: new Date().toISOString(),
    summary: buildSummary(domains),
  };
}
