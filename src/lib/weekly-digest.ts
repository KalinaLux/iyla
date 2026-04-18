// ──────────────────────────────────────────────────────────────────────────
// iyla — Weekly Digest Engine
// ──────────────────────────────────────────────────────────────────────────
// Pure computation. Takes a week of data + pre-computed score / patterns /
// correlations / predictions and returns a rich, human-voice summary.
//
// NOTE ON INTERFACES: the sibling files (iyla-score.ts, pattern-detection.ts,
// correlation-engine.ts, predictions.ts) are being authored in parallel. Until
// they stabilise we re-declare the minimum shape we rely on here, so this
// module compiles standalone. Every field we read is optional so the real
// implementations can evolve without breaking us. When they land, we can
// swap these local definitions for real imports.
// ──────────────────────────────────────────────────────────────────────────

import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';

import type {
  Cycle,
  DailyReading,
  LabResult,
  SupplementLog,
} from './types';
import { LAB_DEFINITIONS } from './types';

// ── Local stand-ins for sibling modules ─────────────────────────────────

export interface IylaScoreLike {
  overall?: number;
  score?: number;
  grade?: string;
  domains?: Record<string, { score?: number; label?: string; delta?: number }>;
  breakdown?: Array<{ domain: string; score: number; weight?: number; delta?: number }>;
  partnerScore?: number;
}

export interface DetectedPatternLike {
  id?: string;
  severity?: 'alert' | 'watch' | 'positive' | 'info';
  title?: string;
  description?: string;
  actionable?: string | null;
  tags?: string[];
}

export interface CorrelationLike {
  variableA?: string;
  variableB?: string;
  r?: number;
  narrative?: string;
  n?: number;
  direction?: 'positive' | 'negative' | 'none';
}

export interface CyclePredictionsLike {
  phase?: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
  cycleDay?: number | null;
  nextPeriodDate?: string | null;
  nextOvulationDate?: string | null;
  fertileWindowStart?: string | null;
  fertileWindowEnd?: string | null;
  bestDayDate?: string | null;
  conceptionOddsPct?: number | null;
  daysUntilPeriod?: number | null;
  daysUntilOvulation?: number | null;
  daysPastOvulation?: number | null;
  inFertileWindow?: boolean;
}

// ── Public interface ────────────────────────────────────────────────────

export interface WeeklyDigest {
  weekOf: string;
  weekEnd: string;
  generatedAt: string;
  headline: string;
  subheadline: string;
  scoreSummary: {
    current: number;
    delta: number;
    grade: string;
  };
  cycleStatus: {
    cycleDay: number | null;
    phase: string;
    daysUntilPeriod: number | null;
    daysUntilOvulation: number | null;
  };
  thisWeekInNumbers: Array<{ label: string; value: string; sublabel?: string }>;
  celebrate: string[];
  watchOut: string[];
  topPattern: string | null;
  topCorrelation: string | null;
  prediction: string;
  encouragement: string;
  shareableSnippet: string;
}

export interface WeeklyDigestInput {
  cycles: Cycle[];
  readings: DailyReading[];
  labs: LabResult[];
  supplementLogs: SupplementLog[];
  score: IylaScoreLike | null;
  scorePreviousWeek: IylaScoreLike | null;
  patterns: DetectedPatternLike[];
  correlations: CorrelationLike[];
  predictions: CyclePredictionsLike;
  today: string;
}

// ── Utility helpers ─────────────────────────────────────────────────────

const ISO = 'yyyy-MM-dd';

function toDate(iso: string): Date {
  // date-fns parseISO handles the YYYY-MM-DD form correctly
  return parseISO(iso);
}

function isoDay(d: Date): string {
  return format(d, ISO);
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
}

function getOverall(score: IylaScoreLike | null): number {
  if (!score) return 0;
  if (typeof score.overall === 'number') return Math.round(score.overall);
  if (typeof score.score === 'number') return Math.round(score.score);
  return 0;
}

function getGrade(score: IylaScoreLike | null): string {
  if (score?.grade) return score.grade;
  return scoreToGrade(getOverall(score));
}

