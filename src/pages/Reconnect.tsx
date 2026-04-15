import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart,
  Clock,
  Play,
  Pause,
  SkipForward,
  Check,
  Lock,
  ChevronLeft,
  Volume2,
  VolumeX,
  BookOpen,
  Shield,
  X,
  Sparkles,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  reconnectDb,
  STAGES,
  CONTEXT_MESSAGES,
  INTIMACY_OPTIONS,
  TTC_FEELING_OPTIONS,
  PAST_OPTIONS,
  GOAL_OPTIONS,
  AMBIENT_SOUNDS,
  SESSION_LENGTHS,
  REMINDER_OPTIONS,
  getStageProgress,
  isStageUnlocked,
  getNextUnlockText,
  type ReconnectProfile,
  type ReconnectSession,
  type StageDefinition,
} from '../lib/reconnect-data';

type MainView = 'onboarding' | 'stages' | 'session' | 'history' | 'partner-guide';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Onboarding ─────────────────────────────────────────────────

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [intimacy, setIntimacy] = useState('');
  const [ttcFeeling, setTtcFeeling] = useState('');
  const [past, setPast] = useState('');
  const [goal, setGoal] = useState('');
  const [sessionLength, setSessionLength] = useState(20);
  const [ambientSound, setAmbientSound] = useState('silence');
  const [reminder, setReminder] = useState('weekly');
  const [showOnDashboard, setShowOnDashboard] = useState(false);
  const [partnerNotifications, setPartnerNotifications] = useState(false);
  const [saving, setSaving] = useState(false);

  const showTraumaNote = past === 'yes-therapy' || past === 'yes-no-therapy';

  async function saveProfile() {
    setSaving(true);
    await reconnectDb.profiles.add({
      role: 'her',
      onboardingComplete: true,
      currentStage: 1,
      intimacyLevel: intimacy,
      ttcFeeling,
      pastExperiences: past,
      goal,
      sessionLength,
      ambientSound,
      reminderFrequency: reminder,
      showOnDashboard,
      partnerNotifications,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    setStep(7);
  }

  if (step === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-4">
        <div className="w-full max-w-md bg-gradient-to-br from-rose-300 to-pink-400 rounded-3xl p-8 text-white shadow-lg shadow-rose-200/40 space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/20 flex items-center justify-center">
            <Heart size={28} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reconnect</h1>
            <p className="text-sm opacity-90 mt-1">Guided intimacy for couples</p>
          </div>
          <p className="text-sm leading-relaxed opacity-95">
            Trying to conceive can turn intimacy into a task. When sex becomes about
            timing and ovulation rather than connection, both partners can start
            dreading the fertile window instead of enjoying it.
          </p>
          <p className="text-sm leading-relaxed opacity-95">
            Reconnect is based on Sensate Focus, a clinically proven approach used by
            therapists worldwide. The core idea is simple: temporarily remove the
            pressure of performance and outcome, and rebuild touch as something you
            enjoy — not something you schedule.
          </p>
          <p className="text-sm leading-relaxed opacity-90">
            This isn't therapy. It's a guided practice you do together, at your own
            pace, in the privacy of your relationship. There are no wrong answers.
            There is no failing. There is only reconnecting with the person you chose.
          </p>
          <button
            onClick={() => setStep(1)}
            className="w-full py-3.5 bg-white text-rose-500 rounded-2xl text-sm font-semibold hover:bg-white/90 transition-colors active:scale-[0.98]"
          >
            Begin Together
          </button>
        </div>
        <p className="text-xs text-warm-300 mt-4 max-w-sm">
          Everything here is stored locally on your device and never shared
          with providers unless you choose.
        </p>
      </div>
    );
  }

  if (step >= 1 && step <= 4) {
    const questions = [
      {
        title: 'How would you describe your current physical intimacy?',
        options: INTIMACY_OPTIONS,
        value: intimacy,
        onChange: setIntimacy,
      },
      {
        title: 'How does timed intercourse for TTC make you feel?',
        options: TTC_FEELING_OPTIONS,
        value: ttcFeeling,
        onChange: setTtcFeeling,
      },
      {
        title: 'Is there anything in your past that makes physical intimacy feel unsafe or complicated?',
        options: PAST_OPTIONS,
        value: past,
        onChange: setPast,
      },
      {
        title: 'What do you most want from this experience?',
        options: GOAL_OPTIONS,
        value: goal,
        onChange: setGoal,
      },
    ];
    const q = questions[step - 1];

    return (
      <div className="max-w-md mx-auto space-y-6 py-8">
        <button
          onClick={() => setStep(step - 1)}
          className="flex items-center gap-1.5 text-sm text-warm-400 hover:text-warm-600 transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          Back
        </button>

        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                n <= step ? 'bg-gradient-to-r from-rose-400 to-pink-400' : 'bg-warm-100'
              }`}
            />
          ))}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-warm-300 font-semibold mb-1">
            Comfort Assessment
          </p>
          <h2 className="text-lg font-semibold text-warm-800 leading-snug">
            {q.title}
          </h2>
          <p className="text-xs text-warm-400 mt-1">
            There are no wrong answers.
          </p>
        </div>

        <div className="space-y-2.5">
          {q.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => q.onChange(opt.value)}
              className={`w-full text-left px-5 py-4 rounded-2xl border text-sm font-medium transition-all ${
                q.value === opt.value
                  ? 'border-rose-300 bg-rose-50 text-rose-700 shadow-sm'
                  : 'border-warm-100 bg-white text-warm-600 hover:border-warm-200 hover:bg-warm-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    q.value === opt.value ? 'border-rose-400 bg-rose-400' : 'border-warm-200'
                  }`}
                >
                  {q.value === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                {opt.label}
              </div>
            </button>
          ))}
        </div>

        {step === 3 && showTraumaNote && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-rose-400" strokeWidth={1.5} />
              <p className="text-sm font-medium text-rose-700">
                Thank you for sharing that
              </p>
            </div>
            <p className="text-xs text-rose-600/80 leading-relaxed">
              Reconnect is designed to be safe and gentle, and you control the pace
              at all times. We'll provide additional guidance throughout the stages.
              If at any point you'd like professional support, we can suggest
              trauma-informed therapists in your area.
            </p>
          </div>
        )}

        <button
          onClick={() => q.value && setStep(step + 1)}
          disabled={!q.value}
          className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] ${
            q.value
              ? 'bg-warm-800 text-white hover:bg-warm-700'
              : 'bg-warm-100 text-warm-300 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-8">
        <button
          onClick={() => setStep(4)}
          className="flex items-center gap-1.5 text-sm text-warm-400 hover:text-warm-600 transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          Back
        </button>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-warm-300 font-semibold mb-1">
            Preferences
          </p>
          <h2 className="text-lg font-semibold text-warm-800">
            Set up your sessions
          </h2>
        </div>

        {/* Session Length */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 space-y-3">
          <p className="text-sm font-medium text-warm-700">Session length</p>
          <div className="flex gap-2">
            {SESSION_LENGTHS.map((len) => (
              <button
                key={len}
                onClick={() => setSessionLength(len)}
                className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all ${
                  sessionLength === len
                    ? 'bg-gradient-to-r from-rose-400 to-pink-400 text-white shadow-sm'
                    : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
                }`}
              >
                {len} min
              </button>
            ))}
          </div>
        </div>

        {/* Ambient Sound */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 space-y-3">
          <p className="text-sm font-medium text-warm-700">Ambient sound</p>
          <div className="flex flex-wrap gap-2">
            {AMBIENT_SOUNDS.map((s) => (
              <button
                key={s.value}
                onClick={() => setAmbientSound(s.value)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                  ambientSound === s.value
                    ? 'bg-gradient-to-r from-rose-400 to-pink-400 text-white shadow-sm'
                    : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
                }`}
              >
                <span>{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reminder */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 space-y-3">
          <p className="text-sm font-medium text-warm-700">Reminder frequency</p>
          <div className="space-y-2">
            {REMINDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setReminder(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all flex items-center gap-3 ${
                  reminder === opt.value
                    ? 'border border-rose-300 bg-rose-50 text-rose-700'
                    : 'border border-warm-100 bg-white text-warm-600 hover:bg-warm-50'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    reminder === opt.value ? 'border-rose-400 bg-rose-400' : 'border-warm-200'
                  }`}
                >
                  {reminder === opt.value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-700">Show on dashboard</p>
              <p className="text-xs text-warm-400">Display Reconnect progress on your main screen</p>
            </div>
            <button
              onClick={() => setShowOnDashboard(!showOnDashboard)}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                showOnDashboard ? 'bg-rose-400' : 'bg-warm-200'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  showOnDashboard ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-700">Partner notifications</p>
              <p className="text-xs text-warm-400">Send session reminders to your partner</p>
            </div>
            <button
              onClick={() => setPartnerNotifications(!partnerNotifications)}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                partnerNotifications ? 'bg-rose-400' : 'bg-warm-200'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  partnerNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <button
          onClick={() => { setStep(6); saveProfile(); }}
          className="w-full py-3.5 bg-warm-800 text-white rounded-2xl text-sm font-semibold hover:bg-warm-700 transition-colors active:scale-[0.98]"
        >
          Save & Continue
        </button>
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-2 border-rose-300 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center shadow-lg shadow-rose-200/40 animate-pulse">
        <Sparkles size={32} className="text-white" strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-warm-800">You're ready</h1>
        <p className="text-sm text-warm-400 max-w-sm mx-auto leading-relaxed">
          Your Reconnect space is set up. Stage 1 is unlocked — start whenever
          you and your partner are ready. There is no rush. Your pace is the
          right pace.
        </p>
      </div>
      <button
        onClick={onComplete}
        disabled={saving}
        className="px-8 py-3.5 bg-warm-800 text-white rounded-2xl text-sm font-semibold hover:bg-warm-700 transition-colors active:scale-[0.98]"
      >
        Enter Reconnect
      </button>
    </div>
  );
}

// ─── Stage Map ──────────────────────────────────────────────────

function StageMap({
  sessions,
  profile,
  onStartSession,
  onViewHistory,
  onViewPartnerGuide,
}: {
  sessions: ReconnectSession[];
  profile: ReconnectProfile;
  onStartSession: (stage: StageDefinition) => void;
  onViewHistory: () => void;
  onViewPartnerGuide: () => void;
}) {
  const progress = getStageProgress(sessions);
  const [context, setContext] = useState<string | null>(null);
  const activeContext = CONTEXT_MESSAGES.find((c) => c.id === context);

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800 flex items-center gap-2">
            <Heart size={22} className="text-rose-400" strokeWidth={1.5} />
            Reconnect
          </h1>
          <p className="text-sm text-warm-400 mt-1">
            Your guided intimacy journey
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onViewPartnerGuide}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-warm-100 rounded-2xl text-xs font-medium text-warm-500 hover:bg-warm-50 transition-colors shadow-sm"
          >
            <BookOpen size={13} strokeWidth={1.5} />
            Partner Guide
          </button>
          <button
            onClick={onViewHistory}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-warm-100 rounded-2xl text-xs font-medium text-warm-500 hover:bg-warm-50 transition-colors shadow-sm"
          >
            <Clock size={13} strokeWidth={1.5} />
            History
          </button>
        </div>
      </div>

      {/* Stage Journey */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[29px] top-8 bottom-8 w-0.5 bg-warm-100" />

        <div className="space-y-4 relative">
          {STAGES.map((stage) => {
            const unlocked = isStageUnlocked(stage.number, progress);
            const completed = progress[stage.number] ?? 0;
            const isCurrent = stage.number === profile.currentStage;
            const unlockMsg = getNextUnlockText(stage.number, progress);
            const pct = stage.requiredSessions > 0
              ? Math.min((completed / stage.requiredSessions) * 100, 100)
              : (completed > 0 ? 100 : 0);

            return (
              <div
                key={stage.number}
                className={`relative pl-16 transition-all ${
                  !unlocked ? 'opacity-50' : ''
                }`}
              >
                {/* Stage number badge */}
                <div
                  className={`absolute left-3 top-4 w-[34px] h-[34px] rounded-full flex items-center justify-center text-sm font-bold z-10 ${
                    unlocked
                      ? `bg-gradient-to-br ${stage.gradient} text-white shadow-md`
                      : 'bg-warm-100 text-warm-400'
                  }`}
                >
                  {unlocked ? stage.emoji : <Lock size={14} strokeWidth={1.5} />}
                </div>

                <div
                  className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${
                    isCurrent && unlocked
                      ? 'border-rose-200 shadow-rose-100/50 ring-1 ring-rose-100/50'
                      : 'border-warm-100'
                  }`}
                >
                  <div className={`h-1.5 bg-gradient-to-r ${stage.gradient} ${unlocked ? 'opacity-80' : 'opacity-20'}`} />
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-warm-300 font-semibold">
                          Stage {stage.number}
                        </p>
                        <h3 className="text-base font-semibold text-warm-800">
                          {stage.title}
                        </h3>
                        <p className="text-xs text-warm-400 mt-0.5">{stage.subtitle}</p>
                      </div>
                      {isCurrent && unlocked && (
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-500">
                          Current
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-warm-400 leading-relaxed">
                      {stage.description}
                    </p>

                    {/* Progress */}
                    {stage.requiredSessions > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-warm-400">
                            {completed}/{stage.requiredSessions} sessions
                          </span>
                          <span className="text-warm-300 font-medium">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${stage.gradient} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {stage.requiredSessions === 0 && (
                      <p className="text-xs text-warm-400">
                        {completed} session{completed !== 1 ? 's' : ''} completed · Ongoing
                      </p>
                    )}

                    {unlocked ? (
                      <button
                        onClick={() => onStartSession(stage)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-warm-800 text-white rounded-2xl text-xs font-semibold hover:bg-warm-700 transition-colors active:scale-[0.98]"
                      >
                        <Play size={13} strokeWidth={1.5} />
                        Start Session
                      </button>
                    ) : (
                      unlockMsg && (
                        <p className="text-xs text-warm-300 flex items-center gap-1.5">
                          <Lock size={12} strokeWidth={1.5} />
                          {unlockMsg}
                        </p>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Context Messages Demo Toggles */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-warm-300">
          Context Modules
        </p>
        <div className="flex flex-wrap gap-2">
          {(['fertile-window', 'tww', 'post-loss', 'ivf'] as const).map((key) => {
            const msg = CONTEXT_MESSAGES.find((c) => c.id === key)!;
            return (
              <button
                key={key}
                onClick={() => setContext(context === key ? null : key)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-medium transition-all ${
                  context === key
                    ? 'bg-gradient-to-r from-rose-400 to-pink-400 text-white shadow-sm'
                    : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
                }`}
              >
                {msg.context}
              </button>
            );
          })}
        </div>

        {activeContext && (
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-100 rounded-2xl p-5 space-y-3 animate-in">
            <h3 className="text-sm font-semibold text-warm-800">
              {activeContext.title}
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-warm-300 font-semibold mb-1">For You</p>
                <p className="text-xs text-warm-500 leading-relaxed">{activeContext.forHer}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-warm-300 font-semibold mb-1">For Your Partner</p>
                <p className="text-xs text-warm-500 leading-relaxed">{activeContext.forPartner}</p>
              </div>
            </div>
            <p className="text-[10px] text-warm-300">
              Suggested: Stage {activeContext.suggestedStage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Session Player ─────────────────────────────────────────────

function SessionPlayer({
  stage,
  sessionLengthMin,
  onBack,
  onSessionSaved,
}: {
  stage: StageDefinition;
  sessionLengthMin: number;
  onBack: () => void;
  onSessionSaved: () => void;
}) {
  type Phase = 'rules' | 'active' | 'complete';
  const [phase, setPhase] = useState<Phase>('rules');
  const [isRunning, setIsRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(sessionLengthMin * 60 * 1000);
  const [showSwitchPrompt, setSwitchPrompt] = useState(false);
  const [hasShownSwitch, setHasShownSwitch] = useState(false);
  const [ambientSound, setAmbientSound] = useState('silence');
  const [showAmbientPicker, setShowAmbientPicker] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Session complete state
  const [observation, setObservation] = useState('');
  const [moodRating, setMoodRating] = useState(0);
  const [includedIntercourse, setIncludedIntercourse] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalMs = sessionLengthMin * 60 * 1000;
  const halfMs = totalMs / 2;
  const hasTurns = stage.number <= 2;
  const guideCards = hasTurns
    ? [
        ...stage.toucherGuide.map((t) => ({ role: 'Toucher', text: t })),
        ...stage.receiverGuide.map((t) => ({ role: 'Receiver', text: t })),
      ]
    : (stage.togetherGuide ?? []).map((t) => ({ role: 'Together', text: t }));

  // Timer refs
  const animRef = useRef(0);
  const lastTickRef = useRef(0);
  const remainingRef = useRef(remainingMs);

  useEffect(() => {
    remainingRef.current = remainingMs;
  }, [remainingMs]);

  const tick = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTickRef.current;
    lastTickRef.current = now;

    const next = remainingRef.current - delta;
    if (next <= 0) {
      setRemainingMs(0);
      remainingRef.current = 0;
      setIsRunning(false);
      setPhase('complete');
      return;
    }

    remainingRef.current = next;
    setRemainingMs(next);

    // Switch roles prompt at halfway for stages 1-2
    if (hasTurns && !hasShownSwitch && next <= halfMs && remainingRef.current < halfMs) {
      setSwitchPrompt(true);
      setHasShownSwitch(true);
    }

    animRef.current = requestAnimationFrame(tick);
  }, [hasTurns, hasShownSwitch, halfMs]);

  useEffect(() => {
    if (!isRunning || phase !== 'active') {
      cancelAnimationFrame(animRef.current);
      return;
    }
    lastTickRef.current = performance.now();
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isRunning, phase, tick]);

  const elapsedMs = totalMs - remainingMs;
  const progressFraction = Math.min(elapsedMs / totalMs, 1);
  const remainSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const circumference = 2 * Math.PI * 96;
  const dashOffset = circumference * (1 - progressFraction);

  const currentRole = hasTurns
    ? (elapsedMs < halfMs ? "Toucher's Turn" : "Receiver's Turn")
    : 'Together';

  async function saveSession() {
    setSaving(true);
    const durationMin = Math.round(elapsedMs / 60000);
    await reconnectDb.sessions.add({
      date: new Date().toISOString().split('T')[0],
      stage: stage.number,
      durationMin: Math.max(durationMin, 1),
      completed: true,
      ambientSoundUsed: ambientSound,
      observationHer: observation || undefined,
      moodHer: moodRating || undefined,
      includedIntercourse: stage.number === 4 ? includedIntercourse : undefined,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    onSessionSaved();
  }

  function handleEndEarly() {
    setShowEndConfirm(false);
    setIsRunning(false);
    setPhase('complete');
  }

  // Pre-session rules review
  if (phase === 'rules') {
    return (
      <div className="max-w-md mx-auto space-y-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-warm-400 hover:text-warm-600 transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          Back to stages
        </button>

        <div className="text-center space-y-1">
          <p className="text-3xl">{stage.emoji}</p>
          <h2 className="text-xl font-semibold text-warm-800">
            Stage {stage.number}: {stage.title}
          </h2>
          <p className="text-sm text-warm-400">{stage.subtitle}</p>
        </div>

        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 space-y-3">
          <p className="text-sm font-medium text-warm-700">Session guidelines</p>
          <div className="space-y-2">
            {stage.rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-3 text-xs text-warm-500 leading-relaxed">
                <Check size={14} className="text-teal-500 shrink-0 mt-0.5" strokeWidth={2} />
                {rule}
              </div>
            ))}
          </div>
        </div>

        {stage.traumaNote && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-rose-400" strokeWidth={1.5} />
              <p className="text-xs font-medium text-rose-700">A gentle note</p>
            </div>
            <p className="text-xs text-rose-600/80 leading-relaxed">
              {stage.traumaNote}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between bg-warm-50 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-warm-600">
            <Clock size={15} strokeWidth={1.5} />
            {sessionLengthMin} minutes
          </div>
          <div className="flex items-center gap-2 text-sm text-warm-600">
            <Volume2 size={15} strokeWidth={1.5} />
            {AMBIENT_SOUNDS.find((s) => s.value === ambientSound)?.label ?? 'Silence'}
          </div>
        </div>

        <button
          onClick={() => setPhase('active')}
          className="w-full py-3.5 bg-warm-800 text-white rounded-2xl text-sm font-semibold hover:bg-warm-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Play size={15} strokeWidth={1.5} />
          Ready to Begin
        </button>
      </div>
    );
  }

  // Session complete
  if (phase === 'complete') {
    return (
      <div className="max-w-md mx-auto space-y-6 py-4">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center shadow-lg shadow-rose-200/40">
            <Sparkles size={32} className="text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-warm-800">
              Beautiful session
            </h2>
            <p className="text-sm text-warm-400 mt-1 max-w-xs mx-auto">
              Stage {stage.number} · {Math.max(Math.round(elapsedMs / 60000), 1)} minutes
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-warm-700 mb-2">
              {stage.postPrompt}
            </p>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Your observation (optional)..."
              rows={3}
              className="w-full px-4 py-3 bg-warm-50 border border-warm-100 rounded-2xl text-sm text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-300 resize-none"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-warm-700 mb-2">How did this feel?</p>
            <div className="flex items-center gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setMoodRating(n)}
                  className="transition-transform active:scale-90 hover:scale-110"
                >
                  <Heart
                    size={28}
                    strokeWidth={1.5}
                    className={`transition-colors ${
                      n <= moodRating
                        ? 'text-rose-400 fill-rose-400'
                        : 'text-warm-200'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {stage.number === 4 && (
            <div className="flex items-center justify-between pt-2 border-t border-warm-100">
              <div>
                <p className="text-sm font-medium text-warm-700">
                  Did this session include intercourse?
                </p>
                <p className="text-[10px] text-warm-300 mt-0.5">
                  This helps with TTC tracking if you choose to sync it
                </p>
              </div>
              <button
                onClick={() => setIncludedIntercourse(!includedIntercourse)}
                className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${
                  includedIntercourse ? 'bg-rose-400' : 'bg-warm-200'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    includedIntercourse ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={saveSession}
          disabled={saving}
          className="w-full py-3.5 bg-warm-800 text-white rounded-2xl text-sm font-semibold hover:bg-warm-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Check size={15} strokeWidth={1.5} />
          {saving ? 'Saving...' : 'Save & Complete'}
        </button>
      </div>
    );
  }

  // Active session
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="max-w-md mx-auto space-y-5 py-4">
      {/* Switch roles overlay */}
      {showSwitchPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center">
              <SkipForward size={24} className="text-white" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-warm-800">Switch Roles</h3>
            <p className="text-sm text-warm-400">
              Halfway point — time to switch. The toucher becomes the receiver.
            </p>
            <button
              onClick={() => setSwitchPrompt(false)}
              className="w-full py-3 bg-warm-800 text-white rounded-2xl text-sm font-semibold hover:bg-warm-700 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* End early confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-warm-800">End session early?</h3>
            <p className="text-sm text-warm-400">
              Your progress will still be saved. Any session is a success.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-3 bg-warm-50 text-warm-600 rounded-2xl text-sm font-semibold hover:bg-warm-100 transition-colors"
              >
                Keep Going
              </button>
              <button
                onClick={handleEndEarly}
                className="flex-1 py-3 bg-warm-800 text-white rounded-2xl text-sm font-semibold hover:bg-warm-700 transition-colors"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-1">
        <p className={`text-xs font-semibold uppercase tracking-wider ${stage.color}`}>
          Stage {stage.number} · {stage.title}
        </p>
        <p className="text-sm font-medium text-warm-600">{currentRole}</p>
      </div>

      {/* Timer Circle */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-56 h-56 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100" cy="100" r="96"
              fill="none" stroke="currentColor"
              className="text-warm-100" strokeWidth="4"
            />
            <circle
              cx="100" cy="100" r="96"
              fill="none"
              stroke="url(#reconnect-grad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-100 ease-linear"
            />
            <defs>
              <linearGradient id="reconnect-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>

          <div className="text-center z-10">
            <p className="text-3xl font-bold text-warm-800 tabular-nums">
              {formatTime(remainSec)}
            </p>
            <p className="text-xs text-warm-400 mt-1">remaining</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center gap-2 px-7 py-3.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-700 transition-colors active:scale-95"
          >
            {isRunning ? (
              <><Pause size={16} strokeWidth={1.5} /> Pause</>
            ) : (
              <><Play size={16} strokeWidth={1.5} /> {elapsedMs > 0 ? 'Resume' : 'Start'}</>
            )}
          </button>
          {elapsedMs > 0 && (
            <button
              onClick={() => setShowEndConfirm(true)}
              className="flex items-center gap-2 px-5 py-3.5 bg-warm-50 text-warm-500 rounded-2xl text-sm font-medium hover:bg-warm-100 transition-colors active:scale-95"
            >
              <X size={14} strokeWidth={1.5} />
              End Early
            </button>
          )}
        </div>
      </div>

      {/* Guide Cards — horizontal scroll */}
      {guideCards.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-warm-300 px-1">
            Guidance
          </p>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
          >
            {guideCards.map((card, i) => (
              <div
                key={i}
                className="min-w-[260px] max-w-[280px] snap-center bg-white rounded-2xl border border-warm-100 shadow-sm p-4 space-y-2 shrink-0"
              >
                <span className={`text-[10px] uppercase tracking-wider font-semibold ${
                  card.role === 'Toucher' ? 'text-teal-500' :
                  card.role === 'Receiver' ? 'text-violet-500' : 'text-rose-500'
                }`}>
                  {card.role}
                </span>
                <p className="text-xs text-warm-500 leading-relaxed">{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ambient Sound */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => setShowAmbientPicker(!showAmbientPicker)}
          className="flex items-center gap-2 px-4 py-2 bg-warm-50 rounded-2xl text-xs font-medium text-warm-500 hover:bg-warm-100 transition-colors"
        >
          {ambientSound === 'silence' ? (
            <VolumeX size={14} strokeWidth={1.5} />
          ) : (
            <Volume2 size={14} strokeWidth={1.5} />
          )}
          {AMBIENT_SOUNDS.find((s) => s.value === ambientSound)?.label}
        </button>
      </div>
      {showAmbientPicker && (
        <div className="flex flex-wrap gap-2 justify-center">
          {AMBIENT_SOUNDS.map((s) => (
            <button
              key={s.value}
              onClick={() => { setAmbientSound(s.value); setShowAmbientPicker(false); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                ambientSound === s.value
                  ? 'bg-rose-400 text-white'
                  : 'bg-warm-50 text-warm-500 hover:bg-warm-100'
              }`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Session History ────────────────────────────────────────────

function SessionHistory({
  sessions,
  onBack,
}: {
  sessions: ReconnectSession[];
  onBack: () => void;
}) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const byStage: Record<number, ReconnectSession[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const s of sorted) {
    if (s.stage >= 1 && s.stage <= 4) byStage[s.stage].push(s);
  }

  // Streak calculation
  const dates = [...new Set(sorted.filter((s) => s.completed).map((s) => s.date))].sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (d.toISOString().split('T')[0] === expected.toISOString().split('T')[0]) {
      streak++;
    } else break;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-warm-400 hover:text-warm-600 transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
        Back to stages
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-warm-800">Session History</h1>
        <p className="text-sm text-warm-400 mt-1">Your Reconnect journey so far</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-warm-800">{sessions.filter((s) => s.completed).length}</p>
          <p className="text-xs text-warm-400 mt-0.5">Total sessions</p>
        </div>
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-warm-800">{streak}</p>
          <p className="text-xs text-warm-400 mt-0.5">Day streak</p>
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12">
          <Heart size={32} className="text-warm-200 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-warm-400">No sessions yet. Start your first one from the stage map.</p>
        </div>
      )}

      {STAGES.map((stage) => {
        const stageSessions = byStage[stage.number];
        if (stageSessions.length === 0) return null;
        return (
          <div key={stage.number} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-warm-300 flex items-center gap-1.5">
              <span>{stage.emoji}</span>
              Stage {stage.number}: {stage.title}
            </p>
            <div className="space-y-2">
              {stageSessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl border border-warm-100 shadow-sm px-5 py-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${stage.gradient} flex items-center justify-center text-white text-xs`}>
                      {stage.emoji}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-warm-700">{formatDate(s.date)}</p>
                      <p className="text-xs text-warm-400">{s.durationMin} min</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.oneWordHer && (
                      <span className="text-xs text-warm-400 italic">{s.oneWordHer}</span>
                    )}
                    {s.moodHer && (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Heart
                            key={n}
                            size={12}
                            strokeWidth={1.5}
                            className={n <= s.moodHer! ? 'text-rose-400 fill-rose-400' : 'text-warm-200'}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Partner Guide ──────────────────────────────────────────────

function PartnerGuide({ onBack }: { onBack: () => void }) {
  const sections = [
    {
      title: 'What this is',
      content:
        "Reconnect is a way to rebuild physical connection with your partner without the pressure of sex. You'll take turns touching and being touched — not to turn each other on, but to actually feel each other again. It sounds simple because it is. The hard part is slowing down enough to do it.",
    },
    {
      title: 'Why it matters for TTC',
      content:
        "When sex becomes about timing and ovulation, it stops being about the two of you. You might feel like a sperm donor instead of a partner. She might feel like an incubator instead of a woman. Reconnect fixes this by separating touch from performance. When you rebuild touch that has no agenda, the sex that follows is better for both of you — and actually more likely to result in conception because stress hormones are lower.",
    },
    {
      title: 'What to expect',
      content:
        "You might feel awkward at first. That's normal. You might get aroused during early stages when sex isn't on the table. That's normal too — and it's not a problem to solve. You might discover that being touched without having to do anything in return feels surprisingly good. That's the point.",
    },
    {
      title: 'The one rule',
      content:
        "When she says pause, you pause. No negotiation, no convincing, no guilt. The safety of knowing she can stop at any time is what allows her to start. Protect that safety like it's the most important thing in the room — because it is.",
      highlight: true,
    },
  ];

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-warm-400 hover:text-warm-600 transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
        Back to stages
      </button>

      <div className="bg-gradient-to-br from-blue-400 to-indigo-500 rounded-3xl p-6 text-white shadow-lg shadow-blue-200/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <BookOpen size={20} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold">His Guide to Reconnect</h1>
            <p className="text-sm opacity-80">For your partner</p>
          </div>
        </div>
        <p className="text-sm opacity-90 leading-relaxed">
          This page is designed to share with your partner so they understand
          what Reconnect is and how to participate.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((s, i) => (
          <div
            key={i}
            className={`bg-white rounded-3xl border shadow-sm p-5 space-y-2 ${
              s.highlight
                ? 'border-rose-200 bg-gradient-to-r from-white to-rose-50/30'
                : 'border-warm-100'
            }`}
          >
            <h3 className="text-sm font-semibold text-warm-800">{s.title}</h3>
            <p className="text-sm text-warm-500 leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function Reconnect() {
  const [view, setView] = useState<MainView>('stages');
  const [activeStage, setActiveStage] = useState<StageDefinition | null>(null);

  const profile = useLiveQuery(
    () => reconnectDb.profiles.toCollection().first().then(p => p ?? null),
    [],
    undefined as ReconnectProfile | null | undefined,
  );
  const sessions = useLiveQuery(() => reconnectDb.sessions.toArray()) ?? [];

  const isLoading = profile === undefined;
  const hasProfile = profile != null && profile.onboardingComplete;

  useEffect(() => {
    if (isLoading) return;
    if (!hasProfile) {
      setView('onboarding');
    }
  }, [isLoading, hasProfile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-rose-300 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (view === 'onboarding' || !hasProfile) {
    return <Onboarding onComplete={() => setView('stages')} />;
  }

  if (view === 'partner-guide') {
    return <PartnerGuide onBack={() => setView('stages')} />;
  }

  if (view === 'history') {
    return <SessionHistory sessions={sessions} onBack={() => setView('stages')} />;
  }

  if (view === 'session' && activeStage && profile) {
    return (
      <SessionPlayer
        stage={activeStage}
        sessionLengthMin={profile.sessionLength}
        onBack={() => { setView('stages'); setActiveStage(null); }}
        onSessionSaved={() => { setView('stages'); setActiveStage(null); }}
      />
    );
  }

  return (
    <StageMap
      sessions={sessions}
      profile={profile}
      onStartSession={(stage) => { setActiveStage(stage); setView('session'); }}
      onViewHistory={() => setView('history')}
      onViewPartnerGuide={() => setView('partner-guide')}
    />
  );
}
