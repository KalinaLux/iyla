// ──────────────────────────────────────────────────────────────────────────
// iyla — Signal Concordance Engine
// ──────────────────────────────────────────────────────────────────────────
// Core principle: no single device, no single reading, no single algorithm
// determines fertility status. The combined signal is always smarter than
// any individual measurement.
//
// This engine sits ABOVE the fertility-engine. It:
//   1. Computes how much the tracked signals AGREE (concordance score 0-100)
//   2. Detects outliers — a single signal contradicting the majority
//   3. Detects dilute-sample artifacts in urine hormone panels (Inito)
//   4. Detects physiologically-impossible LH drops
//   5. Recognizes Kegg double-dip patterns
//   6. Matches current readings against historical surge timing
//   7. Reports a confidence level: low / medium / high
//
// Born from the real CD12 scenario where a dilute-sample LH=0.1 reading
// contradicted every other signal and nearly ended TTC attempts prematurely.
// "Every signal, one story. And the story must be right."
// ──────────────────────────────────────────────────────────────────────────

import type { DailyReading, FertilityStatus } from './types';

// ── Types ──────────────────────────────────────────────────────────────

export type SignalDirection = 'rising' | 'falling' | 'stable' | 'unknown';

export type SignalSource =
  | 'tempdrop_bbt'
  | 'inito_lh'
  | 'inito_e3g'
  | 'inito_pdg'
  | 'inito_fsh'
  | 'kegg_impedance'
  | 'kegg_fertility_score'
  | 'physical_symptoms'
  | 'cervical_mucus';

export interface SignalReading {
  source: SignalSource;
  label: string;           // human-readable, e.g. "Inito LH"
  value: number | string;  // raw value for display
  direction: SignalDirection;
  weight: number;          // 0-1, normalized weight in concordance math
  supports: 'pre_ovulatory' | 'fertile' | 'post_ovulatory' | 'unclear';
}

export type ConcordanceFlag =
  | {
      kind: 'single_signal_contradiction';
      outlierSource: SignalSource;
      agreeingSources: SignalSource[];
      explanation: string;
      suggestion: string;
    }
  | {
      kind: 'dilute_sample';
      affectedSources: SignalSource[];
      explanation: string;
      suggestion: string;
    }
  | {
      kind: 'impossible_lh_drop';
      explanation: string;
      suggestion: string;
    }
  | {
      kind: 'kegg_double_dip';
      explanation: string;
      suggestion: string;
    }
  | {
      kind: 'historical_surge_expected';
      expectedCycleDayRange: [number, number];
      explanation: string;
      suggestion: string;
    };

export interface ConcordanceResult {
  concordanceScore: number;                 // 0-100
  confidence: 'low' | 'medium' | 'high';
  flags: ConcordanceFlag[];
  signals: SignalReading[];
  sampleQuality: SampleQuality;
  statusLock: {
    preventRegression: boolean;             // true → don't allow status to move backward on this reading alone
    reason?: string;
  };
  narrative: string;                        // human-voice summary
}

export interface SampleQuality {
  quality: 'unknown' | 'good' | 'acceptable' | 'likely_dilute' | 'lh_suspect' | 'ovulation_confirmed_decline';
  confidence: 'low' | 'medium' | 'high';
  message: string;
}

export interface ConcordanceInput {
  today: DailyReading;
  yesterday: DailyReading | null;
  recent: DailyReading[];                   // last 7-10 days of current cycle, sorted asc
  cycleHistory: Array<{ peakLhDay: number | null; peakLhValue: number | null }>; // prior cycles' surge data
  cycleDay: number;
}

// ── Signal weights (sum to 1.0, spec-aligned) ─────────────────────────

export const SIGNAL_WEIGHTS: Record<SignalSource, number> = {
  tempdrop_bbt: 0.25,           // objective hardware measure — highest
  inito_lh: 0.20,               // high but susceptible to sample quality
  inito_e3g: 0.15,              // tracks follicle development
  inito_pdg: 0.15,              // post-ov confirmation
  kegg_impedance: 0.10,         // objective mucus measure
  kegg_fertility_score: 0.05,   // algorithm-derived
  inito_fsh: 0.03,              // supports pituitary cascade reading
  physical_symptoms: 0.04,      // subjective but valuable
  cervical_mucus: 0.03,         // manual observation
};

