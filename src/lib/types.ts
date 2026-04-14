export type FertilityStatus = 'low' | 'rising' | 'high' | 'peak' | 'confirmed_ovulation' | 'luteal' | 'menstrual';

export type CycleOutcome = 'ongoing' | 'negative' | 'chemical' | 'positive' | 'miscarriage';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export type MucusType = 'dry' | 'sticky' | 'creamy' | 'watery' | 'egg_white' | 'not_checked';

export type MoodType = 'great' | 'good' | 'okay' | 'low' | 'anxious' | 'stressed' | 'emotional';

export type SupplementTiming = 'morning' | 'afternoon' | 'evening' | 'bedtime' | 'with_food' | 'empty_stomach';

export interface User {
  id: string;
  name: string;
  age: number;
  conditions: string[];
  mthfrStatus?: string;
  fertilityGoals: string;
  partnerId?: string;
  createdAt: Date;
}

export interface Cycle {
  id?: number;
  startDate: string; // ISO date
  endDate?: string;
  outcome: CycleOutcome;
  notes?: string;
  ovulationDay?: number;
  follicularPhaseDays?: number;
  lutealPhaseDays?: number;
}

export interface DailyReading {
  id?: number;
  date: string; // ISO date
  cycleId: number;
  cycleDay: number;

  // TempDrop
  bbt?: number;
  sleepScore?: number;
  deepSleepMin?: number;
  sleepInterruptions?: number;

  // Inito
  e3g?: number; // estrogen
  lh?: number;
  pdg?: number; // progesterone metabolite
  fsh?: number;

  // Kegg
  keggImpedance?: number;
  keggScore?: number;

  // Manual observations
  cervicalMucus?: MucusType;
  cervicalPosition?: string;
  mood?: MoodType;
  energy?: number; // 1-5
  symptoms?: string[];
  notes?: string;

  // Intercourse
  intercourse?: boolean;
  intercourseTime?: string;
  intercourseNotes?: string;

  // Computed
  fertilityStatus?: FertilityStatus;
}

export interface LabResult {
  id?: number;
  date: string;
  testName: string;
  category: string;
  value: number;
  unit: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  optimalRangeLow?: number;
  optimalRangeHigh?: number;
  notes?: string;
  source?: string;
}

export interface Supplement {
  id?: number;
  name: string;
  brand?: string;
  dose: string;
  timing: SupplementTiming[];
  mechanism?: string;
  cyclePhaseRules?: string;
  isActive: boolean;
  protocolId?: number;
  sortOrder: number;
}

