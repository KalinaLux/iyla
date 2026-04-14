export type SignalTier = 'approaching' | 'window_open' | 'peak_day' | 'window_closed';

export interface SignalMessage {
  title: string;
  body: string;
  emoji: string;
}

export interface SignalTheme {
  id: string;
  name: string;
  description: string;
  emoji: string;
  gradient: string;
  messages: Record<SignalTier, SignalMessage>;
  quickReplies: { label: string; value: string }[];
  actionCards: Record<string, { title: string; body: string }>;
}

export const SIGNAL_THEMES: SignalTheme[] = [
  // ─── AVIATION (Dominick's Special) ───
  {
    id: 'aviation',
    name: 'Top Gun',
    description: 'Cleared for approach, Captain.',
    emoji: '✈️',
    gradient: 'from-sky-500 to-blue-700',
    messages: {
      approaching: {
        title: 'Pre-Flight Advisory',
        body: 'ATIS update: Favorable conditions developing. Expect clearance for approach within 72 hours. Complete your pre-flight checklist, Captain.',
        emoji: '🛫',
      },
      window_open: {
        title: 'Cleared for Approach',
        body: 'Tower: Runway is open and conditions are optimal. You are cleared for final approach. Maintain steady descent and prepare for landing.',
        emoji: '🛬',
      },
      peak_day: {
        title: 'Priority Landing Clearance',
        body: 'MAYDAY priority granted. This is your primary approach window, Captain. All other traffic has been cleared. Bring her in smooth — this is the one that counts.',
        emoji: '🎯',
      },
      window_closed: {
        title: 'Flight Complete',
        body: 'Smooth landing confirmed. Engines to idle. Return to hangar — debrief in 14 days. Outstanding airmanship this cycle, Captain.',
        emoji: '🏁',
      },
    },
    quickReplies: [
      { label: 'Roger that, on approach 🛬', value: 'roger' },
      { label: 'Copy tower, ETA 20min ✈️', value: 'eta' },
      { label: 'Request holding pattern 📻', value: 'hold' },
    ],
    actionCards: {
      follicular: {
        title: 'Pre-Flight Inspection',
        body: 'Systems check: Fuel up on clean food, hydrate, take your supplements. No hot tub in the cockpit. Your aircraft needs to be in peak condition for the upcoming sortie.',
      },
      ovulatory: {
        title: 'Scramble Alert',
        body: "You've been cleared hot, Captain. The approach window is narrow — stay sharp, stay close to base, and be ready to fly at a moment's notice. This is what you trained for.",
      },
      luteal: {
        title: 'Holding Pattern',
        body: "You're in a holding pattern at flight level 140. No turbulence expected. Keep the cabin calm, bring her coffee, and wait for the control tower's final report.",
      },
      menstrual: {
        title: 'Return to Base',
        body: 'Mission recycled — new flight plan being filed. Debrief with your co-pilot. Restock the galley with chocolate. Next departure window in approximately 2 weeks.',
      },
    },
  },

  // ─── TACTICAL / SPECIAL FORCES ───
  {
    id: 'tactical',
    name: 'Spec Ops',
    description: 'Mission-critical intel, Operator.',
    emoji: '🎖️',
    gradient: 'from-zinc-700 to-zinc-900',
    messages: {
      approaching: {
        title: 'INTEL BRIEF',
        body: 'CLASSIFIED — Reconnaissance confirms primary target window in T-minus 72 hours. Begin pre-mission prep. Hydrate. Rest. Gear up. Standby for green light.',
        emoji: '📡',
      },
      window_open: {
        title: 'GREEN LIGHT — GO GO GO',
        body: 'MISSION IS LIVE. Operative, you are cleared hot. Proceed to the objective. Execute with precision. Maintain comms silence — she knows you know.',
        emoji: '🟢',
      },
      peak_day: {
        title: 'PRIORITY ALPHA',
        body: 'This is the primary extraction window. All assets are deployed. HVT is at the rally point. This is not a drill, Operator — execute now. Zero margin for delay.',
        emoji: '⚡',
      },
      window_closed: {
        title: 'EXFIL COMPLETE',
        body: 'Objective secured. All operators RTB. Debrief in 14 days. Maintain operational readiness. Outstanding execution this cycle, soldier.',
        emoji: '🎖️',
      },
    },
    quickReplies: [
      { label: 'Copy that, Oscar Mike 🏃', value: 'oscar_mike' },
      { label: 'Solid copy, ETA 20 mikes ⏱️', value: 'eta' },
      { label: 'Request delay, holding position 📍', value: 'hold' },
    ],
    actionCards: {
      follicular: {
        title: 'Pre-Mission Prep',
        body: 'Gear check: Supplements loaded. Alcohol — negative. Hot tub exposure — negative. Physical training — affirmative. You are building the operative\'s readiness profile.',
      },
      ovulatory: {
        title: 'Operation Underway',
        body: 'You are in the field. Stay alert. Keep your phone on. When the signal comes, you move. No hesitation. The mission window is narrow and non-negotiable.',
      },
      luteal: {
        title: 'Overwatch Position',
        body: 'Hold position. The objective is in progress — you cannot accelerate it. Bring her supplies. Run perimeter security (handle dinner). Do NOT ask for a sitrep on "symptoms."',
      },
      menstrual: {
        title: 'After Action Review',
        body: 'Mission cycling to next op. Debrief with your partner. Resupply the FOB with comfort items. New mission brief drops in ~14 days. Stay frosty.',
      },
    },
  },

  // ─── SPORTS ───
  {
    id: 'sports',
    name: 'Game Day',
    description: 'You\'re in the starting lineup.',
    emoji: '🏆',
    gradient: 'from-emerald-500 to-teal-600',
    messages: {
      approaching: {
        title: 'Scouting Report',
        body: 'Big game coming up this week. Time to hydrate, get your reps in, and visualize the win. Coach wants you rested and ready — no late nights, no junk food.',
        emoji: '📋',
      },
      window_open: {
        title: 'GAME TIME',
        body: "Coach is calling you off the bench — you're in the starting lineup tonight. The crowd's on their feet. Don't overthink it. Just play your game.",
        emoji: '🏈',
      },
      peak_day: {
        title: 'Championship Round',
        body: "This is the buzzer-beater moment. Fourth quarter, tied game, ball in your hands. Everything you've trained for comes down to right now. Leave nothing on the court.",
        emoji: '🏀',
      },
      window_closed: {
        title: 'Post-Game',
        body: 'Final whistle. You gave 110% and left it all on the field. Now we watch the replay and wait for the scores. Great hustle this cycle, MVP.',
        emoji: '🏅',
      },
    },
    quickReplies: [
      { label: 'Suiting up now 🏃', value: 'suiting_up' },
      { label: 'In the locker room, 20 min 🎽', value: 'locker_room' },
      { label: 'Rain delay — can we reschedule? 🌧️', value: 'rain_delay' },
    ],
    actionCards: {
      follicular: {
        title: 'Training Camp',
        body: "Off-season work wins championships. Eat clean, sleep 8 hours, take your supplements, stay away from the hot tub. You're building the body that performs when it counts.",
      },
      ovulatory: {
        title: 'In the Starting Lineup',
        body: "Coach called your number. Stay loose, stay focused. When the play is called, you execute. Don't leave the stadium — the game could go into overtime.",
      },
      luteal: {
        title: 'Waiting for the Replay',
        body: "The game's been played. You can't change the score now. Be a good teammate — bring her Gatorade (or tea). Don't ask about the scoreboard every 5 minutes.",
      },
      menstrual: {
        title: 'Next Season',
        body: 'Back to the drawing board. New game plan, fresh start. Get back in the gym, watch some film, and be ready for when Coach calls your number again.',
      },
    },
  },

  // ─── ROMANTIC ───
  {
    id: 'romantic',
    name: 'Romance',
    description: 'Candlelight and connection.',
    emoji: '🕯️',
    gradient: 'from-rose-400 to-pink-600',
    messages: {
      approaching: {
        title: 'Something in the Air',
        body: 'The stars are aligning this week. Maybe pick up her favorite flowers. Plan something beautiful — the kind of evening that makes you both forget about schedules.',
        emoji: '🌸',
      },
      window_open: {
        title: 'Tonight Feels Right',
        body: "Light the candles. Put on that playlist. She's been thinking about you. This isn't about timing — it's about the two of you, together, choosing this.",
        emoji: '🕯️',
      },
      peak_day: {
        title: 'Your Moment',
        body: "Everything has led to tonight. She doesn't need a speech — she needs you present, unhurried, and completely hers. Make it beautiful.",
        emoji: '✨',
      },
      window_closed: {
        title: 'Afterglow',
        body: "You showed up with your whole heart. That's what matters — not just the biology, but the love behind it. Hold her close tonight.",
        emoji: '💫',
      },
    },
    quickReplies: [
      { label: 'On my way home, my love 💕', value: 'coming_home' },
      { label: 'Picking up flowers 🌹', value: 'flowers' },
      { label: 'Drawing you a bath first 🛁', value: 'bath' },
    ],
    actionCards: {
      follicular: {
        title: 'Nurture the Connection',
        body: "Hold her hand. Ask about her day — really listen. The fertile window matters, but the foundation you're building every single day matters more.",
      },
      ovulatory: {
        title: 'Be Present',
        body: "Put the phone down. Look her in the eyes. This window isn't a deadline — it's an invitation. Show her she's desired, not just needed.",
      },
      luteal: {
        title: 'The Quiet Tenderness',
        body: "She's carrying hope and anxiety in equal measure. You can't fix that — but you can hold space for it. Tea, a blanket, and \"I'm here\" goes further than you know.",
      },
      menstrual: {
        title: 'Love Without Conditions',
        body: "If it didn't happen this cycle, she might grieve quietly. Don't rush to \"next time.\" Sit with her in the disappointment. Your presence is the medicine.",
      },
    },
  },

  // ─── PLAYFUL ───
  {
    id: 'playful',
    name: 'Playful',
    description: 'Keep it light, keep it fun.',
    emoji: '😏',
    gradient: 'from-amber-400 to-orange-500',
    messages: {
      approaching: {
        title: 'Heads Up, Champ',
        body: "Big week incoming! Start stretching. Maybe shave. Definitely shower. Eat something green. Your future self will thank you.",
        emoji: '🫡',
      },
      window_open: {
        title: 'Green Light!',
        body: "It's go time, baby! 🚦 She's not gonna text you about it — that's what I'm here for. Don't be weird about it. Just... show up and be your charming self.",
        emoji: '🏈',
      },
      peak_day: {
        title: 'THE Day',
        body: 'Ok listen. This is literally peak day. Cancel whatever you were doing tonight. Move mountains. Reschedule poker night. THIS. IS. IT. 🎯',
        emoji: '🔥',
      },
      window_closed: {
        title: 'Mission Accomplished-ish',
        body: "Great work, team! The window's closed. You can return to your regularly scheduled programming. Hot tub privileges: still revoked. 😤",
        emoji: '🎉',
      },
    },
    quickReplies: [
      { label: 'Say less 😏', value: 'say_less' },
      { label: 'Omw, warming up 🏃', value: 'omw' },
      { label: 'Need 30 min to mentally prepare 😅', value: 'prep' },
    ],
    actionCards: {
      follicular: {
        title: 'Pre-Game Prep',
        body: "You're on the bench for now, but don't get lazy. Supplements? Take them. Alcohol? Skip it. Boxers? Yes. Hot tub? YOU KNOW THE ANSWER.",
      },
      ovulatory: {
        title: 'You\'re Up!',
        body: "The universe has aligned. Your wife is ovulating. Your phone is charged. You have no excuses. Go be a rockstar. 🎸",
      },
      luteal: {
        title: 'Chill Mode Activated',
        body: "Two words: DON'T. ASK. Do not ask if she \"feels pregnant.\" Do not Google symptoms. Bring her snacks. Watch her show. Be a human heating pad.",
      },
      menstrual: {
        title: 'Plot Twist',
        body: "Didn't stick this time. It's ok. Bring chocolate. Do NOT say \"maybe next month.\" Just be warm. Literally — she probably wants a heating pad and silence.",
      },
    },
  },

  // ─── CLINICAL ───
  {
    id: 'clinical',
    name: 'Clinical',
    description: 'Just the data.',
    emoji: '📊',
    gradient: 'from-slate-500 to-slate-700',
    messages: {
      approaching: {
        title: 'Fertile Window Forecast',
        body: 'Based on multi-signal analysis, the fertile window is projected to open in approximately 3 days. Recommend maintaining optimal health behaviors.',
        emoji: '📅',
      },
      window_open: {
        title: 'Fertile Window Open',
        body: 'Combined signal concordance indicates the fertile window has opened. Intercourse within the next 48-72 hours has the highest probability of conception.',
        emoji: '🟢',
      },
      peak_day: {
        title: 'Peak Fertility Day',
        body: 'Today is the highest-probability day this cycle based on LH surge, cervical mucus score, and Kegg impedance data. Recommended timing: tonight.',
        emoji: '📈',
      },
      window_closed: {
        title: 'Ovulation Confirmed',
        body: 'Post-ovulatory progesterone rise confirmed via PdG metabolite. The fertile window has closed. Next assessment in approximately 14 days.',
        emoji: '✅',
      },
    },
    quickReplies: [
      { label: 'Acknowledged ✓', value: 'ack' },
      { label: 'Understood, en route', value: 'en_route' },
      { label: 'Schedule conflict — discuss', value: 'conflict' },
    ],
    actionCards: {
      follicular: {
        title: 'Optimization Window',
        body: 'Spermatogenesis takes 74 days. Current behaviors directly impact gamete quality. Maintain supplement protocol, minimize heat exposure, limit alcohol to <4 drinks/week.',
      },
      ovulatory: {
        title: 'Active Fertility Window',
        body: 'Oocyte viability is 12-24 hours post-ovulation. Sperm viability is up to 5 days. Optimal intercourse frequency during the window: every 24-48 hours.',
      },
      luteal: {
        title: 'Luteal Phase — Waiting Period',
        body: 'Implantation, if occurring, happens 6-12 DPO. No actionable data is available during this period. Recommend reducing partner stress through supportive presence.',
      },
      menstrual: {
        title: 'Cycle Reset',
        body: 'New cycle initiated. Prior cycle data has been logged. Review cycle analytics for pattern recognition. Next fertile window projection will update as new data is entered.',
      },
    },
  },

  // ─── SILENT ───
  {
    id: 'silent',
    name: 'Silent',
    description: 'No words. Just a color.',
    emoji: '🤫',
    gradient: 'from-warm-400 to-warm-600',
    messages: {
      approaching: {
        title: '',
        body: '',
        emoji: '🟡',
      },
      window_open: {
        title: '',
        body: '',
        emoji: '🟢',
      },
      peak_day: {
        title: '',
        body: '',
        emoji: '🔴',
      },
      window_closed: {
        title: '',
        body: '',
        emoji: '⚪',
      },
    },
    quickReplies: [
      { label: '👍', value: 'thumbs_up' },
      { label: '❤️', value: 'heart' },
      { label: '🕐', value: 'clock' },
    ],
    actionCards: {
      follicular: { title: '', body: '' },
      ovulatory: { title: '', body: '' },
      luteal: { title: '', body: '' },
      menstrual: { title: '', body: '' },
    },
  },
];

const THEME_STORAGE_KEY = 'iyla-signal-theme';

export function getSelectedTheme(): string {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'playful';
  } catch {
    return 'playful';
  }
}

export function setSelectedTheme(themeId: string): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // localStorage unavailable
  }
}

export function getThemeById(id: string): SignalTheme {
  return SIGNAL_THEMES.find((t) => t.id === id) || SIGNAL_THEMES[4]; // default to playful
}

export function mapStatusToTier(status: string): SignalTier {
  switch (status) {
    case 'low':
    case 'rising':
      return 'approaching';
    case 'high':
      return 'window_open';
    case 'peak':
      return 'peak_day';
    case 'confirmed_ovulation':
    case 'luteal':
    case 'menstrual':
      return 'window_closed';
    default:
      return 'approaching';
  }
}
