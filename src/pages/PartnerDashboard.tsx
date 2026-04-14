import { useState, useEffect } from 'react';
import {
  User,
  Heart,
  Zap,
  Dumbbell,
  Beer,
  Thermometer,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
  Send,
  Settings,
} from 'lucide-react';
import { getSelectedTheme, getThemeById, setSelectedTheme, mapStatusToTier, SIGNAL_THEMES } from '../lib/signal-themes';

type CycleStatus = 'low' | 'rising' | 'high' | 'peak' | 'confirmed_ovulation' | 'luteal' | 'menstrual';
type CyclePhase = 'follicular' | 'ovulatory' | 'luteal' | 'menstrual';

const STATUS_TO_PHASE: Record<CycleStatus, CyclePhase> = {
  low: 'follicular',
  rising: 'follicular',
  high: 'ovulatory',
  peak: 'ovulatory',
  confirmed_ovulation: 'luteal',
  luteal: 'luteal',
  menstrual: 'menstrual',
};

const STATUS_MESSAGES: Record<CycleStatus, string> = {
  low: "It's early in the cycle. Focus on your own health.",
  rising: "It's early in the cycle. Focus on your own health.",
  high: 'The fertile window is opening. Time to connect.',
  peak: 'This is it — peak fertility. Tonight matters.',
  confirmed_ovulation: 'Ovulation confirmed. You did your part.',
  luteal: 'The waiting game. Be present and supportive.',
  menstrual: 'New cycle starting. Be gentle with her.',
};

const PHASE_ACTIONS: Record<CyclePhase, { title: string; body: string; icon: React.ReactNode }> = {
  follicular: {
    title: 'Build the Foundation',
    body: "Eat well, exercise, limit alcohol, take your supplements. You're building the team.",
    icon: <Dumbbell size={20} strokeWidth={1.5} className="text-blue-600" />,
  },
  ovulatory: {
    title: 'Game Time',
    body: "Keep your phone close — she may signal. Prioritize intimacy. Skip the hot tub.",
    icon: <Zap size={20} strokeWidth={1.5} className="text-indigo-600" />,
  },
  luteal: {
    title: 'The Two-Week Wait',
    body: "Don't ask \"do you feel pregnant?\" — seriously. Bring her tea. Handle dinner. She's doing the hard part.",
    icon: <Heart size={20} strokeWidth={1.5} className="text-rose-500" />,
  },
  menstrual: {
    title: 'Be Her Safe Space',
    body: "She might be disappointed. Don't problem-solve unless she asks. Chocolate is medicine.",
    icon: <MessageCircle size={20} strokeWidth={1.5} className="text-warm-600" />,
  },
};

interface Supplement {
  name: string;
  dose: string;
}

const SUPPLEMENTS: Supplement[] = [
  { name: 'CoQ10 (Ubiquinol)', dose: '400mg' },
  { name: 'Zinc', dose: '30mg' },
  { name: 'Vitamin D', dose: '5000 IU' },
  { name: 'Omega-3', dose: '2000mg' },
  { name: 'L-Carnitine', dose: '2000mg' },
  { name: 'Selenium', dose: '200mcg' },
];

interface TimelineEvent {
  label: string;
  daysAgo: number;
  status: CycleStatus;
}

const MOCK_TIMELINE: TimelineEvent[] = [
  { label: 'Ovulation confirmed', daysAgo: 2, status: 'confirmed_ovulation' },
  { label: 'Fertile window opened', daysAgo: 5, status: 'high' },
  { label: 'Cycle started', daysAgo: 16, status: 'menstrual' },
];

interface EducationCard {
  question: string;
  answer: string;
}

const EDUCATION: EducationCard[] = [
  {
    question: 'Why does timing matter?',
    answer:
      'An egg lives only 12–24 hours after ovulation, but sperm can survive up to 5 days. The best odds come from having sperm already waiting when the egg is released. That means the 2–3 days before ovulation are the most important.',
  },
  {
    question: 'How to improve sperm quality',
    answer:
      "Avoid heat exposure (hot tubs, saunas, laptop on lap). Take your supplements daily. Exercise regularly but don't overtrain. Limit alcohol — even moderate drinking affects sperm count and morphology. Prioritize sleep. It takes ~74 days to produce new sperm, so consistency matters.",
  },
  {
    question: 'What is the TWW?',
    answer:
      "The TWW (two-week wait) is the ~14 days between ovulation and when a pregnancy test becomes reliable. It's one of the hardest stretches emotionally. She may symptom-spot, feel anxious, or swing between hope and dread. Your job: be steady, be present, and don't minimize her feelings.",
  },
  {
    question: 'What to say (and not say)',
    answer:
      'Say: "I\'m here." "Whatever happens, we\'re in this together." "What do you need from me right now?" Don\'t say: "Just relax." "It\'ll happen when it\'s meant to." "Have you tried…" "At least…" — She doesn\'t need solutions. She needs to feel heard.',
  },
];

