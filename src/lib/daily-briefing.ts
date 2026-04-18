// ──────────────────────────────────────────────────────────────────────────
// iyla — Smart Daily Briefing
// ──────────────────────────────────────────────────────────────────────────
// The "one thing that matters today" card.
//
// Consumes the full intelligence snapshot + today's reading + personalized
// baselines and returns the single most important action for today, plus
// a short list of secondary items. The goal is to make iyla *proactive*
// instead of just descriptive — telling her what to do, not what happened.
//
// Priority stack (highest wins):
//   1. Concordance flags → retest / wait / verify
//   2. Window opening soon → hydration prep
//   3. Peak fertility today → prioritize intimacy
//   4. Post-ov confirmed → TWW guidance
//   5. Short luteal / lab alert → supplement focus
//   6. Default → gentle daily encouragement
// ──────────────────────────────────────────────────────────────────────────

import type { DailyReading, Cycle } from './types';
import type { IntelligenceSnapshot } from './intelligence';
import type { PersonalBaselines } from './baselines';

export type BriefingPriority =
  | 'concordance_alert'
  | 'hydration_prep'
  | 'peak_fertility'
  | 'surge_imminent'
  | 'fertile_window_open'
  | 'ovulation_confirmed'
  | 'tww_support'
  | 'short_luteal_watch'
  | 'lab_focus'
  | 'early_follicular'
  | 'menstrual_care'
  | 'default';

export interface BriefingAction {
  label: string;              // short CTA e.g. "Log today's data"
  target?: string;            // route path, optional
  kind: 'primary' | 'secondary';
}

export interface DailyBriefing {
  priority: BriefingPriority;
  /** 3–8 word hero headline */
  headline: string;
  /** 1–2 sentence body, warm and specific to her data */
  body: string;
  /** 1–3 actions */
  actions: BriefingAction[];
  /** Relevant emoji for the hero card */
  emoji: string;
  /** A short "iyla saw this in your data" citation */
  citation: string;
  /** Secondary bullets, up to 3 extras */
  secondary: string[];
  /** The underlying tailwind gradient classes for the hero */
  gradient: string;
  generatedAt: string;
}