// ── Helpers ────────────────────────────────────────────────────────────

function pctChange(today: number | undefined, yesterday: number | undefined): number | null {
  if (today == null || yesterday == null || yesterday === 0) return null;
  return (today - yesterday) / yesterday;
}

function bbtShiftDetected(today: DailyReading, recent: DailyReading[]): boolean {
  if (today.bbt == null) return false;
  const priorBBTs = recent.filter(r => r.bbt != null && r.date < today.date).map(r => r.bbt!);
  if (priorBBTs.length < 3) return false;
  const baseline = priorBBTs.slice(-6, -1).reduce((a, b) => a + b, 0) / Math.min(5, priorBBTs.length - 1);
  return today.bbt - baseline >= 0.3;
}

function sustainedBBTShift(recent: DailyReading[], cycleDay: number): boolean {
  const bbts = recent.filter(r => r.bbt != null).sort((a, b) => a.cycleDay - b.cycleDay);
  if (bbts.length < 6) return false;
  const late = bbts.filter(r => r.cycleDay >= cycleDay - 3 && r.cycleDay <= cycleDay);
  const early = bbts.filter(r => r.cycleDay < cycleDay - 3);
  if (late.length < 3 || early.length < 3) return false;
  const lateAvg = late.reduce((a, b) => a + b.bbt!, 0) / late.length;
  const earlyAvg = early.reduce((a, b) => a + b.bbt!, 0) / early.length;
  return lateAvg - earlyAvg >= 0.3;
}

// ── Core signal extraction ────────────────────────────────────────────

