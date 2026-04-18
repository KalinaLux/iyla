// ──────────────────────────────────────────────────────────────────────────
// iyla — Symptom Pattern Engine
// ──────────────────────────────────────────────────────────────────────────
// Detect recurring symptoms tied to cycle phase or cycle day across multiple
// cycles. Pure computation. Returns a ranked list of symptom patterns with
// clinical-ish narrative and explanation.
// ──────────────────────────────────────────────────────────────────────────

import type { Cycle, CyclePhase, DailyReading } from './types';

// ── Public interface ─────────────────────────────────────────────────────

export type SymptomCategory =
  | 'physical'
  | 'mood'
  | 'energy'
  | 'sleep'
  | 'digestion'
  | 'skin'
  | 'libido'
  | 'other';

export interface SymptomPattern {
  symptom: string;
  category: SymptomCategory;
  occurrences: number;
  cyclesObserved: number;
  phaseDistribution: {
    menstrual: number;
    follicular: number;
    ovulatory: number;
    luteal: number;
  };
  avgCycleDay: number;
  cycleDayRange: { min: number; max: number };
  dominantPhase: CyclePhase;
  confidence: 'low' | 'medium' | 'high';
  narrative: string;
  explanation: string;
  severity: 'informational' | 'notable' | 'significant';
}

// ── Categorization ───────────────────────────────────────────────────────

/**
 * Categorize a symptom string into a coarse bucket. Order matters — libido,
 * skin, and digestion are checked before the broader 'physical' fallback
 * because words like "bloating" overlap categories.
 */
