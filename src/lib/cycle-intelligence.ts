import type { Cycle, DailyReading, SupplementLog } from './types';

export interface CycleInsight {
  type: 'pattern' | 'anomaly' | 'improvement' | 'correlation' | 'warning';
  title: string;
  detail: string;
  icon: 'trending-up' | 'trending-down' | 'alert' | 'check' | 'info' | 'zap';
  severity: 'positive' | 'neutral' | 'attention';
}

export function generateCycleInsights(
  cycles: Cycle[],
  allReadings: DailyReading[][],
  supplementLogs?: SupplementLog[],
): CycleInsight[] {
  const insights: CycleInsight[] = [];

  if (cycles.length < 2 || allReadings.length < 2) {
    return [{
      type: 'pattern',
      title: 'Building your baseline',
      detail: 'iyla needs at least 2 complete cycles to start spotting patterns. Keep logging — every data point makes your insights smarter.',
      icon: 'info',
      severity: 'neutral',
    }];
  }

  // --- Cycle Length Consistency ---
  const completedCycles = cycles.filter(c => c.endDate);
  if (completedCycles.length >= 2) {
    const lengths = completedCycles.map(c => {
      const start = new Date(c.startDate + 'T00:00:00');
      const end = new Date(c.endDate! + 'T00:00:00');
      return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    });
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev <= 2) {
      insights.push({
        type: 'pattern',
        title: 'Consistent cycle length',
        detail: `Your cycles average ${avg.toFixed(0)} days with very little variation (±${stdDev.toFixed(1)} days). This consistency is a positive sign for ovulatory regularity.`,
        icon: 'check',
        severity: 'positive',
      });
    } else if (stdDev > 5) {
      insights.push({
        type: 'anomaly',
        title: 'Variable cycle length',
        detail: `Your cycle length varies significantly (${Math.min(...lengths)}–${Math.max(...lengths)} days). This may indicate irregular ovulation. Consider discussing with your RE.`,
        icon: 'alert',
        severity: 'attention',
      });
    }
  }

  // --- LH Surge Pattern ---
  const lhSurgeDays: number[] = [];
  allReadings.forEach(readings => {
    const surgeDay = readings.find(r => r.lh != null && r.lh >= 20);
    if (surgeDay) lhSurgeDays.push(surgeDay.cycleDay);
  });

  if (lhSurgeDays.length >= 2) {
    const avgSurge = lhSurgeDays.reduce((a, b) => a + b, 0) / lhSurgeDays.length;
    const surgeVariance = Math.sqrt(lhSurgeDays.reduce((a, b) => a + Math.pow(b - avgSurge, 2), 0) / lhSurgeDays.length);

    if (surgeVariance <= 1.5) {
      insights.push({
        type: 'pattern',
        title: 'Predictable LH surge',
        detail: `Your LH surge has occurred around CD${avgSurge.toFixed(0)} for the last ${lhSurgeDays.length} cycles. Your body is remarkably consistent.`,
        icon: 'zap',
        severity: 'positive',
      });
    }
  }

  // --- Estrogen Peak Comparison ---
  const e3gPeaks = allReadings.map(readings => {
    const e3gValues = readings.filter(r => r.e3g != null).map(r => r.e3g!);
    return e3gValues.length > 0 ? Math.max(...e3gValues) : null;
  }).filter((v): v is number => v !== null);

  if (e3gPeaks.length >= 2) {
    const latest = e3gPeaks[e3gPeaks.length - 1];
    const previous = e3gPeaks[e3gPeaks.length - 2];
    const change = ((latest - previous) / previous) * 100;

    if (change > 15) {
      insights.push({
        type: 'improvement',
        title: 'Stronger estrogen peak',
        detail: `Your estrogen peaked ${change.toFixed(0)}% higher this cycle (${latest.toFixed(1)} pg/mL) compared to last (${previous.toFixed(1)} pg/mL). This may suggest stronger follicular development.`,
        icon: 'trending-up',
        severity: 'positive',
      });
    } else if (change < -20) {
      insights.push({
        type: 'anomaly',
        title: 'Lower estrogen peak',
        detail: `Your estrogen peak was ${Math.abs(change).toFixed(0)}% lower this cycle. This could indicate a weaker follicular phase. Monitor over the next cycle before drawing conclusions.`,
        icon: 'trending-down',
        severity: 'attention',
      });
    }
  }

  // --- Luteal Phase Length ---
  const lutealLengths: number[] = [];
  completedCycles.forEach((cycle, i) => {
    const readings = allReadings[i];
    if (!readings || !cycle.endDate) return;
    const ovDay = cycle.ovulationDay ?? readings.find(r => r.pdg != null && r.pdg >= 5)?.cycleDay;
    if (ovDay) {
      const cycleLen = Math.floor((new Date(cycle.endDate + 'T00:00:00').getTime() - new Date(cycle.startDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
      lutealLengths.push(cycleLen - ovDay);
    }
  });

  if (lutealLengths.length >= 2) {
    const avgLuteal = lutealLengths.reduce((a, b) => a + b, 0) / lutealLengths.length;
    if (avgLuteal < 10) {
      insights.push({
        type: 'warning',
        title: 'Short luteal phase',
        detail: `Your average luteal phase is ${avgLuteal.toFixed(1)} days. A luteal phase under 10 days may indicate insufficient progesterone for implantation. Discuss with your provider.`,
        icon: 'alert',
        severity: 'attention',
      });
    } else if (avgLuteal >= 12) {
      insights.push({
        type: 'pattern',
        title: 'Strong luteal phase',
        detail: `Your luteal phase averages ${avgLuteal.toFixed(1)} days — this is excellent for supporting early implantation.`,
        icon: 'check',
        severity: 'positive',
      });
    }
  }

  // --- BBT Thermal Shift Quality ---
  allReadings.forEach((readings, i) => {
    if (i === 0) return;
    const bbts = readings.filter(r => r.bbt != null);
    if (bbts.length < 10) return;

    const midpoint = Math.floor(bbts.length / 2);
    const follicular = bbts.slice(0, midpoint).map(r => r.bbt!);
    const luteal = bbts.slice(midpoint).map(r => r.bbt!);

    const follicularAvg = follicular.reduce((a, b) => a + b, 0) / follicular.length;
    const lutealAvg = luteal.reduce((a, b) => a + b, 0) / luteal.length;
    const shift = lutealAvg - follicularAvg;

    if (shift >= 0.4) {
      insights.push({
        type: 'pattern',
        title: 'Clear thermal shift',
        detail: `Your BBT shift was ${shift.toFixed(2)}°F this cycle — a clear ovulatory signature. Strong shifts indicate robust progesterone production.`,
        icon: 'check',
        severity: 'positive',
      });
    } else if (shift < 0.2 && shift > 0) {
      insights.push({
        type: 'anomaly',
        title: 'Weak thermal shift',
        detail: `Your BBT shift was only ${shift.toFixed(2)}°F — below the typical 0.3°F+ threshold. This could indicate weak ovulation or progesterone. Consider discussing with your provider.`,
        icon: 'alert',
        severity: 'attention',
      });
    }
  });

  // --- Supplement Compliance Correlation ---
  if (supplementLogs && supplementLogs.length > 0 && lutealLengths.length >= 2) {
    const taken = supplementLogs.filter(l => l.taken).length;
    const total = supplementLogs.length;
    const compliance = total > 0 ? (taken / total) * 100 : 0;

    if (compliance >= 90) {
      insights.push({
        type: 'correlation',
        title: 'Excellent supplement compliance',
        detail: `You've maintained ${compliance.toFixed(0)}% supplement compliance. Consistent supplementation supports egg quality and hormonal balance over time.`,
        icon: 'check',
        severity: 'positive',
      });
    } else if (compliance < 60 && compliance > 0) {
      insights.push({
        type: 'correlation',
        title: 'Room to improve compliance',
        detail: `Your supplement compliance is ${compliance.toFixed(0)}%. Research shows that consistent daily intake is more impactful than the specific supplements themselves. Small habits compound.`,
        icon: 'info',
        severity: 'neutral',
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: 'pattern',
      title: 'Gathering data',
      detail: 'Keep logging your daily readings. The more data iyla has, the smarter your insights become.',
      icon: 'info',
      severity: 'neutral',
    });
  }

  return insights;
}
