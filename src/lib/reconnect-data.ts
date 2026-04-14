import Dexie, { type EntityTable } from 'dexie';

// ─── DATABASE ───

export interface ReconnectProfile {
  id?: number;
  role: 'her' | 'partner';
  onboardingComplete: boolean;
  currentStage: number;
  intimacyLevel: string;
  ttcFeeling: string;
  pastExperiences: string;
  goal: string;
  sessionLength: number;
  ambientSound: string;
  reminderFrequency: string;
  showOnDashboard: boolean;
  partnerNotifications: boolean;
  createdAt: string;
}

export interface ReconnectSession {
  id?: number;
  date: string;
  stage: number;
  durationMin: number;
  completed: boolean;
  ambientSoundUsed: string;
  observationHer?: string;
  observationPartner?: string;
  moodHer?: number;
  moodPartner?: number;
  oneWordHer?: string;
  oneWordPartner?: string;
  includedIntercourse?: boolean;
  createdAt: string;
}

const reconnectDb = new Dexie('IylaReconnectDB') as Dexie & {
  profiles: EntityTable<ReconnectProfile, 'id'>;
  sessions: EntityTable<ReconnectSession, 'id'>;
};

reconnectDb.version(1).stores({
  profiles: '++id, role',
  sessions: '++id, date, stage, completed',
});

export { reconnectDb };

// ─── STAGE DEFINITIONS ───

export interface StageDefinition {
  number: number;
  title: string;
  subtitle: string;
  duration: string;
  unlockText: string;
  requiredSessions: number;
  color: string;
  gradient: string;
  emoji: string;
  description: string;
  rules: string[];
  toucherGuide: string[];
  receiverGuide: string[];
  togetherGuide?: string[];
  afterSession: string;
  postPrompt: string;
  traumaNote?: string;
}