function extractSignals(input: ConcordanceInput): SignalReading[] {
  const { today, recent, cycleDay } = input;
  const out: SignalReading[] = [];

  // LH direction — compared to recent average
  if (today.lh != null) {
    const recentLh = recent.filter(r => r.lh != null && r.date < today.date).map(r => r.lh!);
    const avg = recentLh.length > 0 ? recentLh.reduce((a, b) => a + b, 0) / recentLh.length : 0;
    let direction: SignalDirection = 'stable';
    let supports: SignalReading['supports'] = 'unclear';
    if (today.lh >= 15) { direction = 'rising'; supports = 'fertile'; }
    else if (today.lh >= 5 && today.lh > avg * 1.3) { direction = 'rising'; supports = 'fertile'; }
    else if (avg >= 5 && today.lh < avg * 0.3) { direction = 'falling'; supports = 'post_ovulatory'; }
    else if (cycleDay >= 10 && cycleDay <= 17 && today.lh < 2) { direction = 'falling'; supports = 'post_ovulatory'; }
    out.push({ source: 'inito_lh', label: 'Inito LH', value: today.lh, direction, weight: SIGNAL_WEIGHTS.inito_lh, supports });
  }

  if (today.e3g != null) {
    const recentE3g = recent.filter(r => r.e3g != null && r.date < today.date).map(r => r.e3g!);
    const avg = recentE3g.length > 0 ? recentE3g.reduce((a, b) => a + b, 0) / recentE3g.length : 0;
    const prev = recent.filter(r => r.e3g != null).sort((a, b) => b.date.localeCompare(a.date))[0]?.e3g ?? null;
    let direction: SignalDirection = 'stable';
    let supports: SignalReading['supports'] = 'unclear';
    if (today.e3g >= 100) { direction = 'rising'; supports = 'fertile'; }
    else if (avg > 0 && today.e3g > avg * 1.15) { direction = 'rising'; supports = 'fertile'; }
    else if (prev !== null && today.e3g < prev * 0.85) {
      direction = 'falling';
      supports = cycleDay <= 17 ? 'fertile' : 'post_ovulatory'; // pre-ov E3G decline is a peak fertility signal
    }
    out.push({ source: 'inito_e3g', label: 'Inito E3G (estrogen)', value: today.e3g, direction, weight: SIGNAL_WEIGHTS.inito_e3g, supports });
  }

  if (today.pdg != null) {
    const prev = recent.filter(r => r.pdg != null).sort((a, b) => b.date.localeCompare(a.date))[0]?.pdg ?? null;
    let direction: SignalDirection = 'stable';
    let supports: SignalReading['supports'] = 'unclear';
    if (today.pdg >= 5) { direction = 'rising'; supports = 'post_ovulatory'; }
    else if (today.pdg >= 3 && (prev === null || today.pdg > prev)) { direction = 'rising'; supports = 'post_ovulatory'; }
    else if (today.pdg < 2) { direction = 'stable'; supports = 'pre_ovulatory'; }
    out.push({ source: 'inito_pdg', label: 'Inito PdG', value: today.pdg, direction, weight: SIGNAL_WEIGHTS.inito_pdg, supports });
  }

  if (today.fsh != null) {
    out.push({
      source: 'inito_fsh', label: 'Inito FSH', value: today.fsh,
      direction: 'unknown', weight: SIGNAL_WEIGHTS.inito_fsh,
      supports: today.fsh > 4 && cycleDay < 15 ? 'fertile' : 'unclear',
    });
  }

  if (today.keggImpedance != null) {
    const priorImp = recent
      .filter(r => r.keggImpedance != null && r.date < today.date)
      .map(r => ({ imp: r.keggImpedance!, date: r.date }));
    const maxImp = priorImp.length > 0 ? Math.max(...priorImp.map(k => k.imp)) : today.keggImpedance;
    const drop = maxImp - today.keggImpedance;
    let direction: SignalDirection = 'stable';
    let supports: SignalReading['supports'] = 'unclear';
    if (drop >= 30) { direction = 'falling'; supports = 'fertile'; } // drop = fertile mucus
    else if (drop >= 15) { direction = 'falling'; supports = 'fertile'; }
    else if (today.keggImpedance > maxImp) { direction = 'rising'; supports = 'post_ovulatory'; } // rise = drying
    out.push({ source: 'kegg_impedance', label: 'Kegg impedance', value: today.keggImpedance, direction, weight: SIGNAL_WEIGHTS.kegg_impedance, supports });
  }

  if (today.keggScore != null) {
    let direction: SignalDirection = 'stable';
    let supports: SignalReading['supports'] = 'unclear';
    if (today.keggScore >= 40) { direction = 'rising'; supports = 'fertile'; }
    else if (today.keggScore >= 20) { direction = 'rising'; supports = 'fertile'; }
    else if (today.keggScore < 10) { supports = cycleDay > 17 ? 'post_ovulatory' : 'pre_ovulatory'; }
    out.push({ source: 'kegg_fertility_score', label: 'Kegg score', value: today.keggScore, direction, weight: SIGNAL_WEIGHTS.kegg_fertility_score, supports });
  }

  if (today.bbt != null) {
    const shift = bbtShiftDetected(today, recent);
    const low = today.bbt < 97.5;
    const supports: SignalReading['supports'] = shift ? 'post_ovulatory' : low ? 'pre_ovulatory' : 'unclear';
    out.push({
      source: 'tempdrop_bbt', label: 'TempDrop BBT', value: today.bbt,
      direction: shift ? 'rising' : 'stable', weight: SIGNAL_WEIGHTS.tempdrop_bbt, supports,
    });
  }

  if (today.cervicalMucus && today.cervicalMucus !== 'not_checked') {
    const fertile = today.cervicalMucus === 'egg_white' || today.cervicalMucus === 'watery';
    out.push({
      source: 'cervical_mucus', label: 'Cervical mucus', value: today.cervicalMucus.replace('_', ' '),
      direction: fertile ? 'rising' : 'stable', weight: SIGNAL_WEIGHTS.cervical_mucus,
      supports: fertile ? 'fertile' : today.cervicalMucus === 'dry' ? 'post_ovulatory' : 'unclear',
    });
  }

  const symptoms = today.symptoms ?? [];
  const fertileSymptomTerms = ['mittelschmerz', 'ovulation pain', 'breast tenderness', 'ewcm', 'libido', 'ovulation'];
  const fertileSymptomHits = symptoms.filter(s =>
    fertileSymptomTerms.some(t => s.toLowerCase().includes(t)),
  );
  if (fertileSymptomHits.length > 0) {
    out.push({
      source: 'physical_symptoms', label: 'Physical symptoms', value: fertileSymptomHits.join(', '),
      direction: 'rising', weight: SIGNAL_WEIGHTS.physical_symptoms, supports: 'fertile',
    });
  }

  return out;
}

