import type { DailyReading, FertilityStatus, CyclePhase } from './types';
import {
  assessConcordance,
  shouldHoldStatus,
  type ConcordanceResult,
} from './signal-concordance';
import type { PersonalBaselines } from './baselines';

interface FertilityAssessment {
  status: FertilityStatus;
  phase: CyclePhase;
  confidence: 'low' | 'medium' | 'high';
  signals: SignalReport[];
  recommendation: string;
  concordance: boolean;
  concordanceResult?: ConcordanceResult;
  /** True when the engine used personalized thresholds (vs generic ones) */
  personalized: boolean;
}

interface SignalReport {
  source: string;
  signal: string;
  direction: 'positive' | 'neutral' | 'negative';
}

export interface AssessFertilityOptions {
  /** Previous day's reading in the current cycle — used by the concordance engine */
  yesterdayReading?: DailyReading | null;
  /** Prior cycles' peak LH day/value — used for historical surge matching */
  cycleHistory?: Array<{ peakLhDay: number | null; peakLhValue: number | null }>;
  /** The status computed for the previous day — used to prevent unjustified regressions */
  priorStatus?: FertilityStatus | null;
  /** Personalized baselines — when present, tunes LH / PdG / BBT / ov-day thresholds to HER body */
  baselines?: PersonalBaselines | null;
}

