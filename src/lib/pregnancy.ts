import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { pregnancyDb, type PregnancyAppointment, type PregnancyRecord } from './pregnancy-db';

const PREGNANCY_MODE_KEY = 'iyla-pregnancy-mode';

// ─────────────────────────────────────────────────────────────────────────────
// Date math
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a yyyy-MM-dd string as a local Date at midnight (avoid TZ drift). */
function parseISODate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

/**
 * Returns weeks/day/trimester of pregnancy from LMP.
 * Week 1 starts on LMP day (day 0). Trimester boundaries: T1 0-13w, T2 14-27w, T3 28+.
 */
export function computePregnancyWeek(
  lmpDate: string,
  today: Date = new Date(),
): { week: number; day: number; trimester: 1 | 2 | 3 } {
  const lmp = parseISODate(lmpDate);
  const diffDays = Math.max(0, differenceInCalendarDays(today, lmp));
  const week = Math.floor(diffDays / 7) + 1;
  const day = (diffDays % 7) + 1;
  const trimester: 1 | 2 | 3 = week <= 13 ? 1 : week <= 27 ? 2 : 3;
  return { week, day, trimester };
}

/** Due date: LMP + 280 days (40 completed weeks). */
export function computeDueDate(lmpDate: string): string {
  const lmp = parseISODate(lmpDate);
  return format(addDays(lmp, 280), 'yyyy-MM-dd');
}

/** Days until due date (negative if past). */
export function daysUntilDue(dueDate: string, today: Date = new Date()): number {
  return differenceInCalendarDays(parseISODate(dueDate), today);
}