// ── Dilute sample detection (the CD12 problem) ─────────────────────────

export function assessSampleQuality(today: DailyReading, yesterday: DailyReading | null): SampleQuality {
  if (!yesterday) return { quality: 'unknown', confidence: 'low', message: 'No prior reading to compare against.' };

  const changes: Partial<Record<'e3g' | 'lh' | 'pdg' | 'fsh', number>> = {};
  const e3g = pctChange(today.e3g, yesterday.e3g); if (e3g !== null) changes.e3g = e3g;
  const lh = pctChange(today.lh, yesterday.lh); if (lh !== null) changes.lh = lh;
  const pdg = pctChange(today.pdg, yesterday.pdg); if (pdg !== null) changes.pdg = pdg;
  const fsh = pctChange(today.fsh, yesterday.fsh); if (fsh !== null) changes.fsh = fsh;

  const values = Object.values(changes);
  if (values.length === 0) return { quality: 'unknown', confidence: 'low', message: 'Not enough hormone overlap to assess.' };

  // Case: LH dropped dramatically but PdG rose and BBT shifted — real post-ov
  if ((changes.lh ?? 0) < -0.5 && (changes.pdg ?? 0) > 0.3 && today.bbt != null && yesterday.bbt != null && today.bbt - yesterday.bbt >= 0.3) {
    return {
      quality: 'ovulation_confirmed_decline', confidence: 'high',
      message: 'LH declining with PdG rising and temperature shift — ovulation has occurred. This decline is real.',
    };
  }

  // Case: all hormones dropped ≥30% → dilute sample
  if (values.length >= 3 && values.every(v => v < -0.3)) {
    return {
      quality: 'likely_dilute', confidence: 'medium',
      message: 'All hormone values decreased together from yesterday. This pattern points to a dilute sample, not a true hormonal shift. Consider retesting with more concentrated urine.',
    };
  }

  // Case: LH collapsed >80% while others stable (the CD12 case)
  if ((changes.lh ?? 0) < -0.8 && (['e3g', 'pdg', 'fsh'] as const).some(k => {
    const c = changes[k];
    return c !== undefined && Math.abs(c) < 0.3;
  })) {
    return {
      quality: 'lh_suspect', confidence: 'medium',
      message: 'Your LH reading collapsed while other hormones held steady. Physiologically unusual — likely a testing artifact. Verify with an LH strip.',
    };
  }

  return { quality: 'acceptable', confidence: 'medium', message: 'Sample quality appears consistent with yesterday.' };
}

// ── Outlier detection ──────────────────────────────────────────────────

function directionToVote(supports: SignalReading['supports']): 'fertile' | 'post_ov' | 'neutral' {
  if (supports === 'fertile') return 'fertile';
  if (supports === 'post_ovulatory') return 'post_ov';
  return 'neutral';
}

function detectSingleSignalContradiction(signals: SignalReading[]): ConcordanceFlag | null {
  if (signals.length < 3) return null;

  const votes = signals.map(s => ({ s, vote: directionToVote(s.supports) }));
  const fertileVotes = votes.filter(v => v.vote === 'fertile');
  const postOvVotes = votes.filter(v => v.vote === 'post_ov');

  // Contradiction: one signal says post-ov while 3+ say fertile
  if (fertileVotes.length >= 3 && postOvVotes.length === 1) {
    const outlier = postOvVotes[0].s;
    return {
      kind: 'single_signal_contradiction',
      outlierSource: outlier.source,
      agreeingSources: fertileVotes.map(v => v.s.source),
      explanation: `Your ${outlier.label} reading (${outlier.value}) suggests ovulation has passed, but ${fertileVotes.length} other signals all indicate you're still in your fertile window.`,
      suggestion: outlier.source === 'inito_lh'
        ? 'This may be a dilute sample. Consider retesting this afternoon with concentrated urine, or cross-check with an LH strip.'
        : 'Consider retesting or giving more weight to your other concordant signals.',
    };
  }

  // Inverse: 3+ say post-ov, one says fertile
  if (postOvVotes.length >= 3 && fertileVotes.length === 1) {
    const outlier = fertileVotes[0].s;
    return {
      kind: 'single_signal_contradiction',
      outlierSource: outlier.source,
      agreeingSources: postOvVotes.map(v => v.s.source),
      explanation: `Your ${outlier.label} reading suggests peak fertility, but ${postOvVotes.length} other signals indicate ovulation has passed.`,
      suggestion: 'The combined signal is stronger than any single reading. Trust the majority.',
    };
  }

  return null;
}

