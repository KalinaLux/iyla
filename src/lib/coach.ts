// ──────────────────────────────────────────────────────────────────────────
// iyla — Coach Q&A Engine (grounded, no external LLM required)
// ──────────────────────────────────────────────────────────────────────────
// A deterministic answer generator that responds to common fertility
// questions using the user's own data. Every answer is derived from the
// intelligence snapshot, concordance result, baselines, current reading,
// or cycle history. No hallucinations, no made-up claims.
//
// Architecture:
//   - A list of Question handlers, each with (a) a match function that
//     decides if the user's text matches this question's intent, and
//     (b) an answer function that produces a grounded response.
//   - A catch-all that lists suggested questions when nothing matches.
// ──────────────────────────────────────────────────────────────────────────

import type { IntelligenceSnapshot } from './intelligence';
import type { PersonalBaselines } from './baselines';
import type { DailyReading, Cycle } from './types';

export interface CoachContext {
  today: string;
  cycleDay: number | null;
  currentCycle: Cycle | null;
  todayReading: DailyReading | null;
  yesterdayReading: DailyReading | null;
  intelligence: IntelligenceSnapshot | null;
  baselines: PersonalBaselines | null;
}

export interface CoachAnswer {
  text: string;                      // main answer
  citations: string[];               // data points the answer is grounded in
  followUpSuggestions: string[];     // 2-4 next questions
}

type Handler = {
  id: string;
  suggestion: string;                // what to show in "ask me about..."
  match: (q: string) => boolean;
  answer: (ctx: CoachContext) => CoachAnswer;
};

const normalize = (s: string) => s.toLowerCase().replace(/[?.!,;:]/g, ' ').replace(/\s+/g, ' ').trim();
const includesAny = (q: string, terms: string[]) => terms.some(t => q.includes(t));

// ── Handlers ───────────────────────────────────────────────────────────

