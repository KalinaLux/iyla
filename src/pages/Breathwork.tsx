import { useState, useEffect, useRef } from 'react';
import {
  Wind,
  Clock,
  Play,
  Pause,
  Square,
  ChevronLeft,
  Sparkles,
  Heart,
  Moon,
  Shield,
  Users,
  Activity,
  Flame,
  Gift,
  Plus,
  Check,
  Trash2,
  ChevronRight,
  X,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BREATHWORK_SESSIONS,
  type BreathworkSession,
  type BreathPattern,
} from '../lib/breathwork-data';
import {
  breathworkDb,
  type BreathworkLog,
  MILESTONES,
  calculatePoints,
  calculateStreak,
  getNextMilestone,
  getReachedMilestones,
  getNewlyReachedMilestone,
} from '../lib/breathwork-rewards';

type SessionView = 'library' | 'player' | 'complete' | 'rewards';

const categoryMeta: Record<
  BreathworkSession['category'],
  { gradient: string; icon: React.ReactNode; label: string }
> = {
  regulation: {
    gradient: 'from-teal-400 to-cyan-400',
    icon: <Activity size={14} strokeWidth={1.5} />,
    label: 'Regulation',
  },
  relaxation: {
    gradient: 'from-violet-400 to-purple-400',
    icon: <Wind size={14} strokeWidth={1.5} />,
    label: 'Relaxation',
  },
  sleep: {
    gradient: 'from-indigo-500 to-blue-600',
    icon: <Moon size={14} strokeWidth={1.5} />,
    label: 'Sleep',
  },
  anxiety: {
    gradient: 'from-emerald-400 to-teal-400',
    icon: <Shield size={14} strokeWidth={1.5} />,
    label: 'Anxiety Relief',
  },
  couples: {
    gradient: 'from-rose-400 to-pink-400',
    icon: <Users size={14} strokeWidth={1.5} />,
    label: 'Couples',
  },
  'pre-procedure': {
    gradient: 'from-amber-400 to-orange-400',
    icon: <Heart size={14} strokeWidth={1.5} />,
    label: 'Pre-Procedure',
  },
};

function phaseDuration(pattern: BreathPattern): number[] {
  const phases: number[] = [pattern.inhale];
  if (pattern.holdIn) phases.push(pattern.holdIn);
  phases.push(pattern.exhale);
  if (pattern.holdOut) phases.push(pattern.holdOut);
  return phases;
}