export interface SupplementProtocol {
  id?: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SupplementLog {
  id?: number;
  date: string;
  supplementId: number;
  taken: boolean;
  timing: SupplementTiming;
  notes?: string;
}

// Lab test definitions with optimal fertility ranges
export const LAB_DEFINITIONS: Record<string, {
  category: string;
  unit: string;
  refLow: number;
  refHigh: number;
  optimalLow: number;
  optimalHigh: number;
}> = {
  'AMH': { category: 'Fertility Hormones', unit: 'ng/mL', refLow: 0.7, refHigh: 3.5, optimalLow: 1.0, optimalHigh: 3.5 },
  'FSH (Baseline)': { category: 'Fertility Hormones', unit: 'mIU/mL', refLow: 3.5, refHigh: 12.5, optimalLow: 3.5, optimalHigh: 8.0 },
  'LH (Baseline)': { category: 'Fertility Hormones', unit: 'mIU/mL', refLow: 2.4, refHigh: 12.6, optimalLow: 2.4, optimalHigh: 6.0 },
  'Estradiol': { category: 'Fertility Hormones', unit: 'pg/mL', refLow: 12, refHigh: 150, optimalLow: 25, optimalHigh: 75 },
  'Progesterone': { category: 'Fertility Hormones', unit: 'ng/mL', refLow: 1.8, refHigh: 24, optimalLow: 10, optimalHigh: 24 },
  'Prolactin': { category: 'Fertility Hormones', unit: 'ng/mL', refLow: 4.8, refHigh: 23.3, optimalLow: 4.8, optimalHigh: 15 },
  'DHEA-S': { category: 'Fertility Hormones', unit: 'µg/dL', refLow: 35, refHigh: 430, optimalLow: 150, optimalHigh: 350 },
  'SHBG': { category: 'Fertility Hormones', unit: 'nmol/L', refLow: 18, refHigh: 144, optimalLow: 40, optimalHigh: 100 },
  'Total Testosterone': { category: 'Fertility Hormones', unit: 'ng/dL', refLow: 15, refHigh: 70, optimalLow: 20, optimalHigh: 50 },
  'Free Testosterone': { category: 'Fertility Hormones', unit: 'pg/mL', refLow: 0.3, refHigh: 1.9, optimalLow: 0.5, optimalHigh: 1.5 },
  'TSH': { category: 'Thyroid', unit: 'mIU/L', refLow: 0.45, refHigh: 4.5, optimalLow: 1.0, optimalHigh: 2.5 },
  'Free T3': { category: 'Thyroid', unit: 'pg/mL', refLow: 2.0, refHigh: 4.4, optimalLow: 3.0, optimalHigh: 4.0 },
  'Free T4': { category: 'Thyroid', unit: 'ng/dL', refLow: 0.82, refHigh: 1.77, optimalLow: 1.0, optimalHigh: 1.5 },
  'Reverse T3': { category: 'Thyroid', unit: 'ng/dL', refLow: 9.2, refHigh: 24.1, optimalLow: 9.2, optimalHigh: 18 },
  'TPO Antibodies': { category: 'Thyroid', unit: 'IU/mL', refLow: 0, refHigh: 34, optimalLow: 0, optimalHigh: 15 },
  'Fasting Insulin': { category: 'Metabolic', unit: 'µIU/mL', refLow: 2.6, refHigh: 24.9, optimalLow: 2.6, optimalHigh: 8 },
  'HbA1c': { category: 'Metabolic', unit: '%', refLow: 4.0, refHigh: 5.6, optimalLow: 4.5, optimalHigh: 5.3 },
  'Fasting Glucose': { category: 'Metabolic', unit: 'mg/dL', refLow: 65, refHigh: 99, optimalLow: 70, optimalHigh: 85 },
  'Vitamin D': { category: 'Nutritional', unit: 'ng/mL', refLow: 30, refHigh: 100, optimalLow: 50, optimalHigh: 80 },
  'Ferritin': { category: 'Nutritional', unit: 'ng/mL', refLow: 12, refHigh: 150, optimalLow: 40, optimalHigh: 100 },
  'B12': { category: 'Nutritional', unit: 'pg/mL', refLow: 200, refHigh: 900, optimalLow: 500, optimalHigh: 900 },
  'Folate': { category: 'Nutritional', unit: 'ng/mL', refLow: 2.7, refHigh: 17, optimalLow: 10, optimalHigh: 17 },
  'Zinc': { category: 'Nutritional', unit: 'µg/dL', refLow: 60, refHigh: 120, optimalLow: 80, optimalHigh: 110 },
  'Selenium': { category: 'Nutritional', unit: 'µg/L', refLow: 70, refHigh: 150, optimalLow: 100, optimalHigh: 140 },
  'Homocysteine': { category: 'Nutritional', unit: 'µmol/L', refLow: 4, refHigh: 15, optimalLow: 5, optimalHigh: 8 },
  'hs-CRP': { category: 'Inflammatory', unit: 'mg/L', refLow: 0, refHigh: 3, optimalLow: 0, optimalHigh: 1 },
};

export const SYMPTOM_OPTIONS = [
  'Breast tenderness', 'Bloating', 'Cramping', 'Headache', 'Fatigue',
  'Nausea', 'Back pain', 'Acne', 'Spotting', 'Hot flashes',
  'Insomnia', 'Vivid dreams', 'Increased libido', 'Decreased libido',
  'Cervical pain', 'Ovulation pain (mittelschmerz)', 'Joint pain',
];

export const PRESET_PROTOCOLS: Omit<SupplementProtocol, 'id' | 'isActive' | 'createdAt'>[] = [
  { name: 'Age 35-39 Baseline', description: 'Foundation protocol for women 35-39 TTC' },
  { name: 'Age 40+ Egg Quality', description: 'Aggressive egg quality optimization for 40+' },
  { name: 'Low AMH / Diminished Reserve', description: 'Protocol for women with low AMH or DOR diagnosis' },
  { name: 'IVF Preparation (8-12 weeks)', description: 'Pre-retrieval optimization protocol' },
  { name: 'PCOS Protocol', description: 'Insulin sensitization and hormone balancing' },
  { name: 'MTHFR Variant', description: 'Methylation-optimized protocol for MTHFR carriers' },
  { name: 'Male Factor', description: 'Sperm quality optimization protocol' },
  { name: 'Mitochondrial Restoration', description: 'Mitochondrial support for egg and sperm quality' },
];

export const PRESET_SUPPLEMENTS: Record<string, Omit<Supplement, 'id' | 'isActive' | 'protocolId' | 'sortOrder'>[]> = {
  'Age 40+ Egg Quality': [
    { name: 'CoQ10 (Ubiquinol)', dose: '600mg', timing: ['morning', 'evening'], mechanism: 'Mitochondrial energy production, egg quality', cyclePhaseRules: 'Take throughout cycle' },
    { name: 'NMN (Nicotinamide Mononucleotide)', dose: '500mg', timing: ['morning'], mechanism: 'NAD+ precursor, cellular repair', cyclePhaseRules: 'Pause during TWW if desired' },
    { name: 'PQQ', dose: '20mg', timing: ['morning'], mechanism: 'Mitochondrial biogenesis' },
    { name: 'Methylfolate', dose: '1000mcg', timing: ['morning'], mechanism: 'Neural tube prevention, methylation support' },
    { name: 'Vitamin D3 + K2', dose: '5000 IU / 100mcg', timing: ['morning'], mechanism: 'Immune regulation, implantation support' },
    { name: 'Omega-3 (EPA/DHA)', dose: '2000mg', timing: ['morning', 'evening'], mechanism: 'Anti-inflammatory, egg membrane quality' },
    { name: 'DHEA (Micronized)', dose: '25mg', timing: ['morning', 'afternoon', 'evening'], mechanism: 'Androgen precursor, follicular development', cyclePhaseRules: 'Stop upon positive pregnancy test' },
    { name: 'Melatonin', dose: '3mg', timing: ['bedtime'], mechanism: 'Antioxidant protection of eggs, sleep', cyclePhaseRules: 'CD3 through ovulation, then reduce to 0.5mg' },
    { name: 'Selenium (Selenomethionine)', dose: '200mcg', timing: ['afternoon'], mechanism: 'Thyroid support, antioxidant' },
    { name: 'Vitamin E (Mixed Tocopherols)', dose: '400 IU', timing: ['evening'], mechanism: 'Antioxidant, endometrial thickness' },
    { name: 'NAC (N-Acetyl Cysteine)', dose: '600mg', timing: ['morning', 'evening'], mechanism: 'Glutathione precursor, egg quality' },
    { name: 'Alpha Lipoic Acid', dose: '600mg', timing: ['morning'], mechanism: 'Antioxidant recycling, insulin sensitivity' },
    { name: 'Magnesium Glycinate', dose: '400mg', timing: ['bedtime'], mechanism: 'Progesterone support, sleep, muscle relaxation' },
    { name: 'Prenatal Multi', dose: '1 serving', timing: ['morning'], mechanism: 'Baseline micronutrient coverage' },
  ],
  'Age 35-39 Baseline': [
    { name: 'CoQ10 (Ubiquinol)', dose: '400mg', timing: ['morning', 'evening'], mechanism: 'Mitochondrial energy production' },
    { name: 'Methylfolate', dose: '800mcg', timing: ['morning'], mechanism: 'Neural tube prevention, methylation' },
    { name: 'Vitamin D3 + K2', dose: '4000 IU / 100mcg', timing: ['morning'], mechanism: 'Immune regulation' },
    { name: 'Omega-3 (EPA/DHA)', dose: '2000mg', timing: ['morning'], mechanism: 'Anti-inflammatory' },
    { name: 'Magnesium Glycinate', dose: '300mg', timing: ['bedtime'], mechanism: 'Progesterone support, sleep' },
    { name: 'Prenatal Multi', dose: '1 serving', timing: ['morning'], mechanism: 'Baseline micronutrient coverage' },
    { name: 'Selenium', dose: '100mcg', timing: ['afternoon'], mechanism: 'Thyroid support' },
    { name: 'Vitamin E', dose: '200 IU', timing: ['evening'], mechanism: 'Antioxidant' },
  ],
};