export function categorizeSymptom(symptom: string): SymptomCategory {
  const s = symptom.toLowerCase().trim();
  if (!s) return 'other';

  if (/libido|horny|turned on|aroused|arous|sex drive|desire/.test(s)) return 'libido';
  if (/acne|breakout|pimple|blemish|skin|glow|oily|dry skin/.test(s)) return 'skin';
  if (/constipat|diarrhea|gas|bloat|nause|stomach|digest|gi |ibs|heartburn|reflux/.test(s)) return 'digestion';
  if (/insomnia|restless|poor sleep|good sleep|can't sleep|vivid dream|dream|sleep/.test(s)) return 'sleep';
  if (/tired|fatigue|energet|exhaust|sluggish|low energy|wired/.test(s)) return 'energy';
  if (/anxious|anxiety|irritab|sad|happy|emotional|depress|mood|angry|rage|cry|tearful|weepy|foggy|brain fog/.test(s)) return 'mood';
  if (/headache|migraine|cramp|pain|tender|backache|back pain|ache|sore|hot flash|spotting|mittelschmerz|ovulation pain|joint|cervical/.test(s)) return 'physical';

  return 'other';
}

// ── Phase inference ──────────────────────────────────────────────────────

function detectCycleOvDay(cycleReadings: DailyReading[]): number | null {
  const peak = cycleReadings.find(
    r => r.fertilityStatus === 'peak' || r.fertilityStatus === 'confirmed_ovulation',
  );
  if (peak) return peak.cycleDay;

  const lhReadings = cycleReadings.filter(r => r.lh != null);
  if (lhReadings.length > 0) {
    let top = lhReadings[0];
    for (const r of lhReadings) if ((r.lh ?? 0) > (top.lh ?? 0)) top = r;
    if ((top.lh ?? 0) >= 5) return Math.min(top.cycleDay + 1, 40);
  }

  // BBT nadir fallback — only if we have decent BBT data
  const bbts = cycleReadings.filter(r => r.bbt != null && r.cycleDay <= 20);
  if (bbts.length >= 5) {
    let nadir = bbts[0];
    for (const r of bbts) if ((r.bbt ?? Infinity) < (nadir.bbt ?? Infinity)) nadir = r;
    if (nadir.cycleDay < 20) return nadir.cycleDay + 1;
  }

  return null;
}

function inferPhase(
  reading: DailyReading,
  cycleOvDay: number | null,
): CyclePhase {
  if (reading.fertilityStatus === 'menstrual') return 'menstrual';
  if (
    reading.fertilityStatus === 'peak' ||
    reading.fertilityStatus === 'confirmed_ovulation'
  ) {
    return 'ovulatory';
  }
  if (reading.fertilityStatus === 'luteal') return 'luteal';

  const cd = reading.cycleDay;
  if (cycleOvDay != null) {
    if (cd <= 5) return 'menstrual';
    if (cd < cycleOvDay - 2) return 'follicular';
    if (cd <= cycleOvDay + 2) return 'ovulatory';
    return 'luteal';
  }
  // Fallback — generic 28-day model
  if (cd <= 5) return 'menstrual';
  if (cd <= 11) return 'follicular';
  if (cd <= 17) return 'ovulatory';
  return 'luteal';
}

// ── Narrative templates ──────────────────────────────────────────────────

interface NarrativePair {
  narrative: string;
  explanation: string;
}

function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Produce a warm narrative + clinical-ish explanation based on symptom text,
 * category, and dominant phase. Falls back to generic phase narratives for
 * any (category, phase) that isn't specifically covered.
 */
function buildNarrative(
  displaySymptom: string,
  symptomLower: string,
  category: SymptomCategory,
  phase: CyclePhase,
  cdMid: number,
): NarrativePair {
  const range = `around CD${Math.round(cdMid)}`;
  const label = cap(displaySymptom);
  const s = symptomLower;

  // Specific (symptom x phase) templates — at least 20 combinations
  if (/breast/.test(s) && phase === 'ovulatory') {
    return {
      narrative: `${label} clusters ${range} — classic estrogen-surge timing.`,
      explanation:
        'Rising estrogen in the late follicular phase stimulates breast ductal tissue, which many people feel as tenderness right before ovulation.',
    };
  }
  if (/breast/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} shows up ${range} — progesterone sensitivity.`,
      explanation:
        'Progesterone in the luteal phase promotes breast gland development and fluid retention in the tissue — a very common premenstrual signal.',
    };
  }
  if (/cramp/.test(s) && phase === 'menstrual') {
    return {
      narrative: `${label} land ${range} — uterine activity during your period.`,
      explanation:
        'Menstrual cramping comes from prostaglandin-driven uterine contractions that help shed the lining. Higher prostaglandins mean stronger cramps.',
    };
  }
  if (/cramp|mittelschmerz/.test(s) && phase === 'ovulatory') {
    return {
      narrative: `${label} appear ${range} — mittelschmerz as the follicle releases.`,
      explanation:
        'Ovulation itself can cause a sharp, often one-sided pain as the follicle ruptures and a small amount of fluid or blood irritates the peritoneum.',
    };
  }
  if (/cramp/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} show up ${range} — late-luteal uterine prep.`,
      explanation:
        'Late-luteal cramping often reflects rising prostaglandins as the uterus prepares to shed its lining — and can hint at higher-prostaglandin cycles overall.',
    };
  }
  if (/bloat/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} arrives ${range} — water retention from progesterone.`,
      explanation:
        'Progesterone slows gut motility and promotes sodium/water retention, which typically peaks in the mid-to-late luteal phase.',
    };
  }
  if (/bloat/.test(s) && phase === 'ovulatory') {
    return {
      narrative: `${label} clusters ${range} — estrogen-driven fluid retention.`,
      explanation:
        'Peak estrogen around ovulation can transiently increase vascular permeability and fluid retention, causing mid-cycle abdominal fullness.',
    };
  }
  if (/headache|migraine/.test(s) && phase === 'menstrual') {
    return {
      narrative: `${label} arrives ${range} — estrogen withdrawal.`,
      explanation:
        'The sharp drop in estrogen at the start of your period is a well-documented migraine and headache trigger in estrogen-sensitive people.',
    };
  }
  if (/headache|migraine/.test(s) && phase === 'ovulatory') {
    return {
      narrative: `${label} lands ${range} — mid-cycle estrogen peak.`,
      explanation:
        'Rapid estrogen peaks around ovulation can dilate cerebral blood vessels and modulate serotonin — a classic migraine trigger.',
    };
  }
  if (/headache|migraine/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} tends to appear ${range} — premenstrual hormone shift.`,
      explanation:
        'Falling progesterone and fluctuating estrogen late in the luteal phase are a common trigger for tension headaches and migraines.',
    };
  }
  if (/acne|breakout|pimple|blemish/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} flares ${range} — progesterone-driven sebum increase.`,
      explanation:
        'Progesterone stimulates sebaceous glands, which often leads to clogged pores and breakouts along the chin and jawline in the second half of the cycle.',
    };
  }
  if (/acne|breakout|pimple|blemish/.test(s) && phase === 'menstrual') {
    return {
      narrative: `${label} shows up ${range} — hormonal acne carrying into bleed.`,
      explanation:
        'The late-luteal hormone shift keeps sebum elevated, which can persist into the first days of bleeding before estrogen-driven clearing kicks in.',
    };
  }
  if (category === 'mood' && phase === 'luteal') {
    return {
      narrative: `${label} tends to appear ${range} — premenstrual emotional shift.`,
      explanation:
        'Progesterone metabolites (notably allopregnanolone) act on GABA-A receptors; their withdrawal in the late luteal phase can amplify anxiety, irritability, and low mood.',
    };
  }
  if (category === 'mood' && phase === 'ovulatory') {
    return {
      narrative: `${label} clusters ${range} — estrogen peak lifting things.`,
      explanation:
        'Estrogen modulates serotonin and dopamine; its mid-cycle peak often shows up as brighter mood, higher confidence, and more social energy.',
    };
  }
  if (category === 'mood' && phase === 'menstrual') {
    return {
      narrative: `${label} shows up ${range} — low-estrogen sensitivity during bleed.`,
      explanation:
        'Estrogen and progesterone are both at their lowest during your period, which can lift briefly after flow starts but often trails as low mood or sadness first.',
    };
  }
  if (/tired|fatigue|exhaust|sluggish/.test(s) && phase === 'menstrual') {
    return {
      narrative: `${label} hits ${range} — iron loss and low-hormone recovery.`,
      explanation:
        'Menstrual blood loss drops ferritin, and low estrogen during your period naturally reduces energy and drive. Common — and worth checking iron if persistent.',
    };
  }
  if (/tired|fatigue|exhaust|sluggish/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} shows up ${range} — progesterone's sedating effect.`,
      explanation:
        'Progesterone has a mild sedative action via GABA-A receptor modulation — many people feel sleepier and lower-energy in the luteal phase.',
    };
  }
  if (/low libido|decreased libido/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} lands ${range} — progesterone's calming effect on desire.`,
      explanation:
        'Progesterone suppresses the estrogen- and testosterone-driven libido peak, so desire commonly drops in the second half of the cycle.',
    };
  }
  if (/high libido|increased libido|horny|turned on|aroused/.test(s) && phase === 'ovulatory') {
    return {
      narrative: `${label} peaks ${range} — estrogen driving desire.`,
      explanation:
        'Estrogen and a small mid-cycle testosterone bump are biologically designed to increase desire right when conception is most likely.',
    };
  }
  if (/insomnia|restless|can't sleep|poor sleep/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} appears ${range} — pre-period sleep disruption.`,
      explanation:
        'Core body temperature runs higher in the luteal phase and the pre-period progesterone drop fragments sleep — a common late-luteal signal.',
    };
  }
  if (/vivid dream|dream/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} clusters ${range} — progesterone's REM effect.`,
      explanation:
        'Progesterone metabolites alter REM sleep architecture, which can make luteal-phase dreams more vivid, emotional, and memorable.',
    };
  }
  if (/nause/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} shows up ${range} — hormonal GI sensitivity.`,
      explanation:
        'Progesterone slows gastric emptying and modulates gut serotonin, which can trigger nausea and reflux late in the luteal phase.',
    };
  }
  if (/back/.test(s) && phase === 'menstrual') {
    return {
      narrative: `${label} lands ${range} — referred uterine pain.`,
      explanation:
        'The uterus shares sensory nerve pathways with the lower back, so menstrual cramping commonly shows up as lower-back pain.',
    };
  }
  if (/hot flash/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} appears ${range} — luteal temperature instability.`,
      explanation:
        'Progesterone raises baseline body temperature, and fluctuating estrogen can destabilize thermoregulation — hot flashes are a known luteal signal.',
    };
  }
  if (/spotting/.test(s) && phase === 'ovulatory') {
    return {
      narrative: `${label} lands ${range} — ovulation-adjacent spotting.`,
      explanation:
        'A brief estrogen dip right around ovulation can cause light mid-cycle spotting — usually benign, but worth tracking if it becomes heavy or persistent.',
    };
  }
  if (/spotting/.test(s) && phase === 'luteal') {
    return {
      narrative: `${label} shows up ${range} — pre-period or luteal spotting.`,
      explanation:
        'Late-luteal spotting can reflect falling progesterone before a full bleed. Persistent spotting >2 days before your period may signal weaker luteal support.',
    };
  }

  // Generic (category x phase) fallbacks
  const phaseWord: Record<CyclePhase, string> = {
    menstrual: 'during your period',
    follicular: 'in the follicular phase',
    ovulatory: 'around ovulation',
    luteal: 'in the luteal phase',
  };
  const phaseExplanation: Record<CyclePhase, string> = {
    menstrual:
      'Estrogen and progesterone are at their lowest during your period, which can drive a characteristic cluster of physical and energy signals.',
    follicular:
      'Rising estrogen in the follicular phase reshapes mood, energy, and many physical symptoms as your body prepares to ovulate.',
    ovulatory:
      'The estrogen peak and LH surge around ovulation drive a distinct shift in symptoms many people learn to recognize.',
    luteal:
      'Progesterone dominance in the luteal phase touches nearly every system — gut, mood, skin, sleep, and breast tissue.',
  };

  return {
    narrative: `${label} tends to appear ${range}, ${phaseWord[phase]}.`,
    explanation: phaseExplanation[phase],
  };
}