export const STAGES: StageDefinition[] = [
  {
    number: 1,
    title: 'Non-Sexual Touch',
    subtitle: 'Exploration without agenda',
    duration: '1-2 weeks (minimum 3 sessions)',
    unlockText: 'Available now',
    requiredSessions: 3,
    color: 'text-teal-600',
    gradient: 'from-teal-400 to-cyan-500',
    emoji: '🤲',
    description: 'Touch is exploratory, not goal-oriented. Genitals and breasts are off limits. No expectation of arousal. Sessions are 20-30 minutes — take turns touching and receiving.',
    rules: [
      'Touch is exploratory, not goal-oriented',
      'Genitals and breasts are OFF LIMITS during this stage',
      'No expectation of arousal or sexual activity',
      'Either partner can pause at any time — no explanation needed',
      'Take turns: one touches while the other receives, then switch',
      'The toucher focuses on what THEY find interesting',
      'The receiver focuses on noticing sensation without judging it',
    ],
    toucherGuide: [
      'You are exploring, not performing',
      'Touch hands, arms, shoulders, back, neck, face, scalp, legs, feet',
      'Vary your touch — light fingertips, full palm, different speeds',
      'Notice what textures, temperatures, and contours feel interesting to YOUR hands',
      'You are not trying to make your partner feel good — you are discovering their body with curiosity',
      'If your mind wanders to goals or outcomes, gently bring it back to what your hands are feeling',
    ],
    receiverGuide: [
      'Your only job is to notice',
      'Notice where you feel the touch most clearly',
      'Notice what feels pleasant, neutral, or uncomfortable',
      'If something is uncomfortable, say "softer" or "move on"',
      'You do not need to perform enjoyment',
      'Let yourself simply receive without owing anything in return',
    ],
    afterSession: 'Share one thing you noticed — not "that was good/bad" but something specific like "I noticed that touching your shoulders, I could feel the tension you carry" or "I relaxed most when you touched my scalp."',
    postPrompt: 'What did you notice during this session?',
  },
  {
    number: 2,
    title: 'Expanded Touch',
    subtitle: 'Including breasts and genitals',
    duration: '1-2 weeks (minimum 3 sessions)',
    unlockText: 'Complete 3 Stage 1 sessions',
    requiredSessions: 3,
    color: 'text-violet-600',
    gradient: 'from-violet-400 to-purple-500',
    emoji: '💜',
    description: 'Breasts and genitals are now included in the exploration. ALL Stage 1 rules still apply — this is still exploratory, not goal-oriented. No expectation of arousal, orgasm, or intercourse.',
    rules: [
      'Breasts and genitals are now included in exploration',
      'ALL Stage 1 rules still apply — still exploratory',
      'No expectation of arousal, orgasm, or intercourse',
      'If arousal happens naturally, that\'s fine — but it is not pursued',
      'These areas are part of the whole body, not destinations',
      'Either partner can pause at any time',
    ],
    toucherGuide: [
      'Include the entire body, including breasts and genitals, as part of the same flow',
      'Do not spend disproportionate time on erogenous zones — they are part of the landscape',
      'Notice what these areas feel like with the same curiosity you brought to arms and shoulders',
      'If your partner becomes aroused, continue touching the same way — do not escalate',
    ],
    receiverGuide: [
      'Notice sensation in these areas with the same non-judgmental awareness',
      'You may feel arousal, discomfort, numbness, vulnerability, or nothing — all are normal',
      'If you need a break, simply say so',
      'You do not owe arousal, response, or readiness',
    ],
    afterSession: 'Did this session feel different from Stage 1? Share what you noticed — the shift in vulnerability, comfort, or awareness.',
    postPrompt: 'Did this session feel different from Stage 1? What did you notice?',
    traumaNote: 'This stage may bring up unexpected emotions or body memories. This is normal and does not mean something is wrong. You are in control at all times. You can pause, stop, or return to Stage 1 whenever you need to. Your pace is the right pace.',
  },
  {
    number: 3,
    title: 'Mutual Touch',
    subtitle: 'Touching and being touched together',
    duration: '1-2 weeks (minimum 2 sessions)',
    unlockText: 'Complete 3 Stage 2 sessions',
    requiredSessions: 2,
    color: 'text-rose-500',
    gradient: 'from-rose-400 to-pink-500',
    emoji: '🫂',
    description: 'Both partners touch simultaneously. Still exploratory — not goal-oriented. Intercourse is still off the table. The focus shifts to shared, synchronized touch.',
    rules: [
      'Both partners touch simultaneously',
      'Still exploratory — not goal-oriented',
      'Intercourse is still off the table',
      'If one partner wants to pause, both pause',
      'Synchronize your breathing if it feels natural',
    ],
    togetherGuide: [
      'Begin facing each other — whatever state of dress feels comfortable',
      'Start by touching each other\'s hands, arms, and faces simultaneously',
      'Gradually expand to the full body',
      'Move slowly — synchronize your breathing',
      'Notice the difference between touching and being touched at the same time',
      'Communication can be wordless — guiding a hand, shifting position, breathing together',
    ],
    toucherGuide: [],
    receiverGuide: [],
    afterSession: 'What felt different about touching and being touched at the same time? Notice the shift from individual exploration to shared presence.',
    postPrompt: 'What felt different about touching and being touched at the same time?',
  },
  {
    number: 4,
    title: 'Sensual Integration',
    subtitle: 'Connection that may include intercourse',
    duration: 'Ongoing — no minimum',
    unlockText: 'Complete 2 Stage 3 sessions',
    requiredSessions: 0,
    color: 'text-amber-600',
    gradient: 'from-amber-400 to-orange-500',
    emoji: '✨',
    description: 'Intercourse is now an option — never an obligation. Begin with earlier stage touch. Allow arousal to emerge from connection. A session without intercourse is equally successful.',
    rules: [
      'Intercourse is an option — never an obligation',
      'All previous principles remain: curiosity over performance',
      'Ideally decide IN the moment, not beforehand',
      'Orgasm is welcome but not the goal',
      'A session without intercourse is a complete success',
    ],
    togetherGuide: [
      'Begin with Stage 1 or 2 style touch — reconnect first',
      'Allow arousal to emerge naturally from connection',
      'If both partners feel drawn toward intercourse, move gradually',
      'If either doesn\'t feel drawn to it, continue with touch — equally valuable',
      'During the fertile window, this naturally leads to well-timed attempts',
      'The reframe: "let\'s connect tonight" instead of "we need to have sex"',
    ],
    toucherGuide: [],
    receiverGuide: [],
    afterSession: 'Describe the experience in one word. Not "good" or "bad" — something specific to what you felt.',
    postPrompt: 'One word to describe this experience:',
  },
];

// ─── SPECIAL CONTEXT MODULES ───

export interface ContextMessage {
  id: string;
  context: string;
  title: string;
  forHer: string;
  forPartner: string;
  suggestedStage: number;
}