function detectImpossibleLhDrop(today: DailyReading, yesterday: DailyReading | null, recent: DailyReading[], cycleDay: number): ConcordanceFlag | null {
  if (yesterday?.lh == null || today.lh == null) return null;
  if (yesterday.lh < 3) return null; // no real surge yesterday → not applicable

  const dropPct = (yesterday.lh - today.lh) / yesterday.lh;
  if (dropPct < 0.8) return null;

  const pdgRose = today.pdg != null && today.pdg >= 3;
  const bbtShift = bbtShiftDetected(today, recent);

  if (!pdgRose && !bbtShift) {
    return {
      kind: 'impossible_lh_drop',
      explanation: `LH dropped from ${yesterday.lh} to ${today.lh} overnight (${Math.round(dropPct * 100)}% drop) without a BBT shift or PdG rise. A real LH collapse requires ovulation to have occurred — the confirmatory signals haven't followed yet.`,
      suggestion: cycleDay >= 10 && cycleDay <= 16
        ? 'This is almost certainly a dilute sample, not a real drop. Retest with a second-morning or afternoon urine sample.'
        : 'Verify with an LH strip before drawing conclusions.',
    };
  }
  return null;
}

function detectKeggDoubleDip(recent: DailyReading[]): ConcordanceFlag | null {
  const imps = recent
    .filter(r => r.keggImpedance != null)
    .sort((a, b) => a.cycleDay - b.cycleDay);
  if (imps.length < 5) return null;

  // Find local minima (valleys)
  const valleys: number[] = [];
  for (let i = 1; i < imps.length - 1; i++) {
    if (imps[i].keggImpedance! < imps[i - 1].keggImpedance! && imps[i].keggImpedance! < imps[i + 1].keggImpedance!) {
      valleys.push(i);
    }
  }
  if (valleys.length < 2) return null;

  // Peak between the two most recent valleys must rise by ≥15 impedance units
  const last = valleys[valleys.length - 1];
  const prev = valleys[valleys.length - 2];
  if (last - prev < 2) return null; // too close to count as separate dips
  const betweenMax = Math.max(...imps.slice(prev, last).map(r => r.keggImpedance!));
  const risesEnough = betweenMax - imps[prev].keggImpedance! >= 15 && betweenMax - imps[last].keggImpedance! >= 15;
  if (!risesEnough) return null;

  return {
    kind: 'kegg_double_dip',
    explanation: 'Your Kegg chart shows a double-dip pattern — impedance dropped, rose briefly, then dropped again. This is a recognized fertile pattern where cervical mucus transitions in two phases.',
    suggestion: 'Your most fertile days are during this second dip. Don\'t interpret the brief rise as the end of your window.',
  };
}

function detectHistoricalSurgeExpected(input: ConcordanceInput, signals: SignalReading[]): ConcordanceFlag | null {
  const history = input.cycleHistory.filter(h => h.peakLhDay != null);
  if (history.length < 2) return null;

  const avgPeakDay = history.reduce((a, b) => a + b.peakLhDay!, 0) / history.length;
  const windowLow = Math.round(avgPeakDay - 2);
  const windowHigh = Math.round(avgPeakDay + 2);
  if (input.cycleDay < windowLow || input.cycleDay > windowHigh) return null;

  const lhSignal = signals.find(s => s.source === 'inito_lh');
  if (!lhSignal || typeof lhSignal.value !== 'number') return null;
  if (lhSignal.value >= 3) return null; // surge is present; no issue

  return {
    kind: 'historical_surge_expected',
    expectedCycleDayRange: [windowLow, windowHigh],
    explanation: `Based on your cycle history, your LH surge typically happens around CD${Math.round(avgPeakDay)}. Today's low LH reading (${lhSignal.value}) doesn't match your usual pattern for this cycle day.`,
    suggestion: 'Consider retesting this afternoon with concentrated urine before adjusting your expectations.',
  };
}

