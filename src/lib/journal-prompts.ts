import type { EmotionalTone } from './journal-db';

export type CyclePhaseKey =
  | 'menstrual'
  | 'follicular'
  | 'ovulatory'
  | 'luteal'
  | 'unknown';

export interface PromptSet {
  /** Brief context phrase shown at the top of the journal. */
  phaseContext: string;
  /** Morning prompts — 2 questions. */
  morning: string[];
  /** Evening prompts — 3 questions, the final one is a gratitude prompt. */
  evening: string[];
  /** Affirmation / soft encouragement shown before the Save button. */
  affirmation: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Phase-aware prompt pools
//
// Each phase has a pool of morning/evening variants. `getPromptVariant` picks
// one pair deterministically per `dateSeed`, so:
//   • the same date always shows the same prompts (restarts don't reshuffle)
//   • morning and evening of the same day come from the same "day-slot"
//   • a new day offers a fresh set
// ───────────────────────────────────────────────────────────────────────────

interface PhasePool {
  phaseContext: string;
  affirmation: string;
  morning: Array<[string, string]>; // pairs of 2 prompts
  evening: Array<[string, string, string]>; // triples (3rd is gratitude)
}

const MENSTRUAL: PhasePool = {
  phaseContext:
    "You're in the rest phase. Your body is shedding, releasing, renewing — nothing is wrong. Be gentle.",
  affirmation: 'You are resting in wisdom. Your body is renewing.',
  morning: [
    [
      'What does your body need today to feel supported?',
      'What one small thing can you let go of this morning?',
    ],
    [
      'Where in your body do you feel the most tender?',
      'What would it look like to move slower today?',
    ],
    [
      'If today asked nothing of you, what would you choose?',
      'What warmth — food, blanket, tea, sunlight — is calling to you?',
    ],
    [
      'What emotion is quietly asking to be felt today?',
      'Who or what can you say "no" to, to protect your rest?',
    ],
    [
      'What does your body most want to rest from?',
      'What prayer or quiet word can you carry into today?',
    ],
  ],
  evening: [
    [
      'What moment today felt truly restful?',
      'What did your body ask for, and did you listen?',
      "Name one thing you're grateful for, however small.",
    ],
    [
      'Where did you allow yourself to soften today?',
      'What did you release — even silently — that you no longer need?',
      'Name one small comfort you received today.',
    ],
    [
      'What did stillness teach you today?',
      'What emotion moved through you, and what did it want you to know?',
      'Name one tenderness, from yourself or another.',
    ],
    [
      'How did you honor your body today?',
      "What didn't you do today — and was that a gift?",
      "Name one quiet grace you noticed today.",
    ],
    [
      'What part of the day felt most like being held?',
      'What did you choose not to carry today?',
      'Name one thing your body thanked you for.',
    ],
  ],
};

const FOLLICULAR: PhasePool = {
  phaseContext:
    "You're in the building phase. Estrogen is rising; so is your curiosity. Trust that upward pull — gently.",
  affirmation: 'You are rising. Your body is building strength.',
  morning: [
    [
      "What's one thing you're curious about today?",
      "What's your body's creative energy asking of you?",
    ],
    [
      'Where do you feel a quiet yes forming inside you?',
      "What's one small experiment you can try today?",
    ],
    [
      'What idea keeps returning to you — and deserves a little space?',
      'What would feel nourishing to learn or make today?',
    ],
    [
      "What's one old story you're ready to outgrow?",
      "Where can you follow your energy instead of pushing against it?",
    ],
    [
      'What does your body feel ready for today?',
      "If today were a blank page, what's the first word you'd write?",
    ],
  ],
  evening: [
    [
      'What did you create, learn, or explore today?',
      'When did you feel most alive today?',
      'What are you grateful for right now?',
    ],
    [
      'What surprised you today — in a good way?',
      'What did you say yes to that felt honest?',
      'Name one gift today offered.',
    ],
    [
      'Where did your curiosity lead you today?',
      'What new possibility opened, even a crack?',
      'Name one small spark of gratitude.',
    ],
    [
      'What did you build today — inside or out?',
      'When did you feel your own momentum?',
      'Name one thing worth thanking today for.',
    ],
    [
      'What idea took root today?',
      'Where did you notice your own strength returning?',
      'Name one gratitude rising in you now.',
    ],
  ],
};

const OVULATORY: PhasePool = {
  phaseContext:
    "You're in the peak phase. Your body is radiant, open, knowing. Receive it — this is holy ground.",
  affirmation: 'You are radiant. Your body is at its peak knowing.',
  morning: [
    [
      'Who or what do you want to connect with today?',
      "What's your highest intention for today?",
    ],
    [
      'How do you want to be received today?',
      "What's one way you can say yes to your own aliveness?",
    ],
    [
      'What love wants to move through you today?',
      "If your body is speaking clearly today, what is it saying?",
    ],
    [
      'What does your most radiant self want you to know this morning?',
      'Who in your life deserves a little more of your presence today?',
    ],
    [
      'What would it feel like to lead with openness today?',
      'What are you ready to receive that you usually push away?',
    ],
  ],
  evening: [
    [
      'What connection felt most nourishing today?',
      'How did you feel in your body today?',
      'What gift did today give you?',
    ],
    [
      'Where did you feel most fully yourself today?',
      'What beauty did you notice — in you, or around you?',
      'Name one thing you want to remember from today.',
    ],
    [
      'Who did you love well today — including yourself?',
      'What felt most alive in your body?',
      'Name one gratitude that feels especially bright.',
    ],
    [
      'What did your openness make possible today?',
      'When did you feel truly seen?',
      'Name one blessing from this day.',
    ],
    [
      'What did your radiance touch today?',
      'What moment do you want to bless and keep?',
      'Name one gratitude rising in you now.',
    ],
  ],
};

const LUTEAL: PhasePool = {
  phaseContext:
    "You're in the reflection phase. Things may feel bigger now — that's the integration, not the problem. Be tender.",
  affirmation: 'You are deepening. Your body is integrating all you have carried.',
  morning: [
    [
      'What feelings are moving through you this morning?',
      'What does tenderness with yourself look like today?',
    ],
    [
      'What needs a slower pace today?',
      'Where can you choose softness over striving?',
    ],
    [
      "What's the most caring thing you can do for yourself this morning?",
      'What emotion is asking for a little more space today?',
    ],
    [
      'What boundary will protect your nervous system today?',
      "What's one small ritual of comfort you can begin with?",
    ],
    [
      'What part of you is asking to be met with kindness?',
      'What can you put down today so you can carry what matters?',
    ],
  ],
  evening: [
    [
      'What emotion surprised you today?',
      'What did you need more of today?',
      "What's one small win you can honor?",
    ],
    [
      'Where did you meet yourself with tenderness today?',
      'What quietly asked to be felt?',
      'Name one thing you want to thank yourself for.',
    ],
    [
      'What did you carry today that was heavier than it looked?',
      'What small mercy did you give yourself?',
      'Name one soft gratitude from the day.',
    ],
    [
      'What boundary held you well today?',
      'What feeling, once felt, softened a little?',
      'Name one thing you can honor, however small.',
    ],
    [
      'What did your sensitivity teach you today?',
      'Where did you choose yourself today?',
      'Name one quiet grace you received.',
    ],
  ],
};

const UNKNOWN: PhasePool = {
  phaseContext:
    "You're exactly where you need to be. Let the page meet you — no performance required.",
  affirmation: 'You are exactly where you need to be.',
  morning: [
    [
      'How do you want to feel today?',
      "What's one small kindness you can offer yourself?",
    ],
    [
      "What's one thing your body is asking for?",
      'What would make today feel a little more gentle?',
    ],
    [
      "What's true for you right now, without editing?",
      "What's one small thing worth showing up for?",
    ],
    [
      'What do you want to remember today?',
      'What can you set down before you begin?',
    ],
    [
      'What would loving yourself look like today?',
      "What's a prayer, word, or breath you can carry into the day?",
    ],
  ],
  evening: [
    [
      'What was the best part of today?',
      'What emotion needs more space tomorrow?',
      'Name one gratitude, however quiet.',
    ],
    [
      'What was harder than expected today?',
      'What was softer than expected?',
      'Name one thing worth thanking today for.',
    ],
    [
      'What did today try to teach you?',
      'What would you tell your morning self about how this day went?',
      'Name one grace you received.',
    ],
    [
      'What did you notice about yourself today?',
      'What moment do you want to keep?',
      'Name one quiet gratitude.',
    ],
    [
      'What did your body ask for today?',
      "What's one thing that helped, even a little?",
      'Name one gratitude rising now.',
    ],
  ],
};

const POOLS: Record<CyclePhaseKey, PhasePool> = {
  menstrual: MENSTRUAL,
  follicular: FOLLICULAR,
  ovulatory: OVULATORY,
  luteal: LUTEAL,
  unknown: UNKNOWN,
};

/** Returns the first variant of each pool for a phase (stable default). */
export function getPromptSet(phase: CyclePhaseKey): PromptSet {
  const pool = POOLS[phase] ?? POOLS.unknown;
  return {
    phaseContext: pool.phaseContext,
    morning: [...pool.morning[0]],
    evening: [...pool.evening[0]],
    affirmation: pool.affirmation,
  };
}

/**
 * Deterministic per-day variant. Morning and evening of the same day hit
 * the same pool index, so the questions feel like a matched pair. The seed
 * should be the entry's `date` (yyyy-mm-dd).
 */
export function getPromptVariant(
  phase: CyclePhaseKey,
  dateSeed: string,
  kind: 'morning' | 'evening',
): string[] {
  const pool = POOLS[phase] ?? POOLS.unknown;
  const bucket = kind === 'morning' ? pool.morning : pool.evening;
  if (bucket.length === 0) return [];
  const idx = hashSeed(dateSeed) % bucket.length;
  return [...bucket[idx]];
}

/** Soft closing message shown after a save. Adapts to tone if given. */
export function getClosingMessage(tone?: EmotionalTone): string {
  switch (tone) {
    case 'radiant':
      return 'Held and honored. Carry this light gently.';
    case 'calm':
      return "Thank you for this stillness. It's safe here.";
    case 'neutral':
      return 'Saved. Just being here is enough today.';
    case 'heavy':
      return 'You were brave to write this. Set it down — the page will hold it.';
    case 'anxious':
      return 'One breath in, one breath out. You did a kind thing for yourself.';
    case 'grieving':
      return "What you carry is real and witnessed. You're not alone on this page.";
    default:
      return 'Saved with care. Come back whenever you need.';
  }
}

// Simple deterministic seed hash (djb2-ish, ASCII-only is fine here).
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