function topDomain(score: IylaScoreLike | null):
  | { domain: string; score: number; delta?: number }
  | null {
  if (!score) return null;
  const entries: Array<{ domain: string; score: number; delta?: number }> = [];
  if (score.breakdown) {
    for (const b of score.breakdown) {
      entries.push({ domain: b.domain, score: b.score, delta: b.delta });
    }
  } else if (score.domains) {
    for (const [k, v] of Object.entries(score.domains)) {
      entries.push({ domain: v.label ?? k, score: numberOr(v.score), delta: v.delta });
    }
  }
  if (entries.length === 0) return null;
  // Pick the highest-scoring domain as the "contributing" one
  entries.sort((a, b) => b.score - a.score);
  return entries[0];
}

function phaseLabel(phase: string | undefined | null): string {
  if (!phase) return 'unknown';
  return phase;
}

function humaniseDate(iso: string | null | undefined, today: string): string {
  if (!iso) return 'soon';
  const then = toDate(iso);
  const now = toDate(today);
  const diff = differenceInCalendarDays(then, now);
  const pretty = format(then, 'EEE MMM d');
  if (diff === 0) return `today (${pretty})`;
  if (diff === 1) return `tomorrow (${pretty})`;
  if (diff === -1) return `yesterday (${pretty})`;
  if (diff > 0 && diff <= 7) return `${pretty} (${diff} days)`;
  return pretty;
}

// deterministic hash for encouragement-line selection
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── "This week in numbers" ──────────────────────────────────────────────

interface WeekSlice {
  readings: DailyReading[];
  prevReadings: DailyReading[];
  supplementLogs: SupplementLog[];
  weekStart: string;
  weekEnd: string;
}

function sliceWeek(input: WeeklyDigestInput): WeekSlice {
  const today = toDate(input.today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);

  const wsISO = isoDay(weekStart);
  const weISO = isoDay(weekEnd);
  const psISO = isoDay(prevStart);
  const peISO = isoDay(prevEnd);

  const readings = input.readings.filter(r => inRange(r.date, wsISO, weISO));
  const prevReadings = input.readings.filter(r => inRange(r.date, psISO, peISO));
  const supplementLogs = input.supplementLogs.filter(l => inRange(l.date, wsISO, weISO));

  return { readings, prevReadings, supplementLogs, weekStart: wsISO, weekEnd: weISO };
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round(n: number | null, digits = 0): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const m = Math.pow(10, digits);
  return String(Math.round(n * m) / m);
}

function buildNumbers(
  input: WeeklyDigestInput,
  slice: WeekSlice,
): WeeklyDigest['thisWeekInNumbers'] {
  const out: WeeklyDigest['thisWeekInNumbers'] = [];
  const R = slice.readings;
  const P = slice.prevReadings;

  // Readings logged X / 7
  const uniqueDates = new Set(R.map(r => r.date));
  out.push({
    label: 'Readings logged',
    value: `${uniqueDates.size} / 7`,
  });

  // Avg sleep score
  const sleep = R.map(r => r.sleepScore).filter((x): x is number => typeof x === 'number');
  const prevSleep = P.map(r => r.sleepScore).filter((x): x is number => typeof x === 'number');
  if (sleep.length > 0) {
    const cur = avg(sleep)!;
    const prev = avg(prevSleep);
    const delta = prev !== null ? cur - prev : null;
    out.push({
      label: 'Avg sleep score',
      value: round(cur, 0),
      sublabel: delta !== null
        ? `${delta >= 0 ? '+' : ''}${round(delta, 1)} vs last week`
        : undefined,
    });
  }

  // Stress days
  const stressDays = R.filter(r =>
    r.mood === 'stressed' || r.mood === 'anxious' ||
    (r.symptoms ?? []).some(s => /stress|anxiety/i.test(s)),
  ).length;
  if (stressDays > 0) {
    out.push({ label: 'Stress days', value: `${stressDays}` });
  }

  // Intercourse
  const sex = R.filter(r => r.intercourse).length;
  out.push({
    label: 'Intercourse',
    value: sex === 0 ? '0 times' : sex === 1 ? '1 time' : `${sex} times`,
  });

  // Peak LH this cycle
  const currentCycle = getCurrentCycle(input);
  if (currentCycle?.id != null) {
    const cycleReadings = input.readings.filter(r => r.cycleId === currentCycle.id);
    const lhs = cycleReadings.map(r => r.lh).filter((x): x is number => typeof x === 'number');
    if (lhs.length > 0) {
      const peak = Math.max(...lhs);
      out.push({
        label: 'Peak LH this cycle',
        value: peak.toFixed(1),
        sublabel: peak >= 15 ? 'surge-level' : peak >= 5 ? 'rising' : 'baseline',
      });
    }
  }

  // BBT shift
  const bbtShift = assessBBTShift(R, P);
  out.push({ label: 'BBT shift', value: bbtShift });

  // Supplement adherence
  const sl = slice.supplementLogs;
  if (sl.length > 0) {
    const taken = sl.filter(l => l.taken).length;
    const pct = Math.round((taken / sl.length) * 100);
    out.push({ label: 'Supplement adherence', value: `${pct}%` });
  }

  return out;
}

