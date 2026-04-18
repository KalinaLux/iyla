import type { MedicationFormulation, PregnancyCategory } from './medications-db';

export interface CommonMedication {
  name: string;
  genericName?: string;
  typical_dose: string;
  typical_formulation: MedicationFormulation;
  typical_frequency: string;
  common_reason: string;
  category: PregnancyCategory;
}

/**
 * A reference list of the most common fertility / early-pregnancy medications.
 * Doses, frequencies, and pregnancy categories are *typical* starting points —
 * always defer to the prescribing clinician.
 */
export const COMMON_MEDICATIONS: CommonMedication[] = [
  {
    name: 'Progesterone',
    genericName: 'Crinone / Prometrium / Endometrin',
    typical_dose: '200mg',
    typical_formulation: 'vaginal_suppository',
    typical_frequency: 'Twice daily (morning and bedtime)',
    common_reason: 'Luteal phase support / early pregnancy support',
    category: 'B',
  },
  {
    name: 'Metformin',
    genericName: 'Glucophage',
    typical_dose: '500mg',
    typical_formulation: 'tablet',
    typical_frequency: 'Twice daily with meals',
    common_reason: 'PCOS / insulin sensitivity',
    category: 'B',
  },
  {
    name: 'Letrozole',
    genericName: 'Femara',
    typical_dose: '2.5mg',
    typical_formulation: 'tablet',
    typical_frequency: 'Once daily, cycle days 3–7 or 5–9',
    common_reason: 'Ovulation induction',
    category: 'X',
  },
  {
    name: 'Clomiphene',
    genericName: 'Clomid / Serophene',
    typical_dose: '50mg',
    typical_formulation: 'tablet',
    typical_frequency: 'Once daily, cycle days 3–7 or 5–9',
    common_reason: 'Ovulation induction',
    category: 'X',
  },
  {
    name: 'Gonadotropins',
    genericName: 'Gonal-F / Follistim / Menopur',
    typical_dose: '75–300 IU',
    typical_formulation: 'injection',
    typical_frequency: 'Subcutaneous, daily during IVF stim',
    common_reason: 'IVF ovarian stimulation',
    category: 'X',
  },
  {
    name: 'hCG trigger',
    genericName: 'Novarel / Ovidrel / Pregnyl',
    typical_dose: '250mcg (Ovidrel) or 10,000 IU',
    typical_formulation: 'injection',
    typical_frequency: 'Single trigger dose, ~36 hours before retrieval or IUI',
    common_reason: 'Ovulation trigger',
    category: 'X',
  },
  {
    name: 'Lupron',
    genericName: 'Leuprolide',
    typical_dose: '10–20 units',
    typical_formulation: 'injection',
    typical_frequency: 'Subcutaneous, daily during IVF suppression',
    common_reason: 'IVF suppression / trigger',
    category: 'X',
  },
  {
    name: 'Estradiol',
    genericName: 'Estrace / Vivelle / Climara',
    typical_dose: '2mg',
    typical_formulation: 'tablet',
    typical_frequency: 'Twice daily (oral) or patch changed 2x/week',
    common_reason: 'Hormone support for FET / luteal support',
    category: 'X',
  },
  {
    name: 'Baby aspirin',
    genericName: 'Acetylsalicylic acid',
    typical_dose: '81mg',
    typical_formulation: 'tablet',
    typical_frequency: 'Once daily',
    common_reason: 'Uterine blood flow / recurrent loss prevention',
    category: 'C',
  },
  {
    name: 'Synthroid',
    genericName: 'Levothyroxine',
    typical_dose: '50–100mcg',
    typical_formulation: 'tablet',
    typical_frequency: 'Once daily, empty stomach, 30+ min before food',
    common_reason: 'Hypothyroidism / fertility-optimized TSH',
    category: 'A',
  },
  {
    name: 'Prednisone',
    genericName: 'Deltasone',
    typical_dose: '10–20mg',
    typical_formulation: 'tablet',
    typical_frequency: 'Once daily around transfer',
    common_reason: 'Immune modulation (IVF / recurrent loss protocols)',
    category: 'C',
  },
  {
    name: 'Lovenox',
    genericName: 'Enoxaparin / Heparin',
    typical_dose: '40mg',
    typical_formulation: 'injection',
    typical_frequency: 'Subcutaneous, once or twice daily',
    common_reason: 'Anticoagulation (thrombophilia / recurrent loss)',
    category: 'B',
  },
];

/** Return a medication reference by name (case-insensitive, partial match). */
export function findCommonMedication(query: string): CommonMedication | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return (
    COMMON_MEDICATIONS.find((m) => m.name.toLowerCase() === q) ??
    COMMON_MEDICATIONS.find((m) => m.name.toLowerCase().includes(q)) ??
    COMMON_MEDICATIONS.find((m) => m.genericName?.toLowerCase().includes(q))
  );
}

export const FORMULATION_LABELS: Record<MedicationFormulation, string> = {
  pill: 'Pill',
  capsule: 'Capsule',
  tablet: 'Tablet',
  injection: 'Injection',
  vaginal_suppository: 'Vaginal suppository',
  cream: 'Cream',
  patch: 'Patch',
  liquid: 'Liquid',
  other: 'Other',
};