export function assessFertility(
  todayReading: DailyReading,
  recentReadings: DailyReading[],
  cycleDay: number,
  options: AssessFertilityOptions = {},
): FertilityAssessment {
  const signals: SignalReport[] = [];
  let fertilityScore = 0;
  let signalCount = 0;
  let ovulationConfirmed = false;

  // ─── Personalized thresholds (from baselines, when available) ───
  const baselines = options.baselines ?? null;
  const personalized = !!baselines && baselines.sampleSize >= 2;

  // LH surge threshold — HER typical peak × 0.75 (vs generic 15)
  // Rising threshold — HER typical peak × 0.35 (vs generic 5)
  // Sharp drops here mean: some women peak at LH 6, so a 4 IS a surge for them.
  const lhSurgeThreshold = personalized && baselines!.lhSurge.typicalPeakValue != null
    ? Math.max(3, baselines!.lhSurge.typicalPeakValue * 0.75)
    : 15;
  const lhRisingThreshold = personalized && baselines!.adaptiveRules.lhSurgeThresholdSuggestion != null
    ? baselines!.adaptiveRules.lhSurgeThresholdSuggestion
    : 5;

  // PdG ovulation-confirm threshold — HER personalized value (default 5)
  const pdgConfirmThreshold = personalized && baselines!.hormones.pdgOvulationConfirmThreshold != null
    ? baselines!.hormones.pdgOvulationConfirmThreshold
    : 5;
  const pdgRisingThreshold = pdgConfirmThreshold * 0.6; // ~3 when confirm is 5

  // BBT shift threshold — scaled to HER typical shift size
  const bbtShiftThreshold = personalized && baselines!.bbt.thermalShiftSize != null
    ? Math.max(0.2, baselines!.bbt.thermalShiftSize * 0.7)
    : 0.3;
  const bbtMinorShiftThreshold = bbtShiftThreshold * 0.5;

  // BBT follicular max — HER typical follicular baseline + 2× stddev
  const bbtFollicularMax = personalized && baselines!.bbt.follicularBaseline != null
    ? baselines!.bbt.follicularBaseline + Math.max(0.15, baselines!.bbt.follicularStddev * 2)
    : 97.5;

  // Kegg drop-from-peak — scaled to HER typical drop size
  const keggBigDropThreshold = personalized && baselines!.kegg.typicalDropSize != null
    ? Math.max(20, baselines!.kegg.typicalDropSize * 0.7)
    : 40;
  const keggSmallDropThreshold = keggBigDropThreshold * 0.5;

  // Fertile window — from HER typical ovulation day (default CD10-17)
  const [fertileStart, fertileEnd]: [number, number] =
    personalized && baselines!.adaptiveRules.fertileWindowCdRange != null
      ? baselines!.adaptiveRules.fertileWindowCdRange
      : [10, 17];
  const peakCdStart = Math.max(fertileStart + 2, fertileStart);
  const peakCdEnd = Math.min(fertileEnd, fertileEnd);

  // ─── LH (Inito) ─────────────────────────────────────────
  if (todayReading.lh != null) {
    signalCount++;
    if (todayReading.lh >= lhSurgeThreshold) {
      fertilityScore += 3;
      signals.push({
        source: 'Inito',
        signal: personalized
          ? `LH surge detected (${todayReading.lh} mIU/mL, your typical peak ~${baselines!.lhSurge.typicalPeakValue!.toFixed(1)})`
          : `LH surge detected (${todayReading.lh} mIU/mL)`,
        direction: 'positive',
      });
    } else if (todayReading.lh >= lhRisingThreshold) {
      fertilityScore += 2;
      signals.push({ source: 'Inito', signal: `LH rising (${todayReading.lh} mIU/mL)`, direction: 'positive' });
    } else if (todayReading.lh >= 1) {
      fertilityScore += 0.5;
      signals.push({ source: 'Inito', signal: `LH low-rising (${todayReading.lh} mIU/mL)`, direction: 'neutral' });
    } else {
      signals.push({ source: 'Inito', signal: `LH baseline (${todayReading.lh} mIU/mL)`, direction: 'neutral' });
    }
  }

  // ─── E3G / Estrogen (Inito) ─────────────────────────────
  if (todayReading.e3g != null) {
    signalCount++;
    const prevE3g = recentReadings.filter(r => r.e3g != null).map(r => r.e3g!);
    const avgPrevE3g = prevE3g.length > 0 ? prevE3g.reduce((a, b) => a + b, 0) / prevE3g.length : 0;

    if (todayReading.e3g >= 100) {
      fertilityScore += 2;
      signals.push({ source: 'Inito', signal: `Estrogen elevated (${todayReading.e3g.toFixed(0)} pg/mL) — fertile range`, direction: 'positive' });
    } else if (todayReading.e3g > avgPrevE3g * 1.2 && avgPrevE3g > 0) {
      fertilityScore += 1.5;
      signals.push({ source: 'Inito', signal: `Estrogen rising (${todayReading.e3g.toFixed(0)} pg/mL)`, direction: 'positive' });
    } else if (todayReading.e3g > avgPrevE3g * 1.05 && avgPrevE3g > 0) {
      fertilityScore += 0.5;
      signals.push({ source: 'Inito', signal: `Estrogen gradually rising (${todayReading.e3g.toFixed(0)} pg/mL)`, direction: 'neutral' });
    } else {
      signals.push({ source: 'Inito', signal: `Estrogen stable (${todayReading.e3g?.toFixed(0) ?? '—'} pg/mL)`, direction: 'neutral' });
    }
  }

  // ─── PdG / Progesterone (Inito) ─────────────────────────
  if (todayReading.pdg != null) {
    signalCount++;
    if (todayReading.pdg >= pdgConfirmThreshold) {
      fertilityScore -= 2;
      ovulationConfirmed = true;
      signals.push({
        source: 'Inito',
        signal: personalized
          ? `PdG confirmed (${todayReading.pdg} µg/mL ≥ your ${pdgConfirmThreshold.toFixed(1)} threshold) — ovulation verified`
          : `PdG confirmed (${todayReading.pdg} µg/mL) — ovulation verified`,
        direction: 'negative',
      });
    } else if (todayReading.pdg >= pdgRisingThreshold) {
      fertilityScore -= 1;
      signals.push({ source: 'Inito', signal: `PdG rising (${todayReading.pdg} µg/mL) — likely post-ovulatory`, direction: 'negative' });
    } else {
      signals.push({ source: 'Inito', signal: `PdG low (${todayReading.pdg} µg/mL) — pre-ovulatory`, direction: 'neutral' });
    }
  }

  // ─── Kegg (Cervical Mucus Impedance) ────────────────────
  if (todayReading.keggImpedance != null || todayReading.keggScore != null) {
    signalCount++;
    const prevKegg = recentReadings
      .filter(r => r.keggImpedance != null)
      .map(r => ({ imp: r.keggImpedance!, cd: r.cycleDay }));

    if (prevKegg.length >= 1 && todayReading.keggImpedance != null) {
      // Look at the overall trend from peak impedance, not just yesterday
      const maxImp = Math.max(...prevKegg.map(k => k.imp));
      const dropFromPeak = maxImp - todayReading.keggImpedance;
      const yesterdayImp = prevKegg[prevKegg.length - 1].imp;
      const dayOverDay = yesterdayImp - todayReading.keggImpedance;

      if (dropFromPeak >= keggBigDropThreshold || (dayOverDay >= 20 && dropFromPeak >= keggSmallDropThreshold * 1.5)) {
        fertilityScore += 2.5;
        signals.push({
          source: 'Kegg',
          signal: personalized
            ? `Impedance dropped ${dropFromPeak} from peak (your typical drop ~${baselines!.kegg.typicalDropSize}) — fertile mucus detected`
            : `Impedance dropped ${dropFromPeak} from peak — fertile mucus detected`,
          direction: 'positive',
        });
      } else if (dropFromPeak >= keggSmallDropThreshold || dayOverDay >= 10) {
        fertilityScore += 1.5;
        signals.push({ source: 'Kegg', signal: `Impedance declining (↓${dropFromPeak} from peak) — approaching fertile window`, direction: 'positive' });
      } else if (todayReading.keggImpedance > maxImp) {
        fertilityScore -= 1;
        signals.push({ source: 'Kegg', signal: 'Impedance rising — post-ovulatory pattern', direction: 'negative' });
      } else {
        signals.push({ source: 'Kegg', signal: `Impedance: ${todayReading.keggImpedance} (stable)`, direction: 'neutral' });
      }
    } else if (todayReading.keggScore != null) {
      // Use keggScore as a proxy if impedance trend isn't available yet
      if (todayReading.keggScore >= 40) {
        fertilityScore += 1.5;
        signals.push({ source: 'Kegg', signal: `Fertility score ${todayReading.keggScore} — fertile range`, direction: 'positive' });
      } else if (todayReading.keggScore >= 20) {
        fertilityScore += 0.5;
        signals.push({ source: 'Kegg', signal: `Fertility score ${todayReading.keggScore} — transitioning`, direction: 'neutral' });
      } else {
        signals.push({ source: 'Kegg', signal: `Fertility score ${todayReading.keggScore} — baseline`, direction: 'neutral' });
      }
    } else {
      signals.push({ source: 'Kegg', signal: `Impedance: ${todayReading.keggImpedance ?? '—'} (building baseline)`, direction: 'neutral' });
    }
  }

  // ─── BBT (TempDrop) ─────────────────────────────────────
  if (todayReading.bbt != null) {
    signalCount++;
    const prevBBTs = recentReadings.filter(r => r.bbt != null).map(r => r.bbt!);

    if (prevBBTs.length >= 3) {
      // Prefer HER learned follicular baseline over this-cycle average if available
      const follicularBaseline = personalized && baselines!.bbt.follicularBaseline != null
        ? baselines!.bbt.follicularBaseline
        : prevBBTs.slice(0, Math.max(1, prevBBTs.length - 1)).reduce((a, b) => a + b, 0) / Math.max(1, prevBBTs.length - 1);
      const shift = todayReading.bbt - follicularBaseline;

      if (shift >= bbtShiftThreshold) {
        fertilityScore -= 2;
        ovulationConfirmed = true;
        signals.push({
          source: 'TempDrop',
          signal: personalized
            ? `Thermal shift confirmed (+${shift.toFixed(2)}°F over your ${follicularBaseline.toFixed(2)}°F baseline) — ovulation verified`
            : `Thermal shift confirmed (+${shift.toFixed(2)}°F) — ovulation verified`,
          direction: 'negative',
        });
      } else if (shift >= bbtMinorShiftThreshold) {
        fertilityScore -= 0.5;
        signals.push({ source: 'TempDrop', signal: `Possible thermal shift (+${shift.toFixed(2)}°F) — monitoring`, direction: 'neutral' });
      } else if (todayReading.bbt < bbtFollicularMax) {
        fertilityScore += 0.5;
        signals.push({ source: 'TempDrop', signal: `BBT low (${todayReading.bbt}°F) — follicular range, pre-ovulatory`, direction: 'neutral' });
      } else {
        signals.push({ source: 'TempDrop', signal: `BBT: ${todayReading.bbt}°F`, direction: 'neutral' });
      }
    } else {
      signals.push({ source: 'TempDrop', signal: `BBT: ${todayReading.bbt}°F (building baseline)`, direction: 'neutral' });
    }
  }

  // ─── Cervical Mucus (Manual) ────────────────────────────
  if (todayReading.cervicalMucus && todayReading.cervicalMucus !== 'not_checked') {
    signalCount++;
    const mucusScores: Record<string, number> = {
      'dry': -1, 'sticky': 0, 'creamy': 1, 'watery': 2, 'egg_white': 3,
    };
    const score = mucusScores[todayReading.cervicalMucus] ?? 0;
    fertilityScore += score;
    signals.push({
      source: 'Manual',
      signal: `Cervical mucus: ${todayReading.cervicalMucus.replace('_', ' ')}`,
      direction: score >= 2 ? 'positive' : score <= 0 ? 'negative' : 'neutral',
    });
  }

  // ─── Cycle Day Awareness (personalized fertile window) ──
  // Uses HER typical window when baselines are available, else CD10-17.
  if (cycleDay >= fertileStart && cycleDay <= fertileEnd && !ovulationConfirmed) {
    const cdBoost = cycleDay >= peakCdStart && cycleDay <= peakCdEnd ? 1.0 : 0.5;
    if (fertilityScore > 0 && fertilityScore < 3) {
      fertilityScore += cdBoost;
      signals.push({
        source: 'Cycle Pattern',
        signal: personalized
          ? `CD${cycleDay} — within YOUR typical fertile window (CD${fertileStart}-${fertileEnd}) — boosted`
          : `CD${cycleDay} — within typical fertile window (boosted)`,
        direction: 'positive',
      });
    } else if (signalCount === 0) {
      fertilityScore += cdBoost;
      signals.push({
        source: 'Cycle Pattern',
        signal: personalized
          ? `CD${cycleDay} — your typical fertile window (CD${fertileStart}-${fertileEnd}). Log device readings for better accuracy.`
          : `CD${cycleDay} — statistically likely fertile window. Log device readings for better accuracy.`,
        direction: 'positive',
      });
    }
  }

  // ─── Concordance ────────────────────────────────────────
  const positiveSignals = signals.filter(s => s.direction === 'positive').length;
  const negativeSignals = signals.filter(s => s.direction === 'negative').length;
  const concordance = signalCount >= 2 && (positiveSignals === 0 || negativeSignals === 0);

  // ─── Status Determination ───────────────────────────────
  let status: FertilityStatus;
  let phase: CyclePhase;
  let recommendation: string;

  if (cycleDay <= 4) {
    status = 'menstrual';
    phase = 'menstrual';
    recommendation = 'Rest and replenish. Focus on iron-rich foods, warmth, and gentle movement.';
  } else if (ovulationConfirmed) {
    status = 'confirmed_ovulation';
    phase = 'luteal';
    recommendation = 'Ovulation confirmed. Nourish yourself — progesterone support, rest, and calm.';
  } else if (fertilityScore >= 4.5) {
    status = 'peak';
    phase = 'ovulatory';
    recommendation = 'Multiple signals confirm peak fertility. This is your window — today matters.';
  } else if (fertilityScore >= 3) {
    status = 'high';
    phase = 'ovulatory';
    recommendation = 'Your fertile window is open. Your body is showing strong signals right now.';
  } else if (fertilityScore >= 1.5) {
    status = 'rising';
    phase = 'follicular';
    recommendation = 'Fertility is building. Your body is preparing — the window is approaching.';
  } else if (negativeSignals >= 2 && cycleDay > 14) {
    status = 'luteal';
    phase = 'luteal';
    recommendation = 'You\'re in the luteal phase. Prioritize sleep, warmth, and your supplement protocol.';
  } else if (cycleDay <= 6) {
    status = cycleDay <= 5 ? 'menstrual' : 'low';
    phase = cycleDay <= 5 ? 'menstrual' : 'follicular';
    recommendation = 'Early cycle. Your body is resetting and building toward the next window.';
  } else {
    status = 'low';
    phase = 'follicular';
    recommendation = 'Early follicular phase. Log your device readings for personalized fertile window detection.';
  }

  let confidence: 'low' | 'medium' | 'high' = signalCount >= 3 ? 'high' : signalCount >= 2 ? 'medium' : 'low';

  // ─── Signal Concordance (outlier & dilute-sample guard) ────────────
  // This runs AFTER the naive assessment and is allowed to hold the status
  // from regressing when a single bad reading contradicts the majority.
  const concordanceResult = assessConcordance({
    today: todayReading,
    yesterday: options.yesterdayReading ?? null,
    recent: recentReadings,
    cycleHistory: options.cycleHistory ?? [],
    cycleDay,
  });

  // Downgrade confidence if concordance flags trouble.
  if (concordanceResult.confidence === 'low') confidence = 'low';
  else if (concordanceResult.confidence === 'medium' && confidence === 'high') confidence = 'medium';

  // If the concordance engine says "don't regress on this reading alone,"
  // and we're about to flip from fertile → non-fertile, hold the prior status.
  if (options.priorStatus && shouldHoldStatus(concordanceResult, status, options.priorStatus)) {
    status = options.priorStatus;
    if (status === 'peak' || status === 'high' || status === 'rising') phase = 'ovulatory';
    recommendation = 'Holding your fertile status — today\'s reading conflicts with your other signals. iyla is protecting you from a false "window closed" flag.';
  }

  return { status, phase, confidence, signals, recommendation, concordance, concordanceResult, personalized };
}