const handlers: Handler[] = [
  // 1. Why am I low fertility?
  {
    id: 'why_low_fertility',
    suggestion: 'Why am I showing low fertility today?',
    match: q => includesAny(q, ['why', 'low fertility', 'low', 'not fertile', 'why am i']),
    answer: ctx => {
      const intel = ctx.intelligence;
      const reading = ctx.todayReading;
      const citations: string[] = [];
      const reasons: string[] = [];

      if (intel?.concordance?.flags.length) {
        const flag = intel.concordance.flags[0];
        reasons.push(`There's a concordance flag active: ${flag.explanation.toLowerCase()}`);
        citations.push(`Concordance confidence: ${intel.concordance.confidence}`);
      }

      if (ctx.cycleDay !== null && ctx.cycleDay < 8) {
        reasons.push(`You're on CD${ctx.cycleDay}, which is early follicular — your body is still building the follicle.`);
        citations.push(`CD${ctx.cycleDay}`);
      }

      if (reading) {
        if (reading.lh != null && reading.lh < 3) {
          reasons.push(`Your LH is ${reading.lh} mIU/mL, well below surge levels.`);
          citations.push(`LH: ${reading.lh}`);
        }
        if (reading.e3g != null && reading.e3g < 40) {
          reasons.push(`Your E3G (estrogen) is ${reading.e3g.toFixed(0)} pg/mL, which is follicular-phase baseline.`);
          citations.push(`E3G: ${reading.e3g}`);
        }
      }

      if (ctx.baselines?.ovulation.typicalCycleDay && ctx.cycleDay) {
        const days = ctx.baselines.ovulation.typicalCycleDay - ctx.cycleDay;
        if (days > 2) {
          reasons.push(`Your typical ovulation is CD${ctx.baselines.ovulation.typicalCycleDay}, so fertility should start rising in ~${days - 5} days.`);
          citations.push(`Your typical ovulation: CD${ctx.baselines.ovulation.typicalCycleDay}`);
        }
      }

      if (reasons.length === 0) {
        reasons.push('Your signals aren\'t yet showing the patterns associated with high fertility — this is normal most days of the cycle. Keep logging.');
      }

      return {
        text: `${reasons.join(' ')} This is not a problem — low fertility most days is expected. Your body only ovulates once per cycle.`,
        citations,
        followUpSuggestions: [
          'When will my fertile window open?',
          'What does my LH pattern look like?',
          'What should I focus on today?',
        ],
      };
    },
  },

  // 2. When will my fertile window open / ovulation
  {
    id: 'when_window',
    suggestion: 'When will my fertile window open?',
    match: q => includesAny(q, ['when', 'fertile window', 'ovulation', 'ovulate', 'window open']),
    answer: ctx => {
      const p = ctx.intelligence?.predictions;
      if (!p || p.predictionBasis === 'insufficient_data') {
        return {
          text: 'Not enough cycle history yet to make a confident prediction. After you complete a couple of cycles, iyla will learn your specific timing.',
          citations: [],
          followUpSuggestions: ['What does my LH pattern look like?', 'What can I do to improve egg quality?'],
        };
      }
      const parts: string[] = [];
      if (p.fertilePhaseStart && p.fertilePhaseEnd) {
        parts.push(`Your fertile window is predicted ${p.fertilePhaseStart} through ${p.fertilePhaseEnd}.`);
      }
      if (p.nextOvulation) {
        parts.push(`Ovulation is predicted for ${p.nextOvulation.date} (CD${p.nextOvulation.cycleDay}, ${Math.round(p.nextOvulation.confidence * 100)}% confidence).`);
      }
      if (p.bestConceptionDays.length > 0) {
        const top = p.bestConceptionDays.slice(0, 3).map(d => `${d.date} (${Math.round(d.relativeOdds * 100)}%)`).join(', ');
        parts.push(`Your top three conception days: ${top}.`);
      }
      return {
        text: parts.join(' '),
        citations: [
          `Prediction basis: ${p.predictionBasis.replace('_', ' ')}`,
          p.averageCycleLength ? `Avg cycle length: ${p.averageCycleLength.toFixed(1)} days` : '',
        ].filter(Boolean),
        followUpSuggestions: [
          'What are my odds this cycle?',
          'What should I do during the fertile window?',
          'Should my partner and I have sex every day?',
        ],
      };
    },
  },

  // 3. What are my odds this cycle?
  {
    id: 'odds_this_cycle',
    suggestion: 'What are my conception odds this cycle?',
    match: q => includesAny(q, ['odds', 'chance', 'probability', 'conceive', 'conception', 'pregnant']),
    answer: ctx => {
      const p = ctx.intelligence?.predictions;
      if (!p || p.conceptionOddsThisCycle == null) {
        return {
          text: 'I don\'t have enough data yet to estimate your odds confidently. Log through at least one full cycle to unlock this.',
          citations: [],
          followUpSuggestions: ['What does my LH pattern look like?', 'What should I focus on today?'],
        };
      }
      const pct = Math.round(p.conceptionOddsThisCycle * 100);
      const framing = pct >= 25 ? 'This is a strong cycle for you.'
        : pct >= 15 ? 'This is a typical-for-your-age cycle.'
        : 'This cycle\'s odds are lower than average for a few reasons — but it only takes one good month.';
      return {
        text: `Your estimated conception odds this cycle are ${pct}%. ${framing} Odds compound: over 6 cycles, the cumulative probability is roughly ${Math.round((1 - Math.pow(1 - p.conceptionOddsThisCycle, 6)) * 100)}%.`,
        citations: [
          `This-cycle odds: ${pct}%`,
          `Basis: ${p.predictionBasis.replace('_', ' ')}`,
        ],
        followUpSuggestions: [
          'When will my fertile window open?',
          'What should I focus on today?',
          'What patterns did you find in my data?',
        ],
      };
    },
  },

  // 4. What does my LH pattern look like?
  {
    id: 'lh_pattern',
    suggestion: 'What does my LH pattern look like?',
    match: q => includesAny(q, ['lh', 'surge', 'luteinizing']),
    answer: ctx => {
      const b = ctx.baselines;
      if (!b || !b.lhSurge.typicalPeakValue) {
        return {
          text: 'Not enough LH data across completed cycles yet. Log LH readings through ovulation in a few cycles and iyla will learn your personal pattern.',
          citations: [],
          followUpSuggestions: ['When will my fertile window open?', 'What\'s normal for my cycle length?'],
        };
      }
      const parts = [
        `Your LH typically peaks around ${b.lhSurge.typicalPeakValue.toFixed(1)} mIU/mL${b.lhSurge.peakValueStddev ? ` (±${b.lhSurge.peakValueStddev.toFixed(1)})` : ''}.`,
        b.lhSurge.typicalSurgeOnsetCd ? `Your surge usually begins around CD${b.lhSurge.typicalSurgeOnsetCd}.` : '',
        b.lhSurge.typicalSurgeDurationDays ? `Surge duration: roughly ${b.lhSurge.typicalSurgeDurationDays.toFixed(0)} days.` : '',
        b.lhSurge.rampStyle !== 'unknown' ? `Ramp style: ${b.lhSurge.rampStyle.replace('-', ' ')}.` : '',
        b.adaptiveRules.lhSurgeThresholdSuggestion
          ? `Based on your history, iyla treats LH ≥ ${b.adaptiveRules.lhSurgeThresholdSuggestion} as a surge for you (vs. the generic 25 mIU/mL default).`
          : '',
      ].filter(Boolean);
      return {
        text: parts.join(' '),
        citations: [
          `Sample size: ${b.sampleSize} completed cycles`,
          `Confidence: ${b.lhSurge.confidence}`,
        ],
        followUpSuggestions: [
          'When will my fertile window open?',
          'Why was today\'s reading flagged?',
          'What\'s my BBT baseline?',
        ],
      };
    },
  },

  // 5. What's my BBT baseline
  {
    id: 'bbt_baseline',
    suggestion: 'What\'s my BBT baseline?',
    match: q => includesAny(q, ['bbt', 'temperature', 'thermal', 'temp']),
    answer: ctx => {
      const b = ctx.baselines?.bbt;
      if (!b || !b.follicularBaseline) {
        return {
          text: 'Not enough BBT data yet — keep logging temperatures through 2+ cycles to build your baseline.',
          citations: [],
          followUpSuggestions: ['What does my LH pattern look like?', 'What\'s normal for my cycle length?'],
        };
      }
      const parts = [
        `Your follicular (pre-ovulation) BBT averages ${b.follicularBaseline.toFixed(2)}°F.`,
        b.lutealBaseline ? `Your luteal (post-ovulation) baseline is ${b.lutealBaseline.toFixed(2)}°F.` : '',
        b.thermalShiftSize ? `Your typical thermal shift is ${b.thermalShiftSize.toFixed(2)}°F — a confirmed shift is usually ≥ 0.3°F above your follicular baseline.` : '',
      ].filter(Boolean);
      return {
        text: parts.join(' '),
        citations: [`Confidence: ${b.confidence}`],
        followUpSuggestions: [
          'When will my fertile window open?',
          'What does my LH pattern look like?',
        ],
      };
    },
  },

  // 6. What patterns did you find?
  {
    id: 'patterns',
    suggestion: 'What patterns did you find in my data?',
    match: q => includesAny(q, ['pattern', 'trend', 'anomal', 'unusual', 'notice']),
    answer: ctx => {
      const patterns = ctx.intelligence?.patterns ?? [];
      if (patterns.length === 0) {
        return {
          text: 'Nothing unusual detected in your recent data. Your body is doing quiet, steady work.',
          citations: [],
          followUpSuggestions: ['What are my odds this cycle?', 'What should I focus on today?'],
        };
      }
      const top = patterns.slice(0, 3);
      const summary = top.map(p => `• ${p.title}: ${p.description}`).join('\n\n');
      return {
        text: `I found ${patterns.length} patterns in your data. The top ones:\n\n${summary}`,
        citations: [`${patterns.length} total patterns detected`],
        followUpSuggestions: [
          'What correlations did you find?',
          'What should I focus on today?',
          'When will my fertile window open?',
        ],
      };
    },
  },

  // 7. Correlations
  {
    id: 'correlations',
    suggestion: 'What correlations did you find?',
    match: q => includesAny(q, ['correlat', 'relationship', 'connected', 'linked']),
    answer: ctx => {
      const corrs = ctx.intelligence?.correlations ?? [];
      if (corrs.length === 0) {
        return {
          text: 'Not enough data to surface correlations yet — I need at least 3 completed cycles to find statistically meaningful relationships.',
          citations: [],
          followUpSuggestions: ['What patterns did you find?', 'What does my LH pattern look like?'],
        };
      }
      const top = corrs.slice(0, 2);
      const summary = top.map(c => `• ${c.title}: ${c.narrative}`).join('\n\n');
      return {
        text: `Here's what's correlated in your data:\n\n${summary}`,
        citations: [`${corrs.length} correlations detected`],
        followUpSuggestions: [
          'What patterns did you find?',
          'What should I focus on today?',
        ],
      };
    },
  },

  // 8. What should I focus on today
  {
    id: 'focus_today',
    suggestion: 'What should I focus on today?',
    match: q => includesAny(q, ['today', 'focus', 'what do i do', 'what should i', 'advice', 'recommend']),
    answer: ctx => {
      const intel = ctx.intelligence;
      if (intel?.concordance?.flags.length) {
        return {
          text: `Priority: address the concordance flag. ${intel.concordance.flags[0].suggestion}`,
          citations: [`Concordance: ${intel.concordance.confidence} confidence`],
          followUpSuggestions: ['Why was today\'s reading flagged?', 'When will my fertile window open?'],
        };
      }
      const p = intel?.predictions;
      if (p?.nextOvulation?.date === ctx.today) {
        return {
          text: 'Today is predicted ovulation. Prioritize intimacy today and tomorrow. Stay hydrated but taper water after 7pm for tomorrow\'s Inito. A short walk + 9min breathwork helps.',
          citations: ['Ovulation predicted today'],
          followUpSuggestions: ['What are my odds this cycle?', 'Should we have sex every day?'],
        };
      }
      if (ctx.cycleDay !== null && ctx.cycleDay <= 5) {
        return {
          text: 'Rest and replenish. Iron-rich foods (red meat, lentils, leafy greens), warmth, and gentle movement. No need to log every signal — this phase is for recovery.',
          citations: [`CD${ctx.cycleDay}`],
          followUpSuggestions: ['When will my fertile window open?', 'What\'s normal for my cycle length?'],
        };
      }
      return {
        text: 'Log today\'s readings and take your supplements. Consistency compounds. Aim for 7-9 hours of sleep tonight — sleep correlates more strongly with fertility than most other single factors.',
        citations: [],
        followUpSuggestions: ['When will my fertile window open?', 'What\'s my iyla Score?'],
      };
    },
  },

  // 9. Cycle length
  {
    id: 'cycle_length',
    suggestion: 'What\'s normal for my cycle length?',
    match: q => includesAny(q, ['cycle length', 'how long', 'normal', 'cycle']),
    answer: ctx => {
      const b = ctx.baselines?.cycleLength;
      if (!b || b.mean === 0) {
        return {
          text: 'Not enough completed cycles to establish your personal average yet.',
          citations: [],
          followUpSuggestions: ['When will my fertile window open?', 'What does my LH pattern look like?'],
        };
      }
      return {
        text: `Your cycles average ${b.mean.toFixed(1)} days (±${b.stddev.toFixed(1)}), ranging from ${b.min} to ${b.max}. ${b.stddev > 3 ? 'That\'s a relatively wide range — your cycles have some variability.' : 'That\'s pretty consistent.'}`,
        citations: [`Confidence: ${b.confidence}`],
        followUpSuggestions: [
          'When will my fertile window open?',
          'What\'s my luteal phase length?',
        ],
      };
    },
  },

  // 10. Luteal phase
  {
    id: 'luteal',
    suggestion: 'What\'s my luteal phase length?',
    match: q => includesAny(q, ['luteal', 'after ovulation', 'tww', 'two week wait']),
    answer: ctx => {
      const b = ctx.baselines?.lutealPhase;
      if (!b || b.meanDays === 0) {
        return {
          text: 'Not enough data to establish your luteal phase length yet — log through a full cycle with a BBT or PdG confirmation.',
          citations: [],
          followUpSuggestions: ['What\'s normal for my cycle length?'],
        };
      }
      const note = b.isShort
        ? 'This is on the short side (< 11 days). A short luteal phase can indicate low progesterone — worth discussing with your provider and prioritizing B6, magnesium, and seed cycling.'
        : 'This is a healthy luteal phase length.';
      return {
        text: `Your luteal phase averages ${b.meanDays.toFixed(1)} days (±${b.stddev.toFixed(1)}). ${note}`,
        citations: [`Confidence: ${b.confidence}`],
        followUpSuggestions: [
          'What should I take for luteal support?',
          'What\'s normal for my cycle length?',
        ],
      };
    },
  },
];

// ── Public API ─────────────────────────────────────────────────────────

export function suggestedQuestions(): string[] {
  return handlers.map(h => h.suggestion);
}

export function answerQuestion(question: string, ctx: CoachContext): CoachAnswer {
  const q = normalize(question);
  if (!q) {
    return {
      text: 'Ask me anything about your cycle, your data, or what to do today. Here are some ideas:',
      citations: [],
      followUpSuggestions: suggestedQuestions().slice(0, 4),
    };
  }
  const handler = handlers.find(h => h.match(q));
  if (handler) return handler.answer(ctx);
  return {
    text: `I don't know how to answer that yet. I can help with questions about your fertile window, LH patterns, BBT, odds, cycle length, luteal phase, detected patterns, or what to focus on today.`,
    citations: [],
    followUpSuggestions: suggestedQuestions().slice(0, 4),
  };
}
