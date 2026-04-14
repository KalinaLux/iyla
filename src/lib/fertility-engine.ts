import type { DailyReading, FertilityStatus, CyclePhase } from './types';

interface FertilityAssessment {
  status: FertilityStatus;
  phase: CyclePhase;
  confidence: 'low' | 'medium' | 'high';
  signals: SignalReport[];
  recommendation: string;
  concordance: boolean;
}

interface SignalReport {
  source: string;
  signal: string;
  direction: 'positive' | 'neutral' | 'negative';
}

export function assessFertility(
  todayReading: DailyReading,
  recentReadings: DailyReading[],
  cycleDay: number,
): FertilityAssessment {
  const signals: SignalReport[] = [];
  let fertilityScore = 0;
  let signalCount = 0;

  if (todayReading.lh != null) {
    signalCount++;
    if (todayReading.lh >= 20) {
      fertilityScore += 3;
      signals.push({ source: 'Inito', signal: `LH surge detected (${todayReading.lh} mIU/mL)`, direction: 'positive' });
    } else if (todayReading.lh >= 10) {
      fertilityScore += 1.5;
      signals.push({ source: 'Inito', signal: `LH rising (${todayReading.lh} mIU/mL)`, direction: 'positive' });
    } else {
      signals.push({ source: 'Inito', signal: `LH baseline (${todayReading.lh} mIU/mL)`, direction: 'neutral' });
    }
  }

  if (todayReading.e3g != null) {
    signalCount++;
    const prevE3g = recentReadings.filter(r => r.e3g != null).map(r => r.e3g!);
    const avgPrevE3g = prevE3g.length > 0 ? prevE3g.reduce((a, b) => a + b, 0) / prevE3g.length : 0;

    if (todayReading.e3g > avgPrevE3g * 1.3 && avgPrevE3g > 0) {
      fertilityScore += 2;
      signals.push({ source: 'Inito', signal: `Estrogen rising significantly (${todayReading.e3g} pg/mL)`, direction: 'positive' });
    } else if (todayReading.e3g > avgPrevE3g * 1.1 && avgPrevE3g > 0) {
      fertilityScore += 1;
      signals.push({ source: 'Inito', signal: `Estrogen gradually rising (${todayReading.e3g} pg/mL)`, direction: 'positive' });
    } else {
      signals.push({ source: 'Inito', signal: `Estrogen stable (${todayReading.e3g} pg/mL)`, direction: 'neutral' });
    }
  }

  if (todayReading.pdg != null) {
    signalCount++;
    if (todayReading.pdg >= 5) {
      fertilityScore -= 1;
      signals.push({ source: 'Inito', signal: `PdG rising (${todayReading.pdg} µg/mL) — ovulation likely confirmed`, direction: 'negative' });
    } else {
      signals.push({ source: 'Inito', signal: `PdG low (${todayReading.pdg} µg/mL) — pre-ovulatory`, direction: 'neutral' });
    }
  }

  if (todayReading.keggImpedance != null) {
    signalCount++;
    const prevKegg = recentReadings.filter(r => r.keggImpedance != null).map(r => r.keggImpedance!);

    if (prevKegg.length >= 2) {
      const trend = todayReading.keggImpedance - prevKegg[prevKegg.length - 1];
      if (trend < -50) {
        fertilityScore += 2;
        signals.push({ source: 'Kegg', signal: 'Impedance dropping sharply — fertile mucus developing', direction: 'positive' });
      } else if (trend < -20) {
        fertilityScore += 1;
        signals.push({ source: 'Kegg', signal: 'Impedance declining — approaching fertile window', direction: 'positive' });
      } else if (trend > 50) {
        fertilityScore -= 1;
        signals.push({ source: 'Kegg', signal: 'Impedance rising — post-ovulatory pattern', direction: 'negative' });
      } else {
        signals.push({ source: 'Kegg', signal: 'Impedance stable', direction: 'neutral' });
      }
    } else {
      signals.push({ source: 'Kegg', signal: `Impedance: ${todayReading.keggImpedance} (building baseline)`, direction: 'neutral' });
    }
  }

  if (todayReading.bbt != null) {
    signalCount++;
    const prevBBTs = recentReadings.filter(r => r.bbt != null).map(r => r.bbt!);

    if (prevBBTs.length >= 3) {
      const baseline = prevBBTs.slice(0, -1).reduce((a, b) => a + b, 0) / (prevBBTs.length - 1);
      const shift = todayReading.bbt - baseline;

      if (shift >= 0.3) {
        fertilityScore -= 2;
        signals.push({ source: 'TempDrop', signal: `Thermal shift detected (+${shift.toFixed(2)}°F) — ovulation confirmed`, direction: 'negative' });
      } else if (shift >= 0.15) {
        fertilityScore -= 0.5;
        signals.push({ source: 'TempDrop', signal: `Possible thermal shift (+${shift.toFixed(2)}°F) — watching`, direction: 'neutral' });
      } else {
        signals.push({ source: 'TempDrop', signal: `BBT in follicular range (${todayReading.bbt}°F)`, direction: 'neutral' });
      }
    } else {
      signals.push({ source: 'TempDrop', signal: `BBT: ${todayReading.bbt}°F (building baseline)`, direction: 'neutral' });
    }
  }

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

  const positiveSignals = signals.filter(s => s.direction === 'positive').length;
  const negativeSignals = signals.filter(s => s.direction === 'negative').length;
  const concordance = signalCount >= 2 && (positiveSignals === 0 || negativeSignals === 0);

  let status: FertilityStatus;
  let phase: CyclePhase;
  let recommendation: string;

  if (cycleDay <= 5) {
    status = 'menstrual';
    phase = 'menstrual';
    recommendation = 'Rest and replenish. Focus on iron-rich foods, warmth, and gentle movement today.';
  } else if (fertilityScore >= 5) {
    status = 'peak';
    phase = 'ovulatory';
    recommendation = 'Your body is giving strong signals. Multiple sources confirm peak fertility today.';
  } else if (fertilityScore >= 3) {
    status = 'high';
    phase = 'ovulatory';
    recommendation = 'Your fertile window is open. Your body is doing beautiful work right now.';
  } else if (fertilityScore >= 1.5) {
    status = 'rising';
    phase = 'follicular';
    recommendation = 'Fertility is building. Your body is preparing — the window is approaching.';
  } else if (negativeSignals >= 2 || (todayReading.pdg != null && todayReading.pdg >= 5)) {
    status = 'confirmed_ovulation';
    phase = 'luteal';
    recommendation = 'Ovulation confirmed. Nourish yourself — progesterone support, rest, and calm.';
  } else if (negativeSignals >= 1 && cycleDay > 14) {
    status = 'luteal';
    phase = 'luteal';
    recommendation = 'You\'re in the luteal phase. Prioritize sleep, warmth, and your supplement protocol.';
  } else {
    status = 'low';
    phase = 'follicular';
    recommendation = 'Early follicular phase. Your body is quietly building toward the next window.';
  }

  const confidence = signalCount >= 3 ? 'high' : signalCount >= 2 ? 'medium' : 'low';

  return { status, phase, confidence, signals, recommendation, concordance };
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

export function getStatusLabel(status: FertilityStatus): string {
  switch (status) {
    case 'peak': return 'Peak Fertility';
    case 'high': return 'High Fertility';
    case 'rising': return 'Rising';
    case 'confirmed_ovulation': return 'Ovulation Confirmed';
    case 'luteal': return 'Luteal Phase';
    case 'menstrual': return 'Menstrual';
    case 'low': return 'Low Fertility';
  }
}

export function getPhaseLabel(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return 'Menstrual Phase';
    case 'follicular': return 'Follicular Phase';
    case 'ovulatory': return 'Ovulatory Phase';
    case 'luteal': return 'Luteal Phase';
  }
}