export function getStatusColor(status: FertilityStatus): string {
  switch (status) {
    case 'peak': return 'text-amber-100';
    case 'high': return 'text-emerald-100';
    case 'rising': return 'text-teal-100';
    case 'confirmed_ovulation': return 'text-purple-100';
    case 'luteal': return 'text-indigo-100';
    case 'menstrual': return 'text-rose-100';
    case 'low': return 'text-slate-200';
  }
}

export function getStatusGradient(status: FertilityStatus): string {
  switch (status) {
    case 'peak': return 'from-amber-400 via-orange-400 to-rose-400';
    case 'high': return 'from-emerald-400 via-teal-400 to-cyan-400';
    case 'rising': return 'from-teal-400 via-emerald-400 to-green-400';
    case 'confirmed_ovulation': return 'from-violet-400 via-purple-400 to-fuchsia-400';
    case 'luteal': return 'from-indigo-400 via-violet-400 to-purple-400';
    case 'menstrual': return 'from-rose-400 via-pink-400 to-fuchsia-300';
    case 'low': return 'from-slate-400 via-gray-400 to-slate-300';
  }
}

export function getStatusGlow(status: FertilityStatus): string {
  switch (status) {
    case 'peak': return 'shadow-amber-300/40';
    case 'high': return 'shadow-emerald-300/40';
    case 'rising': return 'shadow-teal-300/40';
    case 'confirmed_ovulation': return 'shadow-violet-300/40';
    case 'luteal': return 'shadow-indigo-300/40';
    case 'menstrual': return 'shadow-rose-300/40';
    case 'low': return 'shadow-slate-300/30';
  }
}

import { translate } from './clinical-terminology';

export function getStatusLabel(status: FertilityStatus): string {
  let warm: string;
  switch (status) {
    case 'peak': warm = 'Peak Fertility'; break;
    case 'high': warm = 'High Fertility'; break;
    case 'rising': warm = 'Rising'; break;
    case 'confirmed_ovulation': warm = 'Ovulation Confirmed'; break;
    case 'luteal': warm = 'Luteal Phase'; break;
    case 'menstrual': warm = 'Menstrual'; break;
    case 'low': warm = 'Low Fertility'; break;
  }
  return translate(warm);
}

export function getPhaseLabel(phase: CyclePhase): string {
  let warm: string;
  switch (phase) {
    case 'menstrual': warm = 'Menstrual Phase'; break;
    case 'follicular': warm = 'Follicular Phase'; break;
    case 'ovulatory': warm = 'Ovulatory Phase'; break;
    case 'luteal': warm = 'Luteal Phase'; break;
  }
  return translate(warm);
}