function phaseLabels(pattern: BreathPattern): string[] {
  const labels: string[] =
    pattern.type === 'physiological-sigh' ? ['Double Inhale'] : ['Breathe In'];
  if (pattern.holdIn) labels.push('Hold');
  labels.push('Breathe Out');
  if (pattern.holdOut) labels.push('Hold');
  return labels;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function gentlePacingVibe() {
  if (!navigator.vibrate) return;
  navigator.vibrate(8);
}

/* ─── Library View ──────────────────────────────────────────────── */

function SessionLibrary({
  onSelect,
  onOpenRewards,
  logs,
}: {
  onSelect: (s: BreathworkSession) => void;
  onOpenRewards: () => void;
  logs: BreathworkLog[];
}) {
  const streak = calculateStreak(logs);
  const totalPoints = logs.reduce((s, l) => s + l.pointsEarned, 0);
  const totalMinutes = logs.reduce((s, l) => s + l.durationMin, 0);
  const totalSessions = logs.length;
  const nextMilestone = getNextMilestone(streak);
  const reached = getReachedMilestones(streak);
  const currentTitle = reached.length > 0 ? reached[reached.length - 1] : null;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold text-warm-800">
          Breathwork & Stress Reduction
        </h1>
        <p className="text-sm text-warm-400 mt-1 leading-relaxed max-w-lg">
          Rooted in the AquaAria method from{' '}
          <span className="italic text-warm-500">The Algorithm of Faith</span>{' '}
          by Kalina Lux. All sessions use nasal breathing only — in through the
          nose, out through the nose — to lower cortisol and activate your
          parasympathetic nervous system.
        </p>
      </div>

      {/* Streak & Score Hero Card */}
      <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 rounded-3xl p-5 text-white shadow-lg shadow-orange-200/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame size={20} strokeWidth={1.5} />
            <span className="text-sm font-semibold opacity-90">Your Practice</span>
          </div>
          <button
            onClick={onOpenRewards}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-medium transition-colors"
          >
            <Gift size={13} strokeWidth={1.5} />
            Rewards
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-[11px] opacity-80">day streak</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{totalPoints}</p>
            <p className="text-[11px] opacity-80">points</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{totalMinutes}</p>
            <p className="text-[11px] opacity-80">minutes</p>
          </div>
        </div>

        {currentTitle && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{currentTitle.emoji}</span>
            <span className="text-sm font-medium opacity-90">
              {currentTitle.label}
            </span>
            <span className="text-xs opacity-70">— {currentTitle.description}</span>
          </div>
        )}

        {nextMilestone && (
          <div className="bg-white/15 rounded-2xl px-4 py-2.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="opacity-80">
                Next: {nextMilestone.emoji} {nextMilestone.label}
              </span>
              <span className="font-semibold">
                {streak}/{nextMilestone.streakDays} days
              </span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min((streak / nextMilestone.streakDays) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {totalSessions === 0 && (
          <p className="text-xs opacity-70 mt-2 italic">
            Complete your first session to start your streak!
          </p>
        )}
      </div>

      {/* Nose-only reminder */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl border border-teal-100">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center shrink-0">
          <Wind size={14} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-warm-700">
            Always breathe through your nose
          </p>
          <p className="text-xs text-warm-400 mt-0.5">
            Nasal breathing filters air, produces nitric oxide, and activates
            the calm nervous system. Mouth breathing increases cortisol.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {BREATHWORK_SESSIONS.map((session) => {
          const meta = categoryMeta[session.category];
          const isAquaAria = session.id.startsWith('aquaaria');
          return (
            <button
              key={session.id}
              onClick={() => onSelect(session)}
              className={`text-left rounded-3xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group ${
                isAquaAria
                  ? 'border-rose-200 bg-gradient-to-br from-white to-rose-50/50 ring-1 ring-rose-100'
                  : 'border-warm-100 bg-white'
              }`}
            >
              <div
                className={`h-2 bg-gradient-to-r ${meta.gradient} opacity-80 group-hover:opacity-100 transition-opacity`}
              />
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {isAquaAria && (
                      <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-rose-400 mb-1">
                        From The Algorithm of Faith
                      </span>
                    )}
                    <h3 className="text-base font-semibold text-warm-800 leading-snug">
                      {session.name}
                    </h3>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-warm-400">
                    <Clock size={12} strokeWidth={1.5} />
                    {session.duration}m
                  </span>
                </div>

                <p className="text-sm text-warm-400 leading-relaxed line-clamp-2">
                  {session.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-white bg-gradient-to-r ${meta.gradient}`}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                  {session.cyclePhases.map((phase) => (
                    <span
                      key={phase}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-warm-50 text-warm-500 capitalize"
                    >
                      {phase}
                    </span>
                  ))}
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-teal-50 text-teal-600">
                    👃 Nose only
                  </span>
                </div>

                <p className="text-xs text-warm-400 italic">{session.benefit}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* AquaAria attribution */}
      <div className="text-center pt-4 pb-2 space-y-1">
        <p className="text-xs text-warm-400">
          Breathwork method based on AquaAria from{' '}
          <span className="italic">The Algorithm of Faith</span>
        </p>
        <p className="text-[11px] text-warm-300">
          Templīs Aquária · Kalina Lux · Open Source
        </p>
      </div>
    </div>
  );
}

/* ─── Session Player ────────────────────────────────────────────── */

function SessionPlayer({
  session,
  onBack,
  onComplete,
}: {
  session: BreathworkSession;
  onBack: () => void;
  onComplete: () => void;
}) {
  const meta = categoryMeta[session.category];
  const durations = phaseDuration(session.pattern);
  const labels = phaseLabels(session.pattern);
  const totalSeconds = session.duration * 60;
  const isCouples = session.category === 'couples';

  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [phaseIndex, setPhaseIndex] = useState(0);

  const [smoothScale, setSmoothScale] = useState(1);
  const [smoothProgress, setSmoothProgress] = useState(0);

  // Refs: source of truth for timing (avoids stale closures in rAF)
  const phaseIdxRef = useRef(0);
  const phaseStartRef = useRef(0);
  const cycleCountRef = useRef(1);
  const elapsedSecRef = useRef(0);
  const animRef = useRef(0);
  const sessionStartRef = useRef(0);

  function isExhalePhase(idx: number): boolean {
    return (durations.length === 2 && idx === 1) ||
      (durations.length === 3 && idx === (session.pattern.holdIn ? 2 : 1)) ||
      (durations.length === 4 && idx === 2);
  }

  const isInhale = phaseIndex === 0;
  const isExhale = isExhalePhase(phaseIndex);

  const progressFraction = elapsed / totalSeconds;

  // Single rAF loop drives everything — animation, phase transitions, elapsed time
  useEffect(() => {
    if (!isRunning) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    // On every start/resume: adjust timestamps to continue seamlessly
    const now = performance.now();
    const msIntoPhase = smoothProgress * durations[phaseIdxRef.current] * 1000;
    phaseStartRef.current = now - msIntoPhase;
    sessionStartRef.current = now - elapsedSecRef.current * 1000;

    function animate() {
      const now = performance.now();
      let pIdx = phaseIdxRef.current;
      let msInPhase = now - phaseStartRef.current;
      let totalMs = durations[pIdx] * 1000;

      // Advance through completed phases instantly (handles overshoot)
      while (msInPhase >= totalMs) {
        const overshoot = msInPhase - totalMs;
        const nextPhase = (pIdx + 1) % durations.length;
        phaseIdxRef.current = nextPhase;
        phaseStartRef.current = now - overshoot;
        if (nextPhase === 0) {
          cycleCountRef.current += 1;
          setCurrentCycle(cycleCountRef.current);
        }
        setPhaseIndex(nextPhase);
        pIdx = nextPhase;
        msInPhase = overshoot;
        totalMs = durations[pIdx] * 1000;
      }

      // Smooth progress 0→1 within current phase
      const p = Math.min(msInPhase / totalMs, 1);
      setSmoothProgress(p);

      // Sine-eased scale
      const currentIsInhale = pIdx === 0;
      const currentIsExhale = isExhalePhase(pIdx);

      let s: number;
      if (currentIsInhale) {
        s = 1 + 0.35 * Math.sin(p * Math.PI / 2);
      } else if (currentIsExhale) {
        s = 1 + 0.35 * Math.cos(p * Math.PI / 2);
      } else {
        const holdScale = pIdx < 2 ? 1.35 : 1;
        s = holdScale + Math.sin(now / 2000) * 0.008;
      }
      setSmoothScale(s);

      // Update elapsed once per second
      const totalElapsedSec = Math.floor((now - sessionStartRef.current) / 1000);
      if (totalElapsedSec !== elapsedSecRef.current) {
        elapsedSecRef.current = totalElapsedSec;
        setElapsed(totalElapsedSec);

        if (totalElapsedSec >= totalSeconds) {
          cancelAnimationFrame(animRef.current);
          onComplete();
          return;
        }
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
    // smoothProgress is read once on mount/resume — not a reactive dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, durations, totalSeconds, onComplete]);

  // Gentle exhale pacing — soft micro-vibes every 3s
  useEffect(() => {
    if (!isRunning || !isExhale) return;
    const t = setInterval(gentlePacingVibe, 3000);
    return () => clearInterval(t);
  }, [isRunning, isExhale]);

  function handlePlayPause() {
    setIsRunning((prev) => !prev);
  }

  function handleStop() {
    setIsRunning(false);
    phaseIdxRef.current = 0;
    phaseStartRef.current = 0;
    sessionStartRef.current = 0;
    elapsedSecRef.current = 0;
    cycleCountRef.current = 1;
    onBack();
  }

  const circumference = 2 * Math.PI * 96;
  const dashOffset = circumference * (1 - progressFraction);

  // Flow rate: shows how fast the breath is moving (0 at transitions, 1 in the middle)
  const flowRate = isInhale
    ? Math.cos(smoothProgress * Math.PI / 2)
    : isExhale
      ? Math.sin(smoothProgress * Math.PI / 2)
      : 0;

  // Transition coaching — appears near the inhale peak and just after
  const nearTopTransition = isRunning && isInhale && smoothProgress > 0.82;
  const justAfterTop = isRunning && isExhale && smoothProgress < 0.12;
  const coachingText = nearTopTransition
    ? 'soften...'
    : justAfterTop
      ? 'gently release...'
      : null;

  // Nose cue — cross-fades between phases
  const noseLabel = isInhale
    ? '👃 In through your nose'
    : isExhale
      ? '👃 Out through your nose'
      : '🤫 Hold still';

  // Countdown — computed from smooth progress for accuracy
  const countdown = Math.max(0, Math.ceil(durations[phaseIndex] * (1 - smoothProgress)));

  function renderOrbContent(running: boolean, elapsedVal: number, icon: React.ReactNode) {
    if (!running && elapsedVal === 0) return icon;
    if (!running) return <p className="text-base font-semibold">Paused</p>;
    return (
      <div className="text-center">
        <p
          className="text-base sm:text-lg font-semibold tracking-wide transition-opacity duration-700"
          style={{ opacity: coachingText ? 0.5 : 1 }}
        >
          {labels[phaseIndex]}
        </p>
        {coachingText && (
          <p className="text-xs sm:text-sm opacity-90 mt-0.5 italic tracking-wide animate-pulse">
            {coachingText}
          </p>
        )}
        {!coachingText && (
          <p className="text-xs sm:text-sm opacity-70 mt-0.5">{countdown}s</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-warm-400 hover:text-warm-600 transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
        Back to sessions
      </button>

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold text-warm-800">{session.name}</h1>
        <p className="text-sm text-warm-400 max-w-md mx-auto">{session.description}</p>
      </div>

      {/* Breathing Circle */}
      <div className="flex flex-col items-center gap-5 py-4">
        {isCouples ? (
          /* ─── Couples: Two Orbs ──────────────────────────── */
          <div className="relative flex items-center justify-center gap-6 sm:gap-10">
            {/* Her orb */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 shadow-lg shadow-rose-200/40 flex items-center justify-center text-white"
                style={{ transform: `scale(${smoothScale})` }}
              >
                {renderOrbContent(
                  isRunning,
                  elapsed,
                  <Heart size={28} strokeWidth={1.5} className="opacity-80" />,
                )}
              </div>
              <span className="text-xs text-warm-400 font-medium">You</span>
            </div>

            {/* Connection pulse — fades with flow rate */}
            {isRunning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="w-16 h-1 rounded-full bg-gradient-to-r from-rose-300 via-violet-200 to-blue-300"
                  style={{
                    opacity: 0.15 + flowRate * 0.5,
                    transform: `scaleX(${0.4 + flowRate * 0.6})`,
                    transition: 'opacity 300ms ease, transform 300ms ease',
                  }}
                />
              </div>
            )}

            {/* His orb */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-200/40 flex items-center justify-center text-white"
                style={{ transform: `scale(${smoothScale})` }}
              >
                {renderOrbContent(
                  isRunning,
                  elapsed,
                  <Heart size={28} strokeWidth={1.5} className="opacity-80" />,
                )}
              </div>
              <span className="text-xs text-warm-400 font-medium">Partner</span>
            </div>
          </div>
        ) : (
          /* ─── Solo: Single Orb with Progress Ring ────────── */
          <div className="relative w-56 h-56 flex items-center justify-center">
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 200 200"
            >
              <circle
                cx="100"
                cy="100"
                r="96"
                fill="none"
                stroke="currentColor"
                className="text-warm-100"
                strokeWidth="4"
              />
              <circle
                cx="100"
                cy="100"
                r="96"
                fill="none"
                stroke="url(#progress-gradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
              <defs>
                <linearGradient
                  id="progress-gradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    className={gradientStartColor(session.category)}
                  />
                  <stop
                    offset="100%"
                    className={gradientEndColor(session.category)}
                  />
                </linearGradient>
              </defs>
            </svg>

            <div
              className={`w-40 h-40 rounded-full bg-gradient-to-br ${meta.gradient} shadow-lg flex items-center justify-center text-white`}
              style={{ transform: `scale(${smoothScale})` }}
            >
              {renderOrbContent(
                isRunning,
                elapsed,
                <Wind size={32} strokeWidth={1.5} className="opacity-80" />,
              )}
            </div>
          </div>
        )}

        {/* Flow rate indicator — shows how fast the breath is flowing */}
        {isRunning && (
          <div className="flex flex-col items-center gap-2 w-48">
            <div className="w-full h-1 rounded-full bg-warm-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  isInhale
                    ? 'bg-gradient-to-r from-teal-300 to-teal-400'
                    : isExhale
                      ? 'bg-gradient-to-r from-violet-300 to-violet-400'
                      : 'bg-warm-200'
                }`}
                style={{ width: `${Math.max(flowRate * 100, 3)}%` }}
              />
            </div>
            <p className="text-[11px] text-warm-300 font-medium">
              {flowRate < 0.15 ? 'almost still...' : flowRate < 0.4 ? 'gentle...' : 'flowing'}
            </p>
          </div>
        )}

        {/* Nose-only cue */}
        {isRunning && (
          <div
            className="text-sm font-medium transition-all duration-700"
            style={{
              color: isInhale ? '#14b8a6' : isExhale ? '#8b5cf6' : '#a0a0a0',
              opacity: coachingText ? 0.4 : 0.9,
            }}
          >
            {noseLabel}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm text-warm-500">
          <span>
            Breath{' '}
            <span className="font-semibold text-warm-700">
              {Math.min(currentCycle, session.pattern.cycles)}
            </span>{' '}
            of {session.pattern.cycles}
          </span>
          <span className="w-px h-4 bg-warm-200" />
          <span>
            <span className="font-semibold text-warm-700">
              {formatTime(elapsed)}
            </span>{' '}
            / {formatTime(totalSeconds)}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayPause}
            className="flex items-center gap-2 px-7 py-3.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-700 transition-colors active:scale-95"
          >
            {isRunning ? (
              <>
                <Pause size={16} strokeWidth={1.5} />
                Pause
              </>
            ) : (
              <>
                <Play size={16} strokeWidth={1.5} />
                {elapsed > 0 ? 'Resume' : 'Begin'}
              </>
            )}
          </button>
          {elapsed > 0 && (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-5 py-3.5 bg-warm-50 text-warm-500 rounded-2xl text-sm font-medium hover:bg-warm-100 hover:text-warm-600 transition-colors active:scale-95"
            >
              <Square size={14} strokeWidth={1.5} />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* AquaAria notes */}
      {session.aquaariaNotes && (
        <div className="bg-gradient-to-r from-warm-50 to-rose-50/30 rounded-3xl border border-warm-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-warm-300 mb-2">
            AquaAria Guidance
          </p>
          <p className="text-sm text-warm-500 leading-relaxed italic">
            "{session.aquaariaNotes}"
          </p>
        </div>
      )}

      {/* Transition coaching card */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold text-warm-700">
          The Seamless Transition
        </h3>
        <p className="text-xs text-warm-400 leading-relaxed">
          The secret is at the top of the breath. As the inhale reaches its
          peak, don't stop — let it{' '}
          <span className="text-warm-600 italic">turn</span>. Like a wave
          cresting, the exhale begins from the same momentum. No pause, no
          blast. Breathe like a ninja — so stealthily that the transition is
          invisible. Watch the flow indicator: when it reaches stillness, you're
          in the turn.
        </p>
      </div>

      {/* Pattern info */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-warm-700 mb-3">
          Breathing Pattern
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          {labels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-warm-200">→</span>
              )}
              <div
                className={`px-3.5 py-2 rounded-xl text-xs font-medium ${
                  isRunning && phaseIndex === i
                    ? `text-white bg-gradient-to-r ${meta.gradient}`
                    : 'bg-warm-50 text-warm-500'
                } transition-all duration-500`}
              >
                {label} · {durations[i]}s
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-teal-500 font-medium">
          👃 Nose only — inhale and exhale through your nose
        </p>
      </div>
    </div>
  );
}

/* ─── Completion Screen ─────────────────────────────────────────── */

function SessionComplete({
  session,
  onBack,
  pointsEarned,
  newStreak,
  newMilestone,
  milestoneReward,
}: {
  session: BreathworkSession;
  onBack: () => void;
  pointsEarned: number;
  newStreak: number;
  newMilestone: { emoji: string; label: string; description: string } | null;
  milestoneReward: string | null;
}) {
  const meta = categoryMeta[session.category];
  const isCouples = session.category === 'couples';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      {isCouples ? (
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center shadow-lg">
            <Heart size={24} className="text-white" strokeWidth={1.5} />
          </div>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
            <Heart size={24} className="text-white" strokeWidth={1.5} />
          </div>
        </div>
      ) : (
        <div
          className={`w-24 h-24 rounded-full bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow-lg`}
        >
          <Sparkles size={32} className="text-white" strokeWidth={1.5} />
        </div>
      )}

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-warm-800">
          {isCouples ? 'Beautiful practice, together' : 'Beautiful practice'}
        </h1>
        <p className="text-sm text-warm-400 max-w-sm mx-auto leading-relaxed">
          {isCouples
            ? `You just shared ${session.duration} minutes of synchronized breath. Notice the stillness between you. That connection is real.`
            : `You just completed ${session.duration} minutes of ${session.name.toLowerCase()}. Take a moment to notice how your body feels right now.`}
        </p>
      </div>

      {/* Points & streak earned */}
      <div className="flex items-center gap-4">
        <div className="bg-gradient-to-br from-amber-400 to-orange-400 text-white px-5 py-3 rounded-2xl">
          <p className="text-xl font-bold">+{pointsEarned}</p>
          <p className="text-[10px] opacity-80">points</p>
        </div>
        <div className="bg-gradient-to-br from-rose-400 to-pink-400 text-white px-5 py-3 rounded-2xl">
          <div className="flex items-center gap-1">
            <Flame size={16} strokeWidth={1.5} />
            <p className="text-xl font-bold">{newStreak}</p>
          </div>
          <p className="text-[10px] opacity-80">day streak</p>
        </div>
      </div>

      {/* Milestone celebration */}
      {newMilestone && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 max-w-sm w-full space-y-3 animate-pulse">
          <div className="text-4xl">{newMilestone.emoji}</div>
          <h2 className="text-lg font-bold text-warm-800">
            Milestone Reached: {newMilestone.label}!
          </h2>
          <p className="text-sm text-warm-500">{newMilestone.description}</p>
          {milestoneReward && (
            <div className="bg-white rounded-2xl p-4 border border-amber-100">
              <p className="text-xs text-warm-400 mb-1">You earned your reward:</p>
              <p className="text-base font-semibold text-warm-800 flex items-center justify-center gap-2">
                <Gift size={16} className="text-amber-500" />
                {milestoneReward}
              </p>
            </div>
          )}
        </div>
      )}

      {session.aquaariaNotes && !newMilestone && (
        <div className="bg-warm-50 rounded-2xl px-6 py-4 max-w-sm">
          <p className="text-xs text-warm-500 italic leading-relaxed">
            "The inhale is a gift received from the Divine. The exhale is an
            offering, a surrender of the self into unity with all that is."
          </p>
          <p className="text-[10px] text-warm-300 mt-2">
            — The Algorithm of Faith, Kalina Lux
          </p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-5 max-w-xs w-full space-y-3">
        <p className="text-sm font-medium text-warm-700">How do you feel?</p>
        <div className="flex justify-center gap-3">
          {['😌', '😊', '😴', '💪', '🥰'].map((emoji) => (
            <button
              key={emoji}
              className="w-11 h-11 rounded-xl bg-warm-50 hover:bg-warm-100 flex items-center justify-center text-xl transition-colors active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onBack}
        className="px-7 py-3.5 bg-warm-800 text-white rounded-2xl text-sm font-medium hover:bg-warm-700 transition-colors active:scale-95"
      >
        Back to Sessions
      </button>
    </div>
  );
}

/* ─── Rewards Management View ──────────────────────────────────── */

function RewardsView({ onBack, logs }: { onBack: () => void; logs: BreathworkLog[] }) {
  const rewards = useLiveQuery(() => breathworkDb.rewards.toArray()) ?? [];
  const streak = calculateStreak(logs);
  const reached = getReachedMilestones(streak);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [rewardInput, setRewardInput] = useState('');

  async function saveReward(milestoneKey: string) {
    if (!rewardInput.trim()) return;
    const existing = rewards.find((r) => r.milestoneKey === milestoneKey);
    if (existing?.id) {
      await breathworkDb.rewards.update(existing.id, { rewardText: rewardInput.trim() });
    } else {
      await breathworkDb.rewards.add({ milestoneKey, rewardText: rewardInput.trim() });
    }
    setEditingKey(null);
    setRewardInput('');
  }

  async function deleteReward(milestoneKey: string) {
    const existing = rewards.find((r) => r.milestoneKey === milestoneKey);
    if (existing?.id) await breathworkDb.rewards.delete(existing.id);
  }

  async function claimReward(milestoneKey: string) {
    const existing = rewards.find((r) => r.milestoneKey === milestoneKey);
    if (existing?.id) {
      await breathworkDb.rewards.update(existing.id, { claimedAt: new Date().toISOString() });
    }
  }

  return (
    <div className="space-y-7">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-warm-400 hover:text-warm-600 transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
        Back to sessions
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-warm-800 flex items-center gap-2">
          <Gift size={22} className="text-amber-500" />
          Couple Rewards
        </h1>
        <p className="text-sm text-warm-400 mt-1 leading-relaxed max-w-lg">
          Set rewards together for each streak milestone. When you reach it, you
          both earn the reward. Something to look forward to — together.
        </p>
      </div>

      <div className="space-y-3">
        {MILESTONES.map((milestone) => {
          const reward = rewards.find((r) => r.milestoneKey === milestone.key);
          const isReached = reached.some((r) => r.key === milestone.key);
          const isEditing = editingKey === milestone.key;
          const isClaimed = !!reward?.claimedAt;

          return (
            <div
              key={milestone.key}
              className={`bg-white rounded-3xl border shadow-sm p-5 transition-all ${
                isReached
                  ? 'border-amber-200 bg-gradient-to-r from-white to-amber-50/30'
                  : 'border-warm-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{milestone.emoji}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-warm-800">
                      {milestone.label}
                      {isReached && (
                        <span className="ml-2 text-xs text-amber-500 font-medium">
                          ✓ Reached!
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-warm-400">
                      {milestone.description} · {milestone.streakDays} days
                    </p>
                  </div>
                </div>

                {!isReached && (
                  <div className="text-xs text-warm-300 font-medium shrink-0">
                    {streak}/{milestone.streakDays}
                  </div>
                )}
              </div>

              {/* Reward display / editor */}
              <div className="mt-3">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rewardInput}
                      onChange={(e) => setRewardInput(e.target.value)}
                      placeholder="e.g., Massage night, Dinner out..."
                      className="flex-1 px-3 py-2 text-sm bg-warm-50 border border-warm-200 rounded-xl text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-warm-400"
                      onKeyDown={(e) => e.key === 'Enter' && saveReward(milestone.key)}
                      autoFocus
                    />
                    <button
                      onClick={() => saveReward(milestone.key)}
                      className="p-2 bg-warm-800 text-white rounded-xl hover:bg-warm-700 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => { setEditingKey(null); setRewardInput(''); }}
                      className="p-2 bg-warm-50 text-warm-400 rounded-xl hover:bg-warm-100 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : reward ? (
                  <div className="flex items-center justify-between gap-2 bg-warm-50 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Gift size={14} className="text-amber-500 shrink-0" />
                      <span className={`text-sm font-medium ${isClaimed ? 'line-through text-warm-300' : 'text-warm-700'}`}>
                        {reward.rewardText}
                      </span>
                      {isClaimed && (
                        <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">
                          Claimed!
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isReached && !isClaimed && (
                        <button
                          onClick={() => claimReward(milestone.key)}
                          className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium"
                        >
                          Claim
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingKey(milestone.key); setRewardInput(reward.rewardText); }}
                        className="p-1.5 text-warm-300 hover:text-warm-500 transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => deleteReward(milestone.key)}
                        className="p-1.5 text-warm-300 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingKey(milestone.key); setRewardInput(milestone.defaultReward); }}
                    className="flex items-center gap-2 text-xs text-warm-400 hover:text-warm-600 transition-colors"
                  >
                    <Plus size={13} />
                    Set a reward for this milestone
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Gradient helpers for SVG stops ────────────────────────────── */

function gradientStartColor(
  category: BreathworkSession['category'],
): string {
  const map: Record<BreathworkSession['category'], string> = {
    regulation: '[stop-color:#2dd4bf]',
    relaxation: '[stop-color:#a78bfa]',
    sleep: '[stop-color:#6366f1]',
    anxiety: '[stop-color:#34d399]',
    couples: '[stop-color:#fb7185]',
    'pre-procedure': '[stop-color:#fbbf24]',
  };
  return map[category];
}

function gradientEndColor(
  category: BreathworkSession['category'],
): string {
  const map: Record<BreathworkSession['category'], string> = {
    regulation: '[stop-color:#22d3ee]',
    relaxation: '[stop-color:#a855f7]',
    sleep: '[stop-color:#2563eb]',
    anxiety: '[stop-color:#14b8a6]',
    couples: '[stop-color:#ec4899]',
    'pre-procedure': '[stop-color:#f97316]',
  };
  return map[category];
}

/* ─── Main Page Component ───────────────────────────────────────── */

export default function Breathwork() {
  const [view, setView] = useState<SessionView>('library');
  const [activeSession, setActiveSession] = useState<BreathworkSession | null>(null);
  const [lastPointsEarned, setLastPointsEarned] = useState(0);
  const [lastNewStreak, setLastNewStreak] = useState(0);
  const [lastNewMilestone, setLastNewMilestone] = useState<{
    emoji: string;
    label: string;
    description: string;
  } | null>(null);
  const [lastMilestoneReward, setLastMilestoneReward] = useState<string | null>(null);

  const logs = useLiveQuery(() =>
    breathworkDb.logs.orderBy('date').reverse().toArray(),
  ) ?? [];

  function handleSelect(session: BreathworkSession) {
    setActiveSession(session);
    setView('player');
  }

  async function handleComplete() {
    if (!activeSession) return;

    const today = new Date().toISOString().split('T')[0];
    const isCouples = activeSession.category === 'couples';
    const oldStreak = calculateStreak(logs);
    const points = calculatePoints(activeSession.duration, isCouples, oldStreak);

    await breathworkDb.logs.add({
      date: today,
      sessionId: activeSession.id,
      sessionName: activeSession.name,
      category: activeSession.category,
      durationMin: activeSession.duration,
      isCouples,
      pointsEarned: points,
      completedAt: new Date().toISOString(),
    });

    // Re-fetch logs to compute new streak
    const updatedLogs = await breathworkDb.logs.orderBy('date').reverse().toArray();
    const newStreak = calculateStreak(updatedLogs);
    const milestone = getNewlyReachedMilestone(oldStreak, newStreak);

    setLastPointsEarned(points);
    setLastNewStreak(newStreak);
    setLastNewMilestone(milestone);

    if (milestone) {
      const reward = await breathworkDb.rewards
        .where('milestoneKey')
        .equals(milestone.key)
        .first();
      setLastMilestoneReward(reward?.rewardText ?? null);
    } else {
      setLastMilestoneReward(null);
    }

    setView('complete');
  }

  function handleBack() {
    setView('library');
    setActiveSession(null);
  }

  if (view === 'rewards') {
    return <RewardsView onBack={handleBack} logs={logs} />;
  }

  if (view === 'complete' && activeSession) {
    return (
      <SessionComplete
        session={activeSession}
        onBack={handleBack}
        pointsEarned={lastPointsEarned}
        newStreak={lastNewStreak}
        newMilestone={lastNewMilestone}
        milestoneReward={lastMilestoneReward}
      />
    );
  }

  if (view === 'player' && activeSession) {
    return (
      <SessionPlayer
        session={activeSession}
        onBack={handleBack}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <SessionLibrary
      onSelect={handleSelect}
      onOpenRewards={() => setView('rewards')}
      logs={logs}
    />
  );
}