// ── Concordance scoring ───────────────────────────────────────────────

function computeConcordanceScore(signals: SignalReading[]): number {
  if (signals.length === 0) return 50; // no data → neutral
  if (signals.length === 1) return 60;

  // For each pair of signals with defined votes, check if they agree.
  // Weight each pair by the product of their weights. Normalize.
  const voted = signals.filter(s => s.supports !== 'unclear');
  if (voted.length < 2) return 60;

  let agreeWeight = 0;
  let totalWeight = 0;
  for (let i = 0; i < voted.length; i++) {
    for (let j = i + 1; j < voted.length; j++) {
      const a = voted[i];
      const b = voted[j];
      const w = a.weight * b.weight;
      totalWeight += w;
      if (a.supports === b.supports) {
        agreeWeight += w;
      }
    }
  }
  if (totalWeight === 0) return 60;
  return Math.round((agreeWeight / totalWeight) * 100);
}

// ── Narrative generation ──────────────────────────────────────────────

function buildNarrative(
  signals: SignalReading[],
  flags: ConcordanceFlag[],
  quality: SampleQuality,
  score: number,
  confidence: 'low' | 'medium' | 'high',
): string {
  if (flags.length === 0 && signals.length >= 3 && score >= 80) {
    return `All ${signals.length} tracked signals are telling the same story — high confidence in today's reading.`;
  }
  if (flags.length === 0 && signals.length >= 2 && score >= 60) {
    return `${signals.length} signals logged today with ${confidence} confidence. Your signals are broadly aligned.`;
  }
  if (quality.quality === 'likely_dilute' || quality.quality === 'lh_suspect') {
    return `⚠️ ${quality.message} iyla is weighting your other signals more heavily until this is resolved.`;
  }
  if (flags.some(f => f.kind === 'single_signal_contradiction' || f.kind === 'impossible_lh_drop')) {
    const flag = flags.find(f => f.kind === 'single_signal_contradiction' || f.kind === 'impossible_lh_drop')!;
    return `⚠️ ${flag.explanation}`;
  }
  if (flags.some(f => f.kind === 'kegg_double_dip')) {
    return flags.find(f => f.kind === 'kegg_double_dip')!.explanation;
  }
  if (signals.length === 0) {
    return 'No device readings logged today. Log your Inito / Kegg / TempDrop data for a full assessment.';
  }
  return `${signals.length} signal${signals.length !== 1 ? 's' : ''} logged. Concordance ${score}/100 — ${confidence} confidence.`;
}

// ── Main API ──────────────────────────────────────────────────────────