function getCurrentCycle(input: WeeklyDigestInput): Cycle | null {
  const today = input.today;
  // most recent cycle whose startDate <= today AND (no endDate OR endDate >= today)
  const sorted = [...input.cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (let i = sorted.length - 1; i >= 0; i--) {
    const c = sorted[i];
    if (c.startDate <= today && (!c.endDate || c.endDate >= today)) {
      return c;
    }
  }
  return sorted[sorted.length - 1] ?? null;
}

function assessBBTShift(current: DailyReading[], prev: DailyReading[]): string {
  const curBbts = current.map(r => r.bbt).filter((x): x is number => typeof x === 'number');
  const prevBbts = prev.map(r => r.bbt).filter((x): x is number => typeof x === 'number');
  if (curBbts.length + prevBbts.length < 4) return 'N/A';
  const baseline = avg(prevBbts);
  const recent = avg(curBbts);
  if (baseline === null || recent === null) return 'N/A';
  if (recent - baseline >= 0.3) return 'seen';
  if (recent - baseline >= 0.15) return 'emerging';
  return 'not yet';
}

// ── Headline / subheadline ──────────────────────────────────────────────

function pickHeadline(
  delta: number,
  score: number,
  grade: string,
  predictions: CyclePredictionsLike,
  weekOf: string,
): string {
  // Fertile window overrides
  if (predictions.inFertileWindow) {
    const options = [
      `Fertile window is open — ${score} (${grade})`,
      `This is your week — fertile window is here (${grade})`,
      `Green light week — ${score} (${grade})`,
    ];
    return options[simpleHash(weekOf + 'fw') % options.length];
  }

  if (delta >= 5) {
    const options = [
      `Strong week — your score is up ${delta}`,
      `Momentum is building (${grade}-tier week)`,
      `Real progress this week — +${delta} points`,
    ];
    return options[simpleHash(weekOf + 'up') % options.length];
  }
  if (delta >= 0) {
    const options = [
      `Holding steady at ${score} (${grade})`,
      `Steady hand this week — ${score} (${grade})`,
      `Consistency week — ${grade} tier`,
    ];
    return options[simpleHash(weekOf + 'flat') % options.length];
  }
  if (delta >= -4) {
    const options = [
      `A slight dip this week — worth a moment of reflection`,
      `Gentle pullback — ${score} (${grade})`,
      `Small step back — let's read the signals`,
    ];
    return options[simpleHash(weekOf + 'dip') % options.length];
  }
  const options = [
    `Rough week — let's see what moved the needle`,
    `Hard week — your body is asking for something`,
    `Tougher week (${delta} pts) — we'll regroup`,
  ];
  return options[simpleHash(weekOf + 'down') % options.length];
}

function pickSubheadline(
  input: WeeklyDigestInput,
  slice: WeekSlice,
  score: IylaScoreLike | null,
): string {
  const td = topDomain(score);
  if (td) {
    if (typeof td.delta === 'number' && Math.abs(td.delta) >= 3) {
      const dir = td.delta > 0 ? 'lifting' : 'dragging';
      return `${humaniseDomain(td.domain)} is ${dir} the score (${td.score}).`;
    }
    return `${humaniseDomain(td.domain)} is your strongest contributing area (${td.score}).`;
  }

  // fall back to striking data point
  const sleep = slice.readings.map(r => r.sleepScore).filter((x): x is number => typeof x === 'number');
  if (sleep.length >= 4) {
    const m = avg(sleep)!;
    if (m >= 85) return `Sleep has been outstanding this week (avg ${Math.round(m)}).`;
    if (m < 65) return `Sleep quality has been low (avg ${Math.round(m)}) — it's shaping everything else.`;
  }

  const cycle = getCurrentCycle(input);
  if (cycle) {
    const cd = differenceInCalendarDays(toDate(input.today), toDate(cycle.startDate)) + 1;
    return `You're on cycle day ${cd} — body doing its quiet work.`;
  }
  return `Keep logging — every data point makes next week smarter.`;
}

function humaniseDomain(raw: string): string {
  const known: Record<string, string> = {
    sleep: 'Sleep',
    hormonal: 'Hormonal balance',
    stress: 'Stress regulation',
    nutrition: 'Nutrition',
    supplements: 'Supplement adherence',
    activity: 'Movement',
    cycle: 'Cycle regularity',
    mucus: 'Cervical mucus clarity',
    bbt: 'Temperature signals',
    lab: 'Lab markers',
    partner: 'Partner factors',
  };
  const key = raw.toLowerCase();
  return known[key] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Celebrate / watch out ───────────────────────────────────────────────

function buildCelebrate(
  input: WeeklyDigestInput,
  slice: WeekSlice,
  score: IylaScoreLike | null,
  scorePrev: IylaScoreLike | null,
  patterns: DetectedPatternLike[],
): string[] {
  const out: string[] = [];
  const R = slice.readings;

  // LH surge detected
  const lhPeak = Math.max(0, ...R.map(r => r.lh ?? 0));
  if (lhPeak >= 15) {
    out.push(`Strong LH surge this week — peaked at ${lhPeak.toFixed(1)} mIU/mL. Textbook signal.`);
  }

  // EWCM
  const ewcmDays = R.filter(r => r.cervicalMucus === 'egg_white').length;
  if (ewcmDays > 0) {
    out.push(`Egg-white cervical mucus observed on ${ewcmDays} day${ewcmDays > 1 ? 's' : ''} — peak fertile quality.`);
  }

  // Sleep improvement
  const sleepCur = avg(R.map(r => r.sleepScore).filter((x): x is number => typeof x === 'number'));
  const sleepPrev = avg(slice.prevReadings.map(r => r.sleepScore).filter((x): x is number => typeof x === 'number'));
  if (sleepCur !== null && sleepPrev !== null && sleepCur - sleepPrev >= 5) {
    out.push(`Sleep score climbed ${round(sleepCur - sleepPrev, 1)} points vs last week (now ${Math.round(sleepCur)}).`);
  }

  // Supplement adherence
  if (slice.supplementLogs.length > 0) {
    const taken = slice.supplementLogs.filter(l => l.taken).length;
    const pct = (taken / slice.supplementLogs.length) * 100;
    if (pct >= 80) {
      out.push(`Supplement adherence was ${Math.round(pct)}% — protocol locked in.`);
    }
  }

  // Lab in optimal range (recent)
  const recentLab = findRecentOptimalLab(input);
  if (recentLab) {
    out.push(`${recentLab.testName} landed in the optimal range (${recentLab.value} ${recentLab.unit}).`);
  }

  // Positive pattern
  const pos = patterns.find(p => p.severity === 'positive');
  if (pos && (pos.title || pos.description)) {
    out.push(`Pattern spotted: ${pos.title ?? pos.description}.`);
  }

  // Partner score improvement
  if (score?.partnerScore !== undefined && scorePrev?.partnerScore !== undefined) {
    const pDelta = score.partnerScore - scorePrev.partnerScore;
    if (pDelta >= 3) {
      out.push(`Partner score up ${round(pDelta, 0)} — team effort showing.`);
    }
  }

  return out.slice(0, 3);
}

function buildWatchOut(
  input: WeeklyDigestInput,
  slice: WeekSlice,
  patterns: DetectedPatternLike[],
  predictions: CyclePredictionsLike,
): string[] {
  const out: string[] = [];
  const R = slice.readings;

  // Alert-level patterns first
  const alerts = patterns.filter(p => p.severity === 'alert');
  for (const a of alerts.slice(0, 2)) {
    const text = a.title ? `${a.title}${a.actionable ? ` — ${a.actionable}` : ''}` : a.description;
    if (text) out.push(text);
  }

  // Stress cluster
  const stressDays = R.filter(r =>
    r.mood === 'stressed' || r.mood === 'anxious',
  ).length;
  if (stressDays >= 3) {
    out.push(`${stressDays} stressed/anxious days logged — consider a breathwork session or two this weekend.`);
  }

  // Poor sleep
  const sleep = R.map(r => r.sleepScore).filter((x): x is number => typeof x === 'number');
  const mSleep = avg(sleep);
  if (mSleep !== null && mSleep < 65 && sleep.length >= 4) {
    out.push(`Sleep averaged ${Math.round(mSleep)} — below your fertile-window zone. Protect wind-down time.`);
  }

  // Missed signals — no LH test in fertile window
  if (predictions.inFertileWindow) {
    const lhLogged = R.filter(r => typeof r.lh === 'number').length;
    if (lhLogged < 2) {
      out.push(`You're in the fertile window but only ${lhLogged} LH reading${lhLogged === 1 ? '' : 's'} logged this week — try to catch the surge.`);
    }
  }

  // Anovulatory indicators — current cycle has no PdG confirm & day >22
  const cycle = getCurrentCycle(input);
  if (cycle) {
    const cd = differenceInCalendarDays(toDate(input.today), toDate(cycle.startDate)) + 1;
    const cycleReadings = input.readings.filter(r => r.cycleId === cycle.id);
    const pdgConfirm = cycleReadings.some(r => (r.pdg ?? 0) >= 5);
    const bbtShift = cycleReadings.some(r => r.fertilityStatus === 'confirmed_ovulation');
    if (cd > 22 && !pdgConfirm && !bbtShift) {
      out.push(`CD${cd} and no ovulation confirmation yet — keep testing, or note for your RE.`);
    }
  }

  // Short luteal phase — use completed cycles
  const completed = input.cycles.filter(c => c.endDate && c.lutealPhaseDays);
  if (completed.length > 0) {
    const recentLuteal = completed[completed.length - 1].lutealPhaseDays!;
    if (recentLuteal < 10) {
      out.push(`Your most recent luteal phase was ${recentLuteal} days — short phases can affect implantation.`);
    }
  }

  // Watch-level patterns if we still have room
  if (out.length < 3) {
    const watchers = patterns.filter(p => p.severity === 'watch');
    for (const w of watchers) {
      if (out.length >= 3) break;
      const text = w.title ? `${w.title}${w.actionable ? ` — ${w.actionable}` : ''}` : w.description;
      if (text) out.push(text);
    }
  }

  return out.slice(0, 3);
}

function findRecentOptimalLab(input: WeeklyDigestInput): LabResult | null {
  // Use the most recent lab (any date) if it's in its optimal range
  const sorted = [...input.labs].sort((a, b) => b.date.localeCompare(a.date));
  for (const lab of sorted.slice(0, 8)) {
    const def = LAB_DEFINITIONS[lab.testName];
    const lo = lab.optimalRangeLow ?? def?.optimalLow;
    const hi = lab.optimalRangeHigh ?? def?.optimalHigh;
    if (lo !== undefined && hi !== undefined && lab.value >= lo && lab.value <= hi) {
      return lab;
    }
  }
  return null;
}

// ── Top pattern / correlation ───────────────────────────────────────────

function pickTopPattern(patterns: DetectedPatternLike[]): string | null {
  if (!patterns || patterns.length === 0) return null;
  const priority: Record<string, number> = { alert: 0, watch: 1, positive: 2, info: 3 };
  const sorted = [...patterns].sort((a, b) => {
    const pa = priority[a.severity ?? 'info'] ?? 99;
    const pb = priority[b.severity ?? 'info'] ?? 99;
    return pa - pb;
  });
  const top = sorted[0];
  const desc = top.description ?? top.title;
  if (!desc) return null;
  return top.actionable ? `${desc} ${top.actionable}` : desc;
}

function pickTopCorrelation(correlations: CorrelationLike[]): string | null {
  if (!correlations || correlations.length === 0) return null;
  const sorted = [...correlations].sort((a, b) => Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0));
  const top = sorted[0];
  if (top.narrative) return top.narrative;
  if (top.variableA && top.variableB && typeof top.r === 'number') {
    const strength = Math.abs(top.r) >= 0.7 ? 'strong' : Math.abs(top.r) >= 0.4 ? 'moderate' : 'subtle';
    const dir = top.r > 0 ? 'positive' : 'inverse';
    return `A ${strength} ${dir} link between ${top.variableA} and ${top.variableB} (r=${top.r.toFixed(2)}).`;
  }
  return null;
}

// ── Prediction narrative ────────────────────────────────────────────────

function buildPrediction(predictions: CyclePredictionsLike, today: string): string {
  const phase = predictions.phase;

  if (predictions.inFertileWindow) {
    const best = predictions.bestDayDate
      ? humaniseDate(predictions.bestDayDate, today)
      : 'in the next few days';
    const odds = typeof predictions.conceptionOddsPct === 'number'
      ? ` Odds this cycle sit around ${Math.round(predictions.conceptionOddsPct)}%.`
      : '';
    return `This is your fertile window — next few days matter most. Best day predicted: ${best}.${odds}`;
  }

  if (phase === 'luteal') {
    const dpo = predictions.daysPastOvulation;
    const period = predictions.nextPeriodDate
      ? humaniseDate(predictions.nextPeriodDate, today)
      : 'in ~1–2 weeks';
    if (typeof dpo === 'number') {
      return `You're ${dpo} days past ovulation. Period expected around ${period}.`;
    }
    return `You're in your luteal phase. Period expected around ${period}.`;
  }

  if (phase === 'menstrual') {
    const next = predictions.nextOvulationDate ?? predictions.fertileWindowStart;
    const pretty = next ? humaniseDate(next, today) : 'in the coming weeks';
    return `Recovery week — your next fertile window opens around ${pretty}.`;
  }

  // pre-fertile / follicular
  const windowStart = predictions.fertileWindowStart ?? predictions.nextOvulationDate;
  if (windowStart) {
    const diff = differenceInCalendarDays(toDate(windowStart), toDate(today));
    const pretty = humaniseDate(windowStart, today);
    const days = diff > 0 ? ` (${diff} day${diff === 1 ? '' : 's'} away)` : '';
    return `Fertile window opens around ${pretty}${days}. Time to hydrate, sleep, and prep your tests.`;
  }

  return `Keep logging daily — a clearer prediction will emerge as this cycle fills in.`;
}

// ── Encouragement ───────────────────────────────────────────────────────

const ENCOURAGEMENT_POOL: string[] = [
  'Your body has been doing beautiful, quiet work this week.',
  'Every cycle teaches me more about you.',
  'Tracking is an act of love — to yourself and your future child.',
  'Small signals, steady hands. You are doing the work.',
  'There is no perfect cycle — only the one you are attending to.',
  'Rest is a fertility intervention. So is the tenderness you give yourself.',
  'You are not behind. You are exactly where your body needs you.',
  'The data is kind. It is telling your story, not judging it.',
  'Your attention is the most underrated supplement in your stack.',
  'Softness is not the opposite of strength — it is a form of it.',
  'One cycle at a time, one signal at a time. That is how this is built.',
  'You are allowed to hope. You are allowed to rest. Both are real work.',
  'Your future child is not keeping score. Neither am I.',
  'What you logged this week mattered. Even the days that felt unremarkable.',
  'You showed up. Again. That is the whole thing.',
];

function pickEncouragement(weekOf: string, tone: 'up' | 'flat' | 'down'): string {
  // Filter pool lightly by tone
  let pool = ENCOURAGEMENT_POOL;
  if (tone === 'down') {
    pool = ENCOURAGEMENT_POOL.filter(s =>
      /rest|softness|kind|tender|exactly|allowed|one cycle|your future|showed up|quiet/i.test(s),
    );
  } else if (tone === 'up') {
    pool = ENCOURAGEMENT_POOL.filter(s =>
      /beautiful|steady|attention|data|every cycle|logged|one cycle|show/i.test(s),
    );
  }
  if (pool.length === 0) pool = ENCOURAGEMENT_POOL;
  return pool[simpleHash(weekOf + 'enc') % pool.length];
}

// ── Shareable snippet ───────────────────────────────────────────────────

function buildShareable(d: WeeklyDigest): string {
  const lines: string[] = [];
  lines.push(`iyla weekly digest — week of ${format(toDate(d.weekOf), 'MMM d, yyyy')}`);
  const deltaStr = d.scoreSummary.delta === 0
    ? 'flat'
    : d.scoreSummary.delta > 0
      ? `+${d.scoreSummary.delta}`
      : `${d.scoreSummary.delta}`;
  lines.push(`Score: ${d.scoreSummary.current} (${d.scoreSummary.grade}) — ${deltaStr}`);
  if (d.cycleStatus.cycleDay !== null) {
    lines.push(`Cycle day ${d.cycleStatus.cycleDay}, ${d.cycleStatus.phase}`);
  } else {
    lines.push(`Phase: ${d.cycleStatus.phase}`);
  }
  if (d.cycleStatus.daysUntilPeriod !== null && d.cycleStatus.daysUntilPeriod >= 0) {
    lines.push(`Next period: ~${d.cycleStatus.daysUntilPeriod} days`);
  }
  if (d.celebrate.length > 0) {
    lines.push('This week:');
    for (const c of d.celebrate.slice(0, 3)) lines.push(`• ${c}`);
  }
  return lines.join('\n');
}

// ── Cycle status helper ─────────────────────────────────────────────────

function buildCycleStatus(
  input: WeeklyDigestInput,
  predictions: CyclePredictionsLike,
): WeeklyDigest['cycleStatus'] {
  let cycleDay = predictions.cycleDay ?? null;
  if (cycleDay === null) {
    const cycle = getCurrentCycle(input);
    if (cycle) {
      cycleDay = differenceInCalendarDays(toDate(input.today), toDate(cycle.startDate)) + 1;
    }
  }

  const phase = predictions.phase ?? inferPhase(cycleDay);

  let daysUntilPeriod = predictions.daysUntilPeriod ?? null;
  if (daysUntilPeriod === null && predictions.nextPeriodDate) {
    daysUntilPeriod = differenceInCalendarDays(toDate(predictions.nextPeriodDate), toDate(input.today));
  }

  let daysUntilOvulation = predictions.daysUntilOvulation ?? null;
  if (daysUntilOvulation === null && predictions.nextOvulationDate) {
    daysUntilOvulation = differenceInCalendarDays(toDate(predictions.nextOvulationDate), toDate(input.today));
  }

  return {
    cycleDay,
    phase: phaseLabel(phase),
    daysUntilPeriod,
    daysUntilOvulation,
  };
}

function inferPhase(cycleDay: number | null): string {
  if (cycleDay === null) return 'unknown';
  if (cycleDay <= 5) return 'menstrual';
  if (cycleDay <= 11) return 'follicular';
  if (cycleDay <= 17) return 'ovulatory';
  return 'luteal';
}

// ── Main: buildWeeklyDigest ─────────────────────────────────────────────

export function buildWeeklyDigest(input: WeeklyDigestInput): WeeklyDigest {
  const today = toDate(input.today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekOf = isoDay(weekStart);
  const weekEndStr = isoDay(weekEnd);

  const slice = sliceWeek(input);

  const current = getOverall(input.score);
  const previous = getOverall(input.scorePreviousWeek);
  const delta = input.scorePreviousWeek ? current - previous : 0;
  const grade = getGrade(input.score);

  const headline = pickHeadline(delta, current, grade, input.predictions, weekOf);
  const subheadline = pickSubheadline(input, slice, input.score);
  const cycleStatus = buildCycleStatus(input, input.predictions);
  const thisWeekInNumbers = buildNumbers(input, slice);
  const celebrate = buildCelebrate(input, slice, input.score, input.scorePreviousWeek, input.patterns);
  const watchOut = buildWatchOut(input, slice, input.patterns, input.predictions);
  const topPattern = pickTopPattern(input.patterns);
  const topCorrelation = pickTopCorrelation(input.correlations);
  const prediction = buildPrediction(input.predictions, input.today);

  const tone: 'up' | 'flat' | 'down' = delta >= 3 ? 'up' : delta <= -3 ? 'down' : 'flat';
  const encouragement = pickEncouragement(weekOf, tone);

  const digest: WeeklyDigest = {
    weekOf,
    weekEnd: weekEndStr,
    generatedAt: new Date().toISOString(),
    headline,
    subheadline,
    scoreSummary: { current, delta, grade },
    cycleStatus,
    thisWeekInNumbers,
    celebrate,
    watchOut,
    topPattern,
    topCorrelation,
    prediction,
    encouragement,
    shareableSnippet: '', // filled next
  };

  digest.shareableSnippet = buildShareable(digest);
  return digest;
}

// ── One-liner describer (widget-friendly) ───────────────────────────────

export function describeWeekInOneLine(input: {
  score: IylaScoreLike | null;
  predictions: CyclePredictionsLike;
  cycleDay: number | null;
}): string {
  const score = getOverall(input.score);
  const grade = getGrade(input.score);
  const cd = input.cycleDay ?? input.predictions.cycleDay ?? null;
  const phase = input.predictions.phase ?? inferPhase(cd);

  if (input.predictions.inFertileWindow) {
    return `Fertile window is open · ${score} (${grade}) · CD${cd ?? '—'}`;
  }
  if (phase === 'luteal' && typeof input.predictions.daysUntilPeriod === 'number') {
    return `Luteal · ${score} (${grade}) · ~${input.predictions.daysUntilPeriod}d until period`;
  }
  if (phase === 'menstrual') {
    return `Menstrual recovery · ${score} (${grade}) · CD${cd ?? '—'}`;
  }
  if (typeof input.predictions.daysUntilOvulation === 'number' && input.predictions.daysUntilOvulation >= 0) {
    return `${phase} · ${score} (${grade}) · ovulation ~${input.predictions.daysUntilOvulation}d away`;
  }
  return `${phase} · ${score} (${grade})${cd !== null ? ` · CD${cd}` : ''}`;
}

// ── Persistence (localStorage) ──────────────────────────────────────────

const STORAGE_KEY = 'iyla-weekly-digests';
const MAX_DIGESTS = 26;

function readStorage(): WeeklyDigest[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d: unknown): d is WeeklyDigest =>
      !!d && typeof d === 'object' && typeof (d as WeeklyDigest).weekOf === 'string',
    );
  } catch {
    return [];
  }
}

function writeStorage(digests: WeeklyDigest[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(digests));
  } catch {
    // quota or serialization error — fail quiet
  }
}

export function saveWeeklyDigest(digest: WeeklyDigest): void {
  const current = readStorage();
  // dedupe by weekOf
  const filtered = current.filter(d => d.weekOf !== digest.weekOf);
  filtered.push(digest);
  // keep chronological by weekOf, newest last — then cap from the oldest side
  filtered.sort((a, b) => a.weekOf.localeCompare(b.weekOf));
  const capped = filtered.slice(-MAX_DIGESTS);
  writeStorage(capped);
}

export function getWeeklyDigests(): WeeklyDigest[] {
  const all = readStorage();
  return all.sort((a, b) => b.weekOf.localeCompare(a.weekOf));
}

export function getMostRecentDigest(): WeeklyDigest | null {
  const all = getWeeklyDigests();
  return all[0] ?? null;
}
