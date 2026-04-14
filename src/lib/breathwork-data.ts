export interface BreathPattern {
  type: 'box' | '4-7-8' | 'coherent' | 'extended-exhale' | 'alternate-nostril' | 'physiological-sigh' | 'aquaaria';
  inhale: number;
  holdIn?: number;
  exhale: number;
  holdOut?: number;
  cycles: number;
}

export interface BreathworkSession {
  id: string;
  name: string;
  duration: number;
  description: string;
  cyclePhases: string[];
  pattern: BreathPattern;
  category: 'regulation' | 'relaxation' | 'sleep' | 'anxiety' | 'couples' | 'pre-procedure';
  benefit: string;
  aquaariaNotes?: string;
}

export const BREATHWORK_SESSIONS: BreathworkSession[] = [
  {
    id: 'aquaaria-couples',
    name: 'AquaAria — Breathe Together',
    duration: 10,
    description:
      'From The Algorithm of Faith by Kalina Lux. Sit facing your partner, close your eyes, and breathe in unison — slowly in through the nose, slowly out through the nose. Let the rhythm synchronize your nervous systems without a single word.',
    cyclePhases: ['any'],
    pattern: { type: 'aquaaria', inhale: 6, exhale: 12, cycles: 33 },
    category: 'couples',
    benefit: 'Nervous system synchronization with your partner',
    aquaariaNotes: 'The inhale is a gift received. The exhale is an offering — a surrender into unity. Breathe only through the nose. Silent. Slow. Together.',
  },
  {
    id: 'aquaaria-foundation',
    name: 'AquaAria — Sacred Breath',
    duration: 10,
    description:
      'The foundational AquaAria practice: slow nasal breathing at a 1:2 ratio. Start at 5 seconds in, 10 seconds out. As your capacity builds, extend toward 25 in, 35 out. Each breath is a prayer.',
    cyclePhases: ['any'],
    pattern: { type: 'aquaaria', inhale: 5, exhale: 10, cycles: 40 },
    category: 'regulation',
    benefit: 'Foundational parasympathetic regulation & cortisol reduction',
    aquaariaNotes: 'Nose only, always. The exhale activates the parasympathetic nervous system. Focus on making it longer, smoother, and quieter than the inhale. Consistency over perfection.',
  },
  {
    id: 'morning-regulation',
    name: 'Morning Regulation',
    duration: 5,
    description:
      'Slow nasal coherent breathing to activate the parasympathetic nervous system. Ideal before morning temperature readings or OPK testing.',
    cyclePhases: ['follicular', 'ovulatory'],
    pattern: { type: 'coherent', inhale: 5, exhale: 5, cycles: 30 },
    category: 'regulation',
    benefit: 'Parasympathetic activation before testing',
    aquaariaNotes: 'In through the nose, out through the nose. Keep breaths silent and smooth.',
  },
  {
    id: 'fertile-window-calm',
    name: 'Fertile Window Calm',
    duration: 10,
    description:
      'Extended nasal exhale engages the vagus nerve and shifts your body out of fight-or-flight. Use before intimacy to release performance pressure.',
    cyclePhases: ['ovulatory'],
    pattern: { type: 'extended-exhale', inhale: 4, exhale: 7, cycles: 43 },
    category: 'relaxation',
    benefit: 'Pre-intimacy nervous system calming',
    aquaariaNotes: 'Breathe only through your nose. The longer exhale lowers cortisol and calms the amygdala.',
  },
  {
    id: 'tww-grounding',
    name: 'TWW Grounding',
    duration: 7,
    description:
      'Box breathing through the nose creates a steady, predictable rhythm that interrupts anxious thought loops. Your anchor during the two-week wait.',
    cyclePhases: ['luteal'],
    pattern: { type: 'box', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, cycles: 26 },
    category: 'anxiety',
    benefit: 'Anti-anxiety for the two-week wait',
    aquaariaNotes: 'Nose only. The predictable rhythm tells your nervous system it is safe.',
  },
  {
    id: 'pre-appointment-calm',
    name: 'Pre-Appointment Calm',
    duration: 5,
    description:
      'The 4-7-8 pattern acts as a natural tranquilizer for the nervous system. All through the nose. Use before your RE visit, IUI, or IVF procedures.',
    cyclePhases: ['any'],
    pattern: { type: '4-7-8', inhale: 4, holdIn: 7, exhale: 8, cycles: 16 },
    category: 'pre-procedure',
    benefit: 'Calm before RE visits, IUI, IVF procedures',
    aquaariaNotes: 'Inhale nose, exhale nose. The long hold builds CO₂ tolerance, enhancing oxygen delivery to your cells.',
  },
  {
    id: 'sleep-preparation',
    name: 'Sleep Preparation',
    duration: 15,
    description:
      'A slow, extended nasal exhale that pairs with your body\'s natural melatonin timing. Place one hand on your chest, one on your belly. Let the day dissolve with each breath out.',
    cyclePhases: ['luteal', 'any'],
    pattern: { type: 'extended-exhale', inhale: 6, exhale: 10, cycles: 56 },
    category: 'sleep',
    benefit: 'Evening wind-down pairs with melatonin timing',
    aquaariaNotes: 'Nose breathing only. Feel your abdomen rise on the inhale, fall on the exhale. Silent. Smooth. Slow.',
  },
  {
    id: 'physiological-reset',
    name: 'Physiological Reset',
    duration: 3,
    description:
      'A double inhale through the nose followed by a long nasal exhale — the fastest known method to reduce real-time stress, discovered by Stanford researchers.',
    cyclePhases: ['any'],
    pattern: { type: 'physiological-sigh', inhale: 3, exhale: 7, cycles: 12 },
    category: 'regulation',
    benefit: 'Fastest known method to reduce acute stress',
    aquaariaNotes: 'Both inhale and exhale through the nose. The double inhale pops open collapsed alveoli, maximizing gas exchange.',
  },
  {
    id: 'cycle-day-1-comfort',
    name: 'Cycle Day 1 Comfort',
    duration: 7,
    description:
      'A gentle, warming nasal breath practice focused on softening and letting go. Honor the beginning of a new cycle with compassion.',
    cyclePhases: ['menstrual'],
    pattern: { type: 'extended-exhale', inhale: 3, exhale: 6, cycles: 47 },
    category: 'relaxation',
    benefit: 'Gentle, warming, focused on letting go',
    aquaariaNotes: 'Nose only. With each exhale, surrender any lingering thoughts or worries.',
  },
];