/** Trimester from a week number. */
export function trimesterForWeek(week: number): 1 | 2 | 3 {
  return week <= 13 ? 1 : week <= 27 ? 2 : 3;
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone content
// ─────────────────────────────────────────────────────────────────────────────

export interface WeeklyMilestone {
  week: number;
  trimester: 1 | 2 | 3;
  babySize: string;
  developmentHighlight: string;
  momTip: string;
  concernLevel: 'calm' | 'vigilant';
  /** Gently framed loss-risk note, shown only where helpful. */
  lossRiskNote?: string;
}

/**
 * Size comparisons follow the common clinical-reference progression
 * (poppy seed → watermelon). Weeks 1–3 are pre-implantation/very early.
 */
const SIZES: Record<number, string> = {
  1: 'a thought',
  2: 'a whisper',
  3: 'a grain of salt',
  4: 'a poppy seed',
  5: 'a sesame seed',
  6: 'a lentil',
  7: 'a blueberry',
  8: 'a raspberry',
  9: 'a green olive',
  10: 'a prune',
  11: 'a fig',
  12: 'a lime',
  13: 'a lemon',
  14: 'a peach',
  15: 'an apple',
  16: 'an avocado',
  17: 'a turnip',
  18: 'a bell pepper',
  19: 'a mango',
  20: 'a banana',
  21: 'a carrot',
  22: 'a spaghetti squash',
  23: 'a large mango',
  24: 'an ear of corn',
  25: 'a rutabaga',
  26: 'a head of lettuce',
  27: 'a cauliflower',
  28: 'an eggplant',
  29: 'a butternut squash',
  30: 'a large cabbage',
  31: 'a coconut',
  32: 'a jicama',
  33: 'a pineapple',
  34: 'a cantaloupe',
  35: 'a honeydew',
  36: 'a head of romaine',
  37: 'a bunch of Swiss chard',
  38: 'a leek',
  39: 'a small pumpkin',
  40: 'a small watermelon',
};

interface HandCraftedMilestone {
  development: string;
  momTip: string;
  concern?: 'calm' | 'vigilant';
  lossRiskNote?: string;
}

const HAND_CRAFTED: Record<number, HandCraftedMilestone> = {
  1: {
    development: 'LMP week — the pregnancy is dated from here by clinical convention. You are not actually pregnant yet.',
    momTip: 'Start (or continue) prenatal with folate. Hydrate. Log how you feel.',
    concern: 'calm',
  },
  2: {
    development: 'Ovulation window. The egg that will become your baby is being selected.',
    momTip: 'Keep folate, omega-3, and vitamin D steady. Rest when your body asks.',
    concern: 'calm',
  },
  3: {
    development: 'Fertilization and the first cell divisions happen this week — a tiny ball of cells travels toward the uterus.',
    momTip: 'Nothing to do differently. Your body knows.',
    concern: 'calm',
  },
  4: {
    development: 'Implantation. The blastocyst nestles into the uterine lining — hCG begins rising.',
    momTip: 'First week after the missed period. Focus on folate and your prenatal. Be gentle with yourself.',
    concern: 'vigilant',
    lossRiskNote: 'About 1 in 5 known pregnancies end in loss — most of those in the first trimester. This is biology, not something you caused.',
  },
  5: {
    development: 'The neural tube is forming — the earliest scaffolding of the brain and spine.',
    momTip: 'Many people feel nothing yet. Hydrate, rest, and trust. Folate matters most right now.',
    concern: 'vigilant',
    lossRiskNote: 'Early weeks carry real loss risk. If something happens, it is not your fault.',
  },
  6: {
    development: 'The heart begins to flicker — sometimes visible on transvaginal ultrasound around the end of this week.',
    momTip: 'Nausea and fatigue often arrive now. Small frequent meals, protein, and ginger help many people.',
    concern: 'vigilant',
    lossRiskNote: 'Seeing a heartbeat on ultrasound is a real milestone — it meaningfully lowers loss risk going forward.',
  },
  7: {
    development: 'Arm and leg buds form. The heartbeat is usually clearly visible on ultrasound.',
    momTip: 'Nausea may peak this week or next. Whatever keeps food down is the right food.',
    concern: 'vigilant',
  },
  8: {
    development: 'All major organs are present in early form. Your first OB visit often happens around now.',
    momTip: 'Write down questions for your provider. Heartbeat should be clearly audible.',
    concern: 'vigilant',
  },
  9: {
    development: 'The embryo is now officially a fetus in the next week. Tiny fingers and toes are developing.',
    momTip: 'Symptoms can feel heavy. Rest is productive. Ask for help.',
    concern: 'vigilant',
  },
  10: {
    development: 'End of the embryonic phase — from here on, "fetus." Miscarriage risk drops significantly once a healthy heartbeat is confirmed this week.',
    momTip: 'This is often when people start breathing a little easier. NIPT (genetic screening) can be drawn from now.',
    concern: 'vigilant',
    lossRiskNote: 'After 10 weeks with a healthy heartbeat, loss risk falls to roughly 1–2%.',
  },
  11: {
    development: 'Fingernails form. The baby is moving, though you cannot feel it yet.',
    momTip: 'Nausea may begin to ease for some. If it does not, you are not alone.',
    concern: 'calm',
  },
  12: {
    development: 'End of the first trimester. Reflexes develop. Many people choose to share the news around now.',
    momTip: 'Nausea often eases. Energy may return in waves.',
    concern: 'calm',
  },
  13: {
    development: 'Vocal cords, teeth buds, and fingerprints are forming.',
    momTip: 'You may start to feel more like yourself again. Honor that.',
    concern: 'calm',
  },
  14: {
    development: 'Second trimester begins — often called the "honeymoon" phase.',
    momTip: 'Energy often returns. Gentle movement feels good again for most.',
    concern: 'calm',
  },
  15: {
    development: 'Bones are hardening. The baby can sense light through closed lids.',
    momTip: 'Start thinking about whether you want the anatomy scan to reveal baby\'s sex.',
    concern: 'calm',
  },
  16: {
    development: 'Tiny facial expressions. Some people begin to feel the first "flutters."',
    momTip: 'Routine OB check-in week. Ask about any lingering concerns.',
    concern: 'calm',
  },
  17: {
    development: 'Fat stores begin forming. The baby is practicing swallowing.',
    momTip: 'Side-sleeping tends to become more comfortable than back-sleeping from here on.',
    concern: 'calm',
  },
  18: {
    development: 'The baby can hear sounds from outside. Anatomy scan window begins.',
    momTip: 'Anatomy scan is usually 18–22 weeks. You can find out sex if you want.',
    concern: 'calm',
  },
  19: {
    development: 'Vernix (protective coating) develops on the skin.',
    momTip: 'Movement is getting stronger. Start noticing patterns.',
    concern: 'calm',
  },
  20: {
    development: 'Halfway there. Anatomy scan typically happens this week.',
    momTip: 'This is a milestone. Breathe it in.',
    concern: 'calm',
  },
  21: {
    development: 'Taste buds are forming — the baby tastes what you eat through amniotic fluid.',
    momTip: 'Hydrate, and stay on top of iron.',
    concern: 'calm',
  },
  22: {
    development: 'Anatomy scan window closes. Baby looks like a tiny version of a newborn.',
    momTip: 'If something from the scan is weighing on you, write down your questions.',
    concern: 'calm',
  },
  23: {
    development: 'Hearing is well-developed. The baby responds to sounds and your voice.',
    momTip: 'Talk, sing, read — the baby is listening.',
    concern: 'calm',
  },
  24: {
    development: 'Viability milestone. With significant medical support, a baby born now has a real chance of survival.',
    momTip: 'Glucose screening is coming up. Watch for signs of preeclampsia: swelling, vision changes, headaches.',
    concern: 'calm',
  },
  25: {
    development: 'Lungs are developing surfactant — the substance that lets air sacs open at birth.',
    momTip: 'Kick counts can become a daily habit from here on.',
    concern: 'calm',
  },
  26: {
    development: 'Eyes begin to open. Brain activity looks more like a newborn\'s.',
    momTip: 'Talk to your provider about childbirth classes if you haven\'t already.',
    concern: 'calm',
  },
  27: {
    development: 'End of second trimester. The baby can hiccup — you may feel it.',
    momTip: 'Start thinking about your birth preferences. No pressure to decide everything.',
    concern: 'calm',
  },
  28: {
    development: 'Third trimester begins. Glucose tolerance test usually happens around here.',
    momTip: 'Visits shift to every 2 weeks. Rest counts as prep.',
    concern: 'calm',
  },
  29: {
    development: 'Muscles and lungs continue maturing. The baby is getting stronger.',
    momTip: 'Pelvic floor awareness pays off. Gentle walks, good hydration.',
    concern: 'calm',
  },
  30: {
    development: 'The baby\'s brain is developing rapidly — folds and grooves appear.',
    momTip: 'Heartburn is common now. Smaller meals, sit upright after eating.',
    concern: 'calm',
  },
  31: {
    development: 'The baby can turn their head and make coordinated movements.',
    momTip: 'Start thinking about your hospital bag.',
    concern: 'calm',
  },
  32: {
    development: 'The baby is fully formed. From here on, it\'s growth and lung development.',
    momTip: 'Pay attention to fetal movement daily. Any significant decrease — call your provider.',
    concern: 'calm',
  },
  33: {
    development: 'Bones are hardening (except the skull, which stays soft for birth).',
    momTip: 'Sleep when you can. Short naps count.',
    concern: 'calm',
  },
  34: {
    development: 'Lungs are nearly mature. If born now, outcomes are very good.',
    momTip: 'Visits usually shift to weekly soon. Ask what to expect.',
    concern: 'calm',
  },
  35: {
    development: 'The baby is gaining about half a pound a week now.',
    momTip: 'Group B strep test is typically done at 36 weeks — get ready.',
    concern: 'calm',
  },
  36: {
    development: 'Considered early term. Most major development is complete.',
    momTip: 'Hospital bag should be packed. Car seat ready. Let things arrive gently.',
    concern: 'calm',
  },
  37: {
    development: 'Full term. The baby is ready whenever they decide to come.',
    momTip: 'Any day now. Rest, nest, notice. Watch for labor signs: regular contractions, water breaking, bloody show.',
    concern: 'calm',
  },
  38: {
    development: 'Fully developed. Practicing breathing, sucking, blinking.',
    momTip: 'Your body knows. Trust that.',
    concern: 'calm',
  },
  39: {
    development: 'Skin is pink and smooth. Lung development completes this week.',
    momTip: 'Listen inward. Hydrate. Breathe.',
    concern: 'calm',
  },
  40: {
    development: 'Due date week. Only about 1 in 20 babies arrive exactly on their due date.',
    momTip: 'You are so close. Whatever day they come is the right day.',
    concern: 'calm',
  },
};

function milestoneForWeek(week: number): WeeklyMilestone {
  const clamped = Math.max(1, Math.min(42, Math.floor(week)));
  const trimester = trimesterForWeek(clamped);
  const size = SIZES[clamped] ?? (clamped > 40 ? 'a fully grown baby, running late' : 'growing');
  const crafted = HAND_CRAFTED[clamped];

  if (crafted) {
    return {
      week: clamped,
      trimester,
      babySize: size,
      developmentHighlight: crafted.development,
      momTip: crafted.momTip,
      concernLevel: crafted.concern ?? (clamped <= 12 ? 'vigilant' : 'calm'),
      lossRiskNote: crafted.lossRiskNote,
    };
  }

  // Post-term fallback (41–42).
  return {
    week: clamped,
    trimester,
    babySize: size,
    developmentHighlight: 'Fully developed. Your provider will be monitoring closely.',
    momTip: 'Rest. Ask your provider about induction conversations and monitoring.',
    concernLevel: 'vigilant',
  };
}

export function getMilestone(week: number): WeeklyMilestone {
  return milestoneForWeek(week);
}

/** 40 weeks of milestones, used by the timeline view. */
export const PREGNANCY_MILESTONES: WeeklyMilestone[] = Array.from(
  { length: 40 },
  (_, i) => milestoneForWeek(i + 1),
);

// ─────────────────────────────────────────────────────────────────────────────
// Standard US OB appointment schedule
// ─────────────────────────────────────────────────────────────────────────────

export interface AppointmentSuggestion {
  week: number;
  type: PregnancyAppointment['type'];
  title: string;
  description: string;
}

export const APPOINTMENT_SCHEDULE: AppointmentSuggestion[] = [
  {
    week: 8,
    type: 'ob_visit',
    title: 'First OB visit',
    description: 'Confirmation ultrasound, full history, first round of labs.',
  },
  {
    week: 10,
    type: 'blood_draw',
    title: 'NIPT / early genetic screening',
    description: 'Optional non-invasive prenatal testing. A simple blood draw.',
  },
  {
    week: 12,
    type: 'ob_visit',
    title: 'End of first trimester check',
    description: 'Heartbeat confirmation and progress review.',
  },
  {
    week: 16,
    type: 'ob_visit',
    title: 'Second trimester check-in',
    description: 'Routine visit. Heartbeat via Doppler.',
  },
  {
    week: 20,
    type: 'ultrasound',
    title: 'Anatomy scan',
    description: 'Detailed scan of baby\'s growth and organs. Sex can be revealed if you want.',
  },
  {
    week: 24,
    type: 'ob_visit',
    title: 'Check-in',
    description: 'Weight, BP, belly measurement, heartbeat.',
  },
  {
    week: 28,
    type: 'glucose',
    title: 'Glucose tolerance test',
    description: 'Screens for gestational diabetes. Anti-D (RhoGAM) if Rh-negative.',
  },
  {
    week: 32,
    type: 'ob_visit',
    title: 'Check-in',
    description: 'Growth check. Visits begin moving to every 2 weeks.',
  },
  {
    week: 34,
    type: 'ob_visit',
    title: 'Check-in',
    description: 'Position check. Birth plan conversation.',
  },
  {
    week: 36,
    type: 'blood_draw',
    title: 'Group B strep swab',
    description: 'Routine swab to guide antibiotic decisions during labor.',
  },
  {
    week: 37,
    type: 'ob_visit',
    title: 'Weekly visit',
    description: 'Weekly visits begin. Cervical checks start if desired.',
  },
  {
    week: 38,
    type: 'ob_visit',
    title: 'Weekly visit',
    description: 'Weekly check — listening for any signs of labor approaching.',
  },
  {
    week: 39,
    type: 'ob_visit',
    title: 'Weekly visit',
    description: 'Full term. Discuss induction only if medically indicated.',
  },
  {
    week: 40,
    type: 'ob_visit',
    title: 'Due date visit',
    description: 'NST may begin. Post-dates monitoring plan is discussed.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Symptom palettes by trimester
// ─────────────────────────────────────────────────────────────────────────────

export const COMMON_SYMPTOMS_BY_TRIMESTER: Record<1 | 2 | 3, string[]> = {
  1: [
    'Nausea',
    'Vomiting',
    'Fatigue',
    'Breast tenderness',
    'Bloating',
    'Food aversions',
    'Food cravings',
    'Frequent urination',
    'Heightened smell',
    'Headache',
    'Mild cramping',
    'Spotting',
    'Mood swings',
    'Constipation',
  ],
  2: [
    'Fatigue (improving)',
    'Round ligament pain',
    'Heartburn',
    'Back pain',
    'Nasal congestion',
    'Leg cramps',
    'Braxton Hicks',
    'Skin changes',
    'Vivid dreams',
    'Baby movement (flutters)',
    'Headache',
    'Shortness of breath',
    'Constipation',
  ],
  3: [
    'Back pain',
    'Pelvic pressure',
    'Braxton Hicks',
    'Swelling (feet/hands)',
    'Heartburn',
    'Shortness of breath',
    'Insomnia',
    'Frequent urination',
    'Leg cramps',
    'Hemorrhoids',
    'Fatigue',
    'Baby movement (strong)',
    'Nesting urge',
    'Nipple leaking',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Activation helpers (Dexie + localStorage flag)
// ─────────────────────────────────────────────────────────────────────────────

/** Read the fast localStorage flag (no DB hit). */
export function getPregnancyModeFlag(): boolean {
  try {
    return localStorage.getItem(PREGNANCY_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Write the fast localStorage flag. */
export function setPregnancyModeFlag(active: boolean): void {
  try {
    if (active) {
      localStorage.setItem(PREGNANCY_MODE_KEY, 'true');
    } else {
      localStorage.removeItem(PREGNANCY_MODE_KEY);
    }
    // Let any same-tab listeners (Layout, Dashboard) react immediately.
    window.dispatchEvent(new Event('iyla-pregnancy-mode-changed'));
  } catch {
    /* ignore */
  }
}

/** DB-backed truth: is there an active pregnancy record? */
export async function isPregnancyModeActive(): Promise<boolean> {
  const active = await pregnancyDb.pregnancies.where('status').equals('active').first();
  return !!active;
}

/** Get the current active PregnancyRecord, or null. */
export async function getActivePregnancy(): Promise<PregnancyRecord | null> {
  const active = await pregnancyDb.pregnancies.where('status').equals('active').first();
  return active ?? null;
}