function computeSpermScore(hotTubDays: number, alcoholFreeDays: number, exerciseSessions: number): number {
  const htScore = Math.min(hotTubDays, 14) / 14;
  const alcScore = Math.min(alcoholFreeDays, 7) / 7;
  const exScore = Math.min(exerciseSessions, 5) / 5;
  return Math.round((htScore * 35 + alcScore * 35 + exScore * 30));
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 50) return 'Good — room to improve';
  return 'Needs work';
}

export default function PartnerDashboard() {
  const [cycleStatus, setCycleStatus] = useState<CycleStatus>('high');
  const [signalSent, setSignalSent] = useState(false);
  const [signalResponse, setSignalResponse] = useState<string | null>(null);
  const [supplementChecks, setSupplementChecks] = useState<boolean[]>(
    () => SUPPLEMENTS.map(() => false),
  );
  const [hotTubDays, setHotTubDays] = useState(7);
  const [alcoholFreeDays, setAlcoholFreeDays] = useState(4);
  const [exerciseSessions, setExerciseSessions] = useState(3);
  const [expandedEdu, setExpandedEdu] = useState<number | null>(null);

  const [themeId, setThemeId] = useState(() => getSelectedTheme());
  const [showThemePicker, setShowThemePicker] = useState(false);
  const theme = getThemeById(themeId);

  useEffect(() => {
    const handleStorage = () => setThemeId(getSelectedTheme());
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(() => setThemeId(getSelectedTheme()), 2000);
    return () => { window.removeEventListener('storage', handleStorage); clearInterval(interval); };
  }, []);

  const phase = STATUS_TO_PHASE[cycleStatus];
  const action = PHASE_ACTIONS[phase];
  const spermScore = computeSpermScore(hotTubDays, alcoholFreeDays, exerciseSessions);

  const tier = mapStatusToTier(cycleStatus);
  const signalMsg = theme.messages[tier];
  const themedAction = theme.actionCards[phase];

  function toggleSupplement(idx: number) {
    setSupplementChecks(prev => prev.map((v, i) => (i === idx ? !v : v)));
  }

  const completedSupps = supplementChecks.filter(Boolean).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Demo Status Switcher */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(STATUS_MESSAGES) as CycleStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setCycleStatus(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
              cycleStatus === s
                ? 'bg-warm-800 text-white'
                : 'bg-warm-50 text-warm-400 hover:text-warm-600'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* 1. Hero Card */}
      <div className={`bg-gradient-to-br ${theme.gradient} rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-indigo-200/40 relative overflow-hidden`}>
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-medium text-white/90">
            {theme.emoji} {theme.name}
          </span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <User size={20} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Your Partner Dashboard</h1>
            <p className="text-sm text-white/70">Here's what you need to know — simplified.</p>
          </div>
        </div>
        {signalMsg.title && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg">{signalMsg.emoji}</span>
            <span className="text-sm font-semibold text-white/90">{signalMsg.title}</span>
          </div>
        )}
        <div className="mt-3 bg-white/15 rounded-2xl px-5 py-4 backdrop-blur-sm">
          <p className="text-lg font-semibold leading-snug">{STATUS_MESSAGES[cycleStatus]}</p>
          {theme.id !== 'silent' && signalMsg.body && (
            <p className="text-sm text-white/80 mt-2 leading-relaxed">{signalMsg.body}</p>
          )}
        </div>
      </div>

      {/* 2. What To Do Right Now */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-warm-100">
          <h2 className="text-base font-semibold text-warm-800">What To Do Right Now</h2>
        </div>
        <div className="p-5">
          {themedAction?.title ? (
            <div className={`rounded-2xl p-5 bg-gradient-to-br ${theme.gradient} bg-opacity-10`}>
              <div className="bg-white/90 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{action.icon}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-warm-800">{themedAction.title}</h3>
                    <p className="text-sm text-warm-500 mt-1 leading-relaxed">{themedAction.body}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`rounded-2xl p-5 ${phase === 'ovulatory' ? 'bg-warm-100' : 'bg-warm-50'}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{action.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-warm-800">{action.title}</h3>
                  <p className="text-sm text-warm-500 mt-1 leading-relaxed">{action.body}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. The Signal */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <Send size={16} strokeWidth={1.5} className="text-warm-500" />
            <h2 className="text-base font-semibold text-warm-800">The Signal {theme.emoji}</h2>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className={`rounded-2xl px-5 py-5 bg-gradient-to-br ${theme.gradient} relative overflow-hidden`}>
            <div className="absolute inset-0 bg-white/85" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${signalSent ? 'bg-emerald-500 animate-pulse' : 'bg-warm-300'}`} />
                <p className="text-sm font-medium text-warm-800">
                  {signalSent ? 'Signal received' : 'No signal yet'}
                </p>
              </div>
              {signalSent && signalMsg.title ? (
                <div className="mt-3">
                  <p className="text-base font-bold text-warm-800 flex items-center gap-2">
                    <span>{signalMsg.emoji}</span> {signalMsg.title}
                  </p>
                  {theme.id !== 'silent' && signalMsg.body && (
                    <p className="text-sm text-warm-600 mt-2 leading-relaxed">{signalMsg.body}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-warm-400 leading-relaxed mt-1">
                  She's letting you know the fertile window is here. No pressure, just awareness.
                </p>
              )}
            </div>
          </div>

          {!signalSent && (
            <button
              onClick={() => setSignalSent(true)}
              className="text-xs text-warm-600 hover:text-warm-800 font-medium transition-colors"
            >
              Simulate signal for demo →
            </button>
          )}

          {signalSent && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-warm-500">Quick response:</p>
              <div className="flex flex-wrap gap-2">
                {theme.quickReplies.map(btn => (
                  <button
                    key={btn.value}
                    onClick={() => setSignalResponse(btn.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-2xl transition-all ${
                      signalResponse === btn.value
                        ? 'bg-warm-800 text-white'
                        : 'bg-warm-50 text-warm-700 hover:bg-warm-100'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              {signalResponse && (
                <p className="text-xs text-emerald-600 font-medium mt-1">
                  <Check size={12} className="inline mr-1" />
                  Response sent
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3b. Customize Theme */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowThemePicker(!showThemePicker)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-warm-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings size={16} strokeWidth={1.5} className="text-warm-400" />
            <span className="text-sm font-medium text-warm-600">
              Notification Style: {theme.emoji} {theme.name}
            </span>
          </div>
          <span className="text-xs text-warm-400">
            {showThemePicker ? 'Close' : 'Change'}
          </span>
        </button>
        {showThemePicker && (
          <div className="px-5 pb-5 border-t border-warm-100">
            <p className="text-xs text-warm-400 mt-4 mb-3">Tap to switch how your notifications look and sound</p>
            <div className="grid grid-cols-2 gap-2">
              {SIGNAL_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setThemeId(t.id);
                    setSelectedTheme(t.id);
                  }}
                  className={`text-left rounded-xl overflow-hidden transition-all duration-200 ${
                    t.id === themeId
                      ? 'ring-2 ring-violet-500 ring-offset-1 shadow-sm'
                      : 'border border-warm-100 hover:border-warm-200'
                  }`}
                >
                  <div className={`h-1 bg-gradient-to-r ${t.gradient}`} />
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-base">{t.emoji}</span>
                      {t.id === themeId && (
                        <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-warm-800">{t.name}</p>
                    <p className="text-[10px] text-warm-400 leading-snug">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Supplements */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-warm-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-warm-800">Your Supplements</h2>
          <span className="text-xs font-medium text-warm-400">
            {completedSupps}/{SUPPLEMENTS.length} today
          </span>
        </div>
        <div className="p-5">
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-warm-100 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full transition-all duration-500`}
              style={{ width: `${(completedSupps / SUPPLEMENTS.length) * 100}%` }}
            />
          </div>
          <div className="space-y-2">
            {SUPPLEMENTS.map((supp, idx) => (
              <label
                key={supp.name}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all ${
                  supplementChecks[idx]
                    ? 'bg-warm-100'
                    : 'bg-warm-50 hover:bg-warm-100/60'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                    supplementChecks[idx]
                      ? 'bg-warm-700 border-warm-700'
                      : 'border-warm-200'
                  }`}
                >
                  {supplementChecks[idx] && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                <input
                  type="checkbox"
                  checked={supplementChecks[idx]}
                  onChange={() => toggleSupplement(idx)}
                  className="sr-only"
                />
                <div className="flex-1 flex items-baseline justify-between">
                  <span className={`text-sm font-medium ${supplementChecks[idx] ? 'text-warm-500 line-through' : 'text-warm-800'}`}>
                    {supp.name}
                  </span>
                  <span className="text-xs text-warm-400">{supp.dose}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Health Metrics */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-warm-100">
          <h2 className="text-base font-semibold text-warm-800">His Health Metrics</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Hot Tub Counter */}
            <div className="bg-warm-50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Thermometer size={16} strokeWidth={1.5} className="text-warm-600" />
                <span className="text-xs font-medium text-warm-500">Days since hot tub</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-warm-800">{hotTubDays}</span>
                <button
                  onClick={() => setHotTubDays(d => d + 1)}
                  className="ml-auto w-8 h-8 rounded-xl bg-white text-warm-600 hover:bg-warm-100 flex items-center justify-center text-lg font-medium transition-colors shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Alcohol-free Counter */}
            <div className="bg-warm-50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Beer size={16} strokeWidth={1.5} className="text-warm-600" />
                <span className="text-xs font-medium text-warm-500">Alcohol-free days</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-warm-800">{alcoholFreeDays}<span className="text-sm font-normal text-warm-400">/7</span></span>
                <button
                  onClick={() => setAlcoholFreeDays(d => Math.min(d + 1, 7))}
                  className="ml-auto w-8 h-8 rounded-xl bg-white text-warm-600 hover:bg-warm-100 flex items-center justify-center text-lg font-medium transition-colors shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Exercise Counter */}
            <div className="bg-warm-50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell size={16} strokeWidth={1.5} className="text-warm-600" />
                <span className="text-xs font-medium text-warm-500">Exercise sessions</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-warm-800">{exerciseSessions}<span className="text-sm font-normal text-warm-400">/wk</span></span>
                <button
                  onClick={() => setExerciseSessions(d => Math.min(d + 1, 7))}
                  className="ml-auto w-8 h-8 rounded-xl bg-white text-warm-600 hover:bg-warm-100 flex items-center justify-center text-lg font-medium transition-colors shadow-sm"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Sperm Health Score */}
          <div className="bg-warm-100 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-warm-500 mb-1">Sperm Health Score</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${scoreColor(spermScore)}`}>{spermScore}</span>
                  <span className="text-sm text-warm-400">/ 100</span>
                </div>
                <p className={`text-xs font-medium mt-1 ${scoreColor(spermScore)}`}>{scoreLabel(spermScore)}</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/80 flex items-center justify-center">
                <Zap size={28} strokeWidth={1.5} className={scoreColor(spermScore)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Timeline */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-warm-100 flex items-center gap-2">
          <Clock size={16} strokeWidth={1.5} className="text-warm-400" />
          <h2 className="text-base font-semibold text-warm-800">Recent Timeline</h2>
        </div>
        <div className="p-5">
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-warm-200" />
            {MOCK_TIMELINE.map((evt, idx) => (
              <div key={idx} className="relative flex items-start gap-4 pb-6 last:pb-0">
                <div className={`absolute left-[-15px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                  idx === 0 ? 'bg-warm-700' : 'bg-warm-300'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-warm-800">{evt.label}</p>
                  <p className="text-xs text-warm-400">
                    {evt.daysAgo === 0 ? 'Today' : `${evt.daysAgo} day${evt.daysAgo > 1 ? 's' : ''} ago`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. Education Cards */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-warm-100">
          <h2 className="text-base font-semibold text-warm-800">Things Worth Knowing</h2>
        </div>
        <div className="divide-y divide-warm-100">
          {EDUCATION.map((card, idx) => (
            <div key={idx}>
              <button
                onClick={() => setExpandedEdu(expandedEdu === idx ? null : idx)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-warm-50/50 transition-colors"
              >
                <span className="text-sm font-medium text-warm-800 pr-4">{card.question}</span>
                {expandedEdu === idx
                  ? <ChevronUp size={16} className="text-warm-400 shrink-0" />
                  : <ChevronDown size={16} className="text-warm-400 shrink-0" />
                }
              </button>
              {expandedEdu === idx && (
                <div className="px-6 pb-5">
                  <div className="bg-warm-50 rounded-2xl px-5 py-4">
                    <p className="text-sm text-warm-600 leading-relaxed">{card.answer}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