// ── Core detection ───────────────────────────────────────────────────────

interface Occurrence {
  cycleId: number;
  cycleDay: number;
  phase: CyclePhase;
}

export function detectSymptomPatterns(
  cycles: Cycle[],
  readings: DailyReading[],
): SymptomPattern[] {
  if (cycles.length === 0 || readings.length === 0) return [];

  // Build a per-cycle ovulation map
  const ovByCycle = new Map<number, number | null>();
  for (const c of cycles) {
    if (c.id == null) continue;
    const cr = readings.filter(r => r.cycleId === c.id);
    ovByCycle.set(c.id, detectCycleOvDay(cr));
  }

  // Flatten to (symptomDisplay, symptomKey, cycleId, cycleDay, phase) tuples
  const buckets = new Map<
    string,
    { display: string; occurrences: Occurrence[] }
  >();

  for (const r of readings) {
    if (!r.symptoms || r.symptoms.length === 0) continue;
    const ov = ovByCycle.get(r.cycleId) ?? null;
    const phase = inferPhase(r, ov);
    for (const raw of r.symptoms) {
      if (typeof raw !== 'string') continue;
      const display = raw.trim();
      if (!display) continue;
      const key = display.toLowerCase();
      const bucket = buckets.get(key);
      const occ: Occurrence = {
        cycleId: r.cycleId,
        cycleDay: r.cycleDay,
        phase,
      };
      if (bucket) {
        bucket.occurrences.push(occ);
      } else {
        buckets.set(key, { display, occurrences: [occ] });
      }
    }
  }

  const patterns: SymptomPattern[] = [];

  for (const { display, occurrences } of buckets.values()) {
    const uniqueCycles = new Set(occurrences.map(o => o.cycleId));
    if (occurrences.length < 2) continue;
    if (uniqueCycles.size < 2) continue;

    const phaseCounts = { menstrual: 0, follicular: 0, ovulatory: 0, luteal: 0 };
    for (const o of occurrences) phaseCounts[o.phase]++;
    const total = occurrences.length;
    const phaseDistribution = {
      menstrual: phaseCounts.menstrual / total,
      follicular: phaseCounts.follicular / total,
      ovulatory: phaseCounts.ovulatory / total,
      luteal: phaseCounts.luteal / total,
    };

    const dominantPhase = (Object.entries(phaseCounts) as Array<[CyclePhase, number]>)
      .sort((a, b) => b[1] - a[1])[0][0];
    const dominantShare = phaseDistribution[dominantPhase];

    const days = occurrences.map(o => o.cycleDay);
    const avgCycleDay = days.reduce((a, b) => a + b, 0) / days.length;
    const cycleDayRange = {
      min: Math.min(...days),
      max: Math.max(...days),
    };

    const cyclesObserved = uniqueCycles.size;

    let confidence: SymptomPattern['confidence'];
    if (cyclesObserved >= 3 && occurrences.length >= 5 && dominantShare > 0.6) {
      confidence = 'high';
    } else if (cyclesObserved >= 2 && occurrences.length >= 3) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    let severity: SymptomPattern['severity'];
    if (dominantShare > 0.75 && confidence === 'high') {
      severity = 'significant';
    } else if (
      dominantShare > 0.5 &&
      (confidence === 'medium' || confidence === 'high')
    ) {
      severity = 'notable';
    } else {
      severity = 'informational';
    }

    const category = categorizeSymptom(display);
    const { narrative, explanation } = buildNarrative(
      display,
      display.toLowerCase(),
      category,
      dominantPhase,
      avgCycleDay,
    );

    patterns.push({
      symptom: display,
      category,
      occurrences: total,
      cyclesObserved,
      phaseDistribution,
      avgCycleDay: Math.round(avgCycleDay * 10) / 10,
      cycleDayRange,
      dominantPhase,
      confidence,
      narrative,
      explanation,
      severity,
    });
  }

  const SEV_RANK: Record<SymptomPattern['severity'], number> = {
    significant: 0,
    notable: 1,
    informational: 2,
  };
  const CONF_RANK: Record<SymptomPattern['confidence'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return patterns.sort((a, b) => {
    const s = SEV_RANK[a.severity] - SEV_RANK[b.severity];
    if (s !== 0) return s;
    const c = CONF_RANK[a.confidence] - CONF_RANK[b.confidence];
    if (c !== 0) return c;
    return b.cyclesObserved - a.cyclesObserved;
  });
}