export interface BriefingInput {
  today: string;                        // ISO yyyy-MM-dd
  intelligence: IntelligenceSnapshot | null;
  baselines: PersonalBaselines | null;
  currentCycle: Cycle | null;
  todayReading: DailyReading | null;
  yesterdayReading: DailyReading | null;
  cycleDay: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function hour(): number {
  return new Date().getHours();
}

function daysUntil(iso: string | null | undefined, today: string): number | null {
  if (!iso) return null;
  const a = new Date(iso + 'T00:00:00').getTime();
  const b = new Date(today + 'T00:00:00').getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

function isEveningHours(): boolean {
  const h = hour();
  return h >= 18 && h < 23;
}

// ── Builder ────────────────────────────────────────────────────────────

export function buildDailyBriefing(input: BriefingInput): DailyBriefing {
  const now = new Date().toISOString();
  const { intelligence, baselines, todayReading, cycleDay, today } = input;

  // ---------- 1. Concordance critical flag (outranks everything) ----------
  const concordance = intelligence?.concordance;
  if (concordance && concordance.flags.length > 0 && concordance.confidence === 'low') {
    const flag = concordance.flags.find(f =>
      f.kind === 'dilute_sample' || f.kind === 'impossible_lh_drop' || f.kind === 'single_signal_contradiction',
    );
    if (flag) {
      return {
        priority: 'concordance_alert',
        headline: 'One reading looks off — don\'t trust it alone',
        body: `${flag.explanation} ${flag.suggestion}`,
        actions: [
          { label: 'Retest this afternoon', kind: 'primary' },
          { label: 'See full concordance', kind: 'secondary' },
        ],
        emoji: 'shield',
        citation: `Concordance ${concordance.concordanceScore}/100 · ${concordance.flags.length} flag${concordance.flags.length > 1 ? 's' : ''} active`,
        secondary: concordance.flags.slice(0, 2).map(f => f.explanation),
        gradient: 'from-amber-400 via-orange-400 to-rose-400',
        generatedAt: now,
      };
    }
  }

  // ---------- 2. Peak fertility today (priority for TTC) ----------
  const predictions = intelligence?.predictions;
  const todayOvulation = predictions?.nextOvulation?.date === today;
  const bestDay = predictions?.bestConceptionDays?.[0];
  const inFertileWindow =
    predictions?.fertilePhaseStart &&
    predictions?.fertilePhaseEnd &&
    today >= predictions.fertilePhaseStart &&
    today <= predictions.fertilePhaseEnd;

  if (todayOvulation || (bestDay && bestDay.date === today && bestDay.relativeOdds >= 0.8)) {
    const odds = predictions?.conceptionOddsThisCycle;
    return {
      priority: 'peak_fertility',
      headline: 'Today is your best day this cycle',
      body: odds != null
        ? `Your signals line up for peak fertility. Conception odds this cycle: ${Math.round(odds * 100)}%. Prioritize intimacy today and tomorrow.`
        : 'Your signals line up for peak fertility. This is the day your body has been working toward. Be gentle with yourself — and prioritize intimacy.',
      actions: [
        { label: 'Log intimacy', kind: 'primary' },
        { label: 'Send your partner the signal', kind: 'secondary', target: '/partner' },
      ],
      emoji: 'sparkles',
      citation: bestDay
        ? `Best conception day · relative odds ${Math.round(bestDay.relativeOdds * 100)}%`
        : 'Next ovulation today',
      secondary: [
        'Stay hydrated but taper water after 7pm if you plan to test tomorrow morning.',
        'A gentle walk + 15min breathwork boosts blood flow without raising cortisol.',
      ],
      gradient: 'from-amber-400 via-orange-400 to-rose-400',
      generatedAt: now,
    };
  }

  // ---------- 3. Surge imminent (1-2 days out) ----------
  const daysToOv = daysUntil(predictions?.nextOvulation?.date ?? null, today);
  if (daysToOv !== null && daysToOv >= 1 && daysToOv <= 2 && !todayReading?.pdg) {
    const surgeNote = baselines?.lhSurge.typicalPeakValue
      ? `Your LH typically peaks around ${baselines.lhSurge.typicalPeakValue.toFixed(1)} mIU/mL — watch for readings climbing toward that.`
      : 'Watch for LH climbing — surge likely in the next 24 hours.';
    return {
      priority: 'surge_imminent',
      headline: `Ovulation ${daysToOv === 1 ? 'tomorrow' : `in ${daysToOv} days`}`,
      body: `${surgeNote} ${isEveningHours() ? 'Taper water intake now for accurate morning testing.' : 'Log your Inito this morning if you haven\'t already.'}`,
      actions: [
        { label: 'Log today\'s reading', kind: 'primary' },
        { label: 'See prediction details', kind: 'secondary' },
      ],
      emoji: 'zap',
      citation: predictions?.nextOvulation?.date
        ? `Predicted ovulation ${predictions.nextOvulation.date}`
        : 'Ovulation approaching',
      secondary: [
        'Prioritize 7-9 hours of sleep tonight — deep sleep correlates with LH surge strength.',
        'Dominick: intimacy every 1-2 days keeps sperm quality optimal.',
      ],
      gradient: 'from-emerald-400 via-teal-400 to-cyan-400',
      generatedAt: now,
    };
  }

  // ---------- 4. Fertile window open (but not peak) ----------
  if (inFertileWindow) {
    return {
      priority: 'fertile_window_open',
      headline: 'Your fertile window is open',
      body: 'Your body is working. Keep logging so iyla can narrow in on your peak day. Intimacy every 1-2 days through your window maximizes odds.',
      actions: [
        { label: 'Log today\'s reading', kind: 'primary' },
        { label: 'View best days', kind: 'secondary' },
      ],
      emoji: 'heart',
      citation: predictions?.fertilePhaseStart && predictions?.fertilePhaseEnd
        ? `Window: ${predictions.fertilePhaseStart} → ${predictions.fertilePhaseEnd}`
        : 'In fertile window',
      secondary: [
        'Taper water after 7pm if you\'re testing tomorrow.',
        baselines?.bbt.follicularBaseline
          ? `Your follicular BBT baseline is ${baselines.bbt.follicularBaseline.toFixed(2)}°F — watch for a ≥0.3°F shift.`
          : 'Watch your BBT for a 0.3°F+ shift — that\'s your confirmation.',
      ],
      gradient: 'from-emerald-400 via-teal-400 to-cyan-400',
      generatedAt: now,
    };
  }

  // ---------- 5. Ovulation confirmed → TWW ----------
  if (todayReading?.pdg && todayReading.pdg >= 5) {
    return {
      priority: 'ovulation_confirmed',
      headline: 'Ovulation confirmed — welcome to the TWW',
      body: 'PdG is up, the work is done for this cycle. Now: nourish, rest, breathe. Resist the urge to test too early — you\'ll get a cleaner answer in 10-12 days.',
      actions: [
        { label: 'Open TWW Companion', kind: 'primary', target: '/tww' },
        { label: 'Log progesterone support', kind: 'secondary' },
      ],
      emoji: 'moon',
      citation: `PdG ${todayReading.pdg} µg/mL — ovulation verified`,
      secondary: [
        'Magnesium glycinate and B6 at bedtime support luteal progesterone.',
        baselines?.lutealPhase.isShort
          ? `Your luteal phase averages ${baselines.lutealPhase.meanDays.toFixed(0)} days — short luteal. Prioritize progesterone-supporting supplements.`
          : 'A 9-10 minute breathwork session drops cortisol and supports implantation.',
      ],
      gradient: 'from-violet-400 via-purple-400 to-fuchsia-400',
      generatedAt: now,
    };
  }

  // ---------- 6. Short luteal watch (post-ov in a cycle with known short luteal) ----------
  const dpo = daysToOv !== null && daysToOv < 0 ? Math.abs(daysToOv) : null;
  if (dpo !== null && dpo >= 3 && baselines?.lutealPhase.isShort) {
    return {
      priority: 'short_luteal_watch',
      headline: `Day ${dpo} past ovulation · luteal watch`,
      body: `Your luteal phase averages ${baselines.lutealPhase.meanDays.toFixed(1)} days. Prioritize progesterone support and stress reduction through this window.`,
      actions: [
        { label: 'Log PdG reading', kind: 'primary' },
        { label: 'Open TWW Companion', kind: 'secondary', target: '/tww' },
      ],
      emoji: 'shield',
      citation: `Luteal phase avg ${baselines.lutealPhase.meanDays.toFixed(1)} days (short)`,
      secondary: [
        'B6 (100mg) and magnesium glycinate at bedtime — both support luteal progesterone.',
        'Seed cycling: pumpkin/sesame seeds in the luteal half of your cycle.',
      ],
      gradient: 'from-violet-400 via-purple-400 to-fuchsia-400',
      generatedAt: now,
    };
  }

  // ---------- 7. Menstrual care ----------
  if (cycleDay !== null && cycleDay <= 4) {
    return {
      priority: 'menstrual_care',
      headline: `Cycle Day ${cycleDay} — rest & replenish`,
      body: 'Your body is resetting. Iron-rich foods, warmth, and gentle movement today. No pressure to track every signal — just breathe through this.',
      actions: [
        { label: 'Light breathwork session', kind: 'primary', target: '/breathwork' },
        { label: 'Log flow level', kind: 'secondary' },
      ],
      emoji: 'flower',
      citation: `CD${cycleDay}`,
      secondary: [
        'Liver support (cruciferous veggies) helps estrogen clearance this week.',
        baselines?.cycleLength.mean
          ? `Your cycles average ${baselines.cycleLength.mean.toFixed(1)} days — next window opens ~CD${Math.round((baselines.ovulation.typicalCycleDay ?? 14) - 5)}.`
          : 'Log consistently this cycle to unlock personalized baselines.',
      ],
      gradient: 'from-rose-400 via-pink-400 to-fuchsia-300',
      generatedAt: now,
    };
  }

  // ---------- 8. Lab focus (alert-level pattern) ----------
  const alertPattern = intelligence?.patterns.find(p => p.severity === 'alert');
  if (alertPattern) {
    return {
      priority: 'lab_focus',
      headline: alertPattern.title,
      body: alertPattern.description,
      actions: [
        { label: alertPattern.actionable ? 'Take action' : 'Review', kind: 'primary' },
        { label: 'See all patterns', kind: 'secondary' },
      ],
      emoji: 'alert',
      citation: `Pattern detected · ${alertPattern.category}`,
      secondary: alertPattern.actionable ? [alertPattern.actionable] : [],
      gradient: 'from-amber-400 via-orange-400 to-rose-400',
      generatedAt: now,
    };
  }

  // ---------- 9. Early follicular ----------
  if (cycleDay !== null && cycleDay >= 5 && cycleDay <= 8) {
    return {
      priority: 'early_follicular',
      headline: `CD${cycleDay} — building toward the window`,
      body: baselines?.ovulation.typicalCycleDay
        ? `Your fertile window typically opens around CD${Math.max(1, baselines.ovulation.typicalCycleDay - 5)}. A few quiet days to optimize sleep, supplements, and stress before the prep phase.`
        : 'Your body is rebuilding the follicle this week. Now\'s the time to be consistent with supplements and sleep — it all feeds the follicle.',
      actions: [
        { label: 'Log today\'s reading', kind: 'primary' },
        { label: 'Check supplements', kind: 'secondary' },
      ],
      emoji: 'sprout',
      citation: `CD${cycleDay} · follicular phase`,
      secondary: [
        'Protein at breakfast (≥25g) stabilizes cortisol through the day.',
        'CoQ10 and NAC build egg quality — prioritize them this phase.',
      ],
      gradient: 'from-teal-400 via-emerald-400 to-green-400',
      generatedAt: now,
    };
  }

  // ---------- 10. Default encouragement ----------
  return {
    priority: 'default',
    headline: 'Your body is doing quiet work today',
    body: 'Log what you can, breathe when you remember, and trust the process. Consistency beats perfection.',
    actions: [
      { label: 'Log today\'s reading', kind: 'primary' },
    ],
    emoji: 'heart',
    citation: cycleDay !== null ? `CD${cycleDay}` : 'Today',
    secondary: [
      'A 9-minute breathwork session drops cortisol for ~2 hours.',
      'Water + magnesium + protein at every meal — the unglamorous triad.',
    ],
    gradient: 'from-warm-400 via-warm-500 to-warm-600',
    generatedAt: now,
  };
}
