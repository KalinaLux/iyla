// ──────────────────────────────────────────────────────────────────────────
// iyla — Clinical Terminology Mode
// ──────────────────────────────────────────────────────────────────────────
// Toggle between iyla's warm, human-voice copy and clinical terminology
// that mirrors what a reproductive endocrinologist would use. Useful when
// sharing the app with a provider, preparing for an appointment, or for
// users who prefer precision over warmth.
// ──────────────────────────────────────────────────────────────────────────

const KEY = 'iyla_terminology_mode';

export type TerminologyMode = 'warm' | 'clinical';

export function getTerminologyMode(): TerminologyMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'clinical' ? 'clinical' : 'warm';
  } catch {
    return 'warm';
  }
}

export function setTerminologyMode(mode: TerminologyMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch { /* ignore */ }
}

// ── Label translation ────────────────────────────────────────────────

const WARM_TO_CLINICAL: Record<string, string> = {
  // Statuses
  'Peak Fertility': 'Peri-ovulatory phase, estimated LH surge',
  'High Fertility': 'Late follicular phase, estradiol rising',
  'Rising': 'Mid-follicular phase',
  'Low Fertility': 'Early follicular / non-fertile phase',
  'Ovulation Confirmed': 'Post-ovulation confirmed (thermal shift + PdG)',
  'Luteal Phase': 'Luteal phase',
  'Menstrual': 'Menstruation (menstrual phase)',

  // Phases
  'Menstrual Phase': 'Menstrual phase (days 1-5 typical)',
  'Follicular Phase': 'Follicular phase',
  'Ovulatory Phase': 'Peri-ovulatory phase',

  // Common iyla copy
  'Your fertile window is open.': 'Fertile window estimated open based on concordant signals.',
  'Your body is doing beautiful work right now.': 'Cycle indicators suggest active follicular maturation.',
  'Rest and replenish.': 'Menstrual phase — expected physiologic desquamation of the endometrium.',
  'Ovulation confirmed. Nourish yourself — progesterone support, rest, and calm.':
    'Ovulation confirmed by sustained thermal shift and/or PdG rise. Luteal phase initiated.',
  'You\'re in the luteal phase. Prioritize sleep, warmth, and your supplement protocol.':
    'Post-ovulatory luteal phase. Monitor for thermal regression and menstruation.',
  'Early follicular phase. Your body is quietly building toward the next window.':
    'Early follicular phase. Recruitment of antral follicles in progress.',
  'Early cycle. Your body is resetting and building toward the next window.':
    'Early cycle phase. Follicle recruitment phase.',

  // Signal names
  'BBT': 'Basal Body Temperature (°F)',
  'LH': 'Luteinizing Hormone (mIU/mL)',
  'E3G': 'Estrone-3-Glucuronide (pg/mL, urinary estrogen metabolite)',
  'PdG': 'Pregnanediol Glucuronide (µg/mL, urinary progesterone metabolite)',
  'FSH': 'Follicle-Stimulating Hormone (mIU/mL)',
  'Kegg': 'Cervical mucus impedance (Kegg sensor)',
  'EWCM': 'Egg-white cervical mucus (peri-ovulatory)',

  // Cycle concepts
  'TWW': 'Two-week wait (post-ovulation luteal phase prior to testing)',
  'Fertile window': 'Estimated fertile window (typically 5 days pre-ovulation through 1 day post)',
  'Implantation': 'Implantation (typically 6-12 days post-ovulation)',
  'Surge': 'LH surge (pre-ovulatory luteinizing hormone spike)',
};

/** Translate a single label to clinical mode. If no translation exists, returns original. */
export function clinical(label: string): string {
  return WARM_TO_CLINICAL[label] ?? label;
}

/** Translate based on current mode. */
export function translate(label: string, mode: TerminologyMode = getTerminologyMode()): string {
  if (mode !== 'clinical') return label;
  return clinical(label);
}