export function assessConcordance(input: ConcordanceInput): ConcordanceResult {
  const signals = extractSignals(input);
  const sampleQuality = assessSampleQuality(input.today, input.yesterday);

  const flags: ConcordanceFlag[] = [];

  // Dilute sample → derived flag
  if (sampleQuality.quality === 'likely_dilute') {
    flags.push({
      kind: 'dilute_sample',
      affectedSources: ['inito_lh', 'inito_e3g', 'inito_pdg', 'inito_fsh'],
      explanation: sampleQuality.message,
      suggestion: 'Taper fluids after 7pm tonight and retest tomorrow with first-morning urine. If you need a verdict today, consider an LH strip for cross-reference.',
    });
  }
  if (sampleQuality.quality === 'lh_suspect') {
    flags.push({
      kind: 'dilute_sample',
      affectedSources: ['inito_lh'],
      explanation: sampleQuality.message,
      suggestion: 'Retest this afternoon with a 2-hour urine hold, or cross-reference with an LH strip.',
    });
  }

  const contradictionFlag = detectSingleSignalContradiction(signals);
  if (contradictionFlag) flags.push(contradictionFlag);

  const lhDropFlag = detectImpossibleLhDrop(input.today, input.yesterday, input.recent, input.cycleDay);
  if (lhDropFlag) flags.push(lhDropFlag);

  const doubleDipFlag = detectKeggDoubleDip(input.recent);
  if (doubleDipFlag) flags.push(doubleDipFlag);

  const historicalFlag = detectHistoricalSurgeExpected(input, signals);
  if (historicalFlag) flags.push(historicalFlag);

  // Downweight affected sources after dilute detection (per spec)
  if (sampleQuality.quality === 'likely_dilute') {
    for (const s of signals) {
      if (s.source === 'inito_lh' || s.source === 'inito_e3g' || s.source === 'inito_pdg' || s.source === 'inito_fsh') {
        s.weight *= 0.5;
      }
    }
  } else if (sampleQuality.quality === 'lh_suspect') {
    const lh = signals.find(s => s.source === 'inito_lh');
    if (lh) lh.weight *= 0.3;
  }

  const concordanceScore = computeConcordanceScore(signals);

  // Confidence
  let confidence: 'low' | 'medium' | 'high' = 'low';
  const criticalFlag = flags.some(f =>
    f.kind === 'single_signal_contradiction' ||
    f.kind === 'impossible_lh_drop' ||
    f.kind === 'dilute_sample',
  );
  if (signals.length >= 3 && concordanceScore >= 75 && !criticalFlag) confidence = 'high';
  else if (signals.length >= 2 && concordanceScore >= 60 && !criticalFlag) confidence = 'medium';
  else if (criticalFlag) confidence = 'low';
  else if (signals.length >= 3 && concordanceScore >= 60) confidence = 'medium';

  // Status lock: prevent the fertility engine from regressing status based on a bad reading
  let statusLock: ConcordanceResult['statusLock'] = { preventRegression: false };
  if (flags.some(f => f.kind === 'dilute_sample' || f.kind === 'impossible_lh_drop' || f.kind === 'single_signal_contradiction')) {
    // Allow regression only if BBT has shown a sustained shift (gold-standard override)
    const bbtLocked = sustainedBBTShift(input.recent, input.cycleDay);
    if (!bbtLocked) {
      statusLock = {
        preventRegression: true,
        reason: 'A critical concordance flag is active. Status will hold until the issue resolves or BBT confirms ovulation.',
      };
    }
  }

  const narrative = buildNarrative(signals, flags, sampleQuality, concordanceScore, confidence);

  return {
    concordanceScore,
    confidence,
    flags,
    signals,
    sampleQuality,
    statusLock,
    narrative,
  };
}

// ── Derived helpers used by the fertility-engine & partner sync ────────

/** True if partner notifications should fire for today's status. */
export function shouldNotifyPartner(result: ConcordanceResult): boolean {
  if (result.confidence === 'low') return false;
  if (result.concordanceScore < 70) return false;
  if (result.flags.filter(f => f.kind !== 'kegg_double_dip').length > 1) return false;
  return true;
}

/** If concordance is critically compromised, suggest the engine keep prior status. */
export function shouldHoldStatus(result: ConcordanceResult, proposedStatus: FertilityStatus, priorStatus: FertilityStatus | null): boolean {
  if (!result.statusLock.preventRegression) return false;
  if (!priorStatus) return false;
  // Regression = moving from a fertile phase (rising/high/peak) to a non-fertile one (low/luteal/confirmed_ovulation)
  const fertilePhases: FertilityStatus[] = ['rising', 'high', 'peak'];
  const nonFertile: FertilityStatus[] = ['low', 'luteal', 'confirmed_ovulation', 'menstrual'];
  return fertilePhases.includes(priorStatus) && nonFertile.includes(proposedStatus);
}

/** Raw signal summary for the drilldown UI. */
export function summarizeSignals(result: ConcordanceResult): Array<{ label: string; value: string; vote: string; weight: number }> {
  return result.signals.map(s => ({
    label: s.label,
    value: String(s.value),
    vote: s.supports,
    weight: Math.round(s.weight * 100) / 100,
  }));
}