export const CONTEXT_MESSAGES: ContextMessage[] = [
  {
    id: 'fertile-window',
    context: 'Fertile Window',
    title: 'The Fertile Window Reconnect',
    forHer: 'Your fertile window is open. Instead of thinking about what you need to do, consider what you want to feel. Tonight isn\'t about making a baby — it\'s about being with the person you chose. The biology handles itself when two people are genuinely connected. Start with 5 minutes of Stage 1 touch. Let the rest unfold from there.',
    forPartner: 'Her fertile window is open. Tonight matters — but not the way you think. She doesn\'t need you to perform. She needs you to be present. Start with touch that has no agenda. Hold her hand. Kiss her forehead. Let connection lead. The rest takes care of itself.',
    suggestedStage: 4,
  },
  {
    id: 'tww',
    context: 'Two-Week Wait',
    title: 'The TWW Reconnect',
    forHer: 'You\'re in the two-week wait. This is a time when couples often pull apart physically — she\'s anxious, he\'s walking on eggshells, and touch feels loaded. But non-sexual physical affection during the TWW actually helps. Oxytocin from gentle touch reduces cortisol, which supports the implantation environment. Tonight, try a Stage 1 session — just hands, arms, back, shoulders. No expectations. Just presence.',
    forPartner: 'She\'s in the two-week wait. She may be anxious, hopeful, scared, or all three at once. You can\'t fix the uncertainty — but you can hold her through it. Stage 1 touch tonight: hands, arms, shoulders, back. No agenda. Oxytocin from gentle touch actually reduces cortisol, which supports implantation. Your presence is medicine.',
    suggestedStage: 1,
  },
  {
    id: 'post-loss',
    context: 'After Loss',
    title: 'The Post-Loss Reconnect',
    forHer: 'When you\'re ready — and only when you\'re ready — physical connection can be part of healing. Not sex. Not trying again. Just touch that says "I\'m still here and so are you." There is no timeline for this. Stage 1 is always available. Start with holding hands. That\'s enough.',
    forPartner: 'She\'s grieving. You are too. Physical intimacy may be the last thing either of you wants right now — and that\'s okay. When she\'s ready, start with the simplest touch: hold her hand. Nothing more is required. Your presence says everything.',
    suggestedStage: 1,
  },
  {
    id: 'ivf',
    context: 'During IVF',
    title: 'The IVF Reconnect',
    forHer: 'IVF can make your body feel like it belongs to the doctors and the protocol. Reconnect sessions during IVF are about reclaiming your body as yours — and your partner\'s touch as something that belongs to your relationship, not the treatment plan. Even 10 minutes of Stage 1 touch on injection nights can transform how you both experience this process.',
    forPartner: 'She\'s going through IVF — her body is being poked, prodded, and monitored by medical professionals every day. Your touch is different from all of that. On injection nights especially, 10 minutes of gentle, non-medical touch reminds her that her body is still hers, and still yours.',
    suggestedStage: 1,
  },
];

// ─── ONBOARDING OPTIONS ───

export const INTIMACY_OPTIONS = [
  { value: 'connected', label: 'Connected and fulfilling' },
  { value: 'routine', label: 'Functional but routine' },
  { value: 'strained', label: 'Strained or infrequent' },
  { value: 'absent', label: 'Mostly absent' },
  { value: 'complicated', label: 'Complicated by past experiences' },
];

export const TTC_FEELING_OPTIONS = [
  { value: 'fine', label: "Fine — doesn't bother me" },
  { value: 'slight', label: 'Slightly pressured' },
  { value: 'significant', label: 'Significantly stressed' },
  { value: 'dreading', label: 'Dreading it' },
  { value: 'stopped', label: "We've stopped because of the pressure" },
];

export const PAST_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'yes-therapy', label: "Yes, and I'm working with a therapist" },
  { value: 'yes-no-therapy', label: "Yes, but I'm not currently in therapy" },
  { value: 'skip', label: "I'd rather not say" },
];

export const GOAL_OPTIONS = [
  { value: 'closer', label: 'Feel closer to my partner' },
  { value: 'pressure', label: 'Reduce pressure around sex' },
  { value: 'trust', label: 'Rebuild trust with physical touch' },
  { value: 'ttc', label: 'Improve our TTC experience' },
  { value: 'all', label: 'All of the above' },
];

export const AMBIENT_SOUNDS = [
  { value: 'silence', label: 'Silence', emoji: '🤫' },
  { value: 'rain', label: 'Rain', emoji: '🌧️' },
  { value: 'music', label: 'Soft Music', emoji: '🎵' },
  { value: 'nature', label: 'Nature', emoji: '🌿' },
  { value: 'ocean', label: 'Ocean', emoji: '🌊' },
];

export const SESSION_LENGTHS = [15, 20, 30];

export const REMINDER_OPTIONS = [
  { value: 'fertile', label: 'After every fertile window' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'manual', label: 'Only when I ask' },
];

// ─── HELPERS ───

export function getStageProgress(sessions: ReconnectSession[]): Record<number, number> {
  const progress: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const s of sessions) {
    if (s.completed && s.stage >= 1 && s.stage <= 4) {
      progress[s.stage]++;
    }
  }
  return progress;
}

export function isStageUnlocked(stageNumber: number, progress: Record<number, number>): boolean {
  if (stageNumber === 1) return true;
  if (stageNumber === 2) return progress[1] >= 3;
  if (stageNumber === 3) return progress[2] >= 3;
  if (stageNumber === 4) return progress[3] >= 2;
  return false;
}

export function getNextUnlockText(stageNumber: number, progress: Record<number, number>): string | null {
  if (stageNumber === 2 && progress[1] < 3) return `${3 - progress[1]} more Stage 1 sessions to unlock`;
  if (stageNumber === 3 && progress[2] < 3) return `${3 - progress[2]} more Stage 2 sessions to unlock`;
  if (stageNumber === 4 && progress[3] < 2) return `${2 - progress[3]} more Stage 3 sessions to unlock`;
  return null;
}
