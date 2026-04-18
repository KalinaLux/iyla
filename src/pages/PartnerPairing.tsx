import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Link,
  Key,
  Smartphone,
  Shield,
  Copy,
  Check,
  Unlink,
  Eye,
  EyeOff,
  Zap,
  Heart,
  Pill,
  Activity,
  FlaskConical,
  Wind,
  Send,
  MessageCircle,
} from 'lucide-react';
import { SIGNAL_THEMES, getSelectedTheme, setSelectedTheme } from '../lib/signal-themes';
import {
  savePairCode,
  getPairCode,
  pullStatus,
  isSyncEnabled,
  type PartnerStatus,
} from '../lib/sync';

interface SharingOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultOn: boolean;
}

const SHARING_OPTIONS: SharingOption[] = [
  {
    id: 'cycle',
    label: 'Cycle Status',
    description: 'Current phase, fertility window, and cycle day',
    icon: <Activity size={18} strokeWidth={1.5} className="text-violet-500" />,
    defaultOn: true,
  },
  {
    id: 'ovulation',
    label: 'Ovulation Alerts ("The Signal")',
    description: 'Notifications when the fertile window opens',
    icon: <Zap size={18} strokeWidth={1.5} className="text-indigo-500" />,
    defaultOn: true,
  },
  {
    id: 'supplements',
    label: 'Supplement Compliance',
    description: 'Whether daily supplements were taken',
    icon: <Pill size={18} strokeWidth={1.5} className="text-teal-500" />,
    defaultOn: false,
  },
  {
    id: 'mood',
    label: 'Mood & Energy',
    description: 'General mood and energy level summary',
    icon: <Heart size={18} strokeWidth={1.5} className="text-rose-400" />,
    defaultOn: false,
  },
  {
    id: 'labs',
    label: 'Lab Results',
    description: 'Hormone levels, bloodwork summaries',
    icon: <FlaskConical size={18} strokeWidth={1.5} className="text-amber-500" />,
    defaultOn: false,
  },
  {
    id: 'breathwork',
    label: 'Breathwork Activity',
    description: 'Session completions and streak status',
    icon: <Wind size={18} strokeWidth={1.5} className="text-cyan-500" />,
    defaultOn: true,
  },
];

const CODE_EXPIRY_SECONDS = 600;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
        on ? 'bg-violet-500' : 'bg-warm-200'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

const TIER_META: { tier: 'approaching' | 'window_open' | 'peak_day' | 'window_closed'; label: string; timing: string; color: string; dot: string }[] = [
  { tier: 'approaching', label: '3 Days Before', timing: '~CD 11', color: 'bg-amber-50 border-amber-100', dot: 'bg-amber-400' },
  { tier: 'window_open', label: 'Window Opens', timing: '~CD 12-13', color: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' },
  { tier: 'peak_day', label: 'Peak Day', timing: '~CD 14', color: 'bg-rose-50 border-rose-100', dot: 'bg-rose-500 animate-pulse' },
  { tier: 'window_closed', label: 'After Ovulation', timing: '~CD 15+', color: 'bg-warm-50 border-warm-200', dot: 'bg-warm-400' },
];

function SignalThemePicker({
  selectedThemeId,
  onSelect,
}: {
  selectedThemeId: string;
  onSelect: (id: string) => void;
}) {
  const selectedTheme = SIGNAL_THEMES.find((t) => t.id === selectedThemeId) || SIGNAL_THEMES[4];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {SIGNAL_THEMES.map((theme) => {
          const isSelected = theme.id === selectedThemeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelect(theme.id)}
              className={`relative text-left rounded-xl overflow-hidden transition-all duration-200 ${
                isSelected
                  ? 'ring-2 ring-violet-500 ring-offset-2 shadow-md'
                  : 'border border-warm-100 hover:border-warm-200 hover:shadow-sm'
              }`}
            >
              <div className={`h-1.5 bg-gradient-to-r ${theme.gradient}`} />
              <div className="p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-lg">{theme.emoji}</span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                      <Check size={12} className="text-white" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold text-warm-800">{theme.name}</p>
                <p className="text-[11px] text-warm-400 mt-0.5 leading-snug">{theme.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Full Escalation Preview */}
      <div className="rounded-2xl overflow-hidden border border-warm-100">
        <div className={`bg-gradient-to-r ${selectedTheme.gradient} px-5 py-3.5`}>
          <div className="flex items-center gap-2">
            <Send size={14} className="text-white/80" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-white">What He'll See — Full Cycle Preview</span>
          </div>
          <p className="text-[11px] text-white/60 mt-0.5">
            {selectedTheme.emoji} {selectedTheme.name} theme — notifications escalate automatically
          </p>
        </div>
        <div className="bg-white divide-y divide-warm-100">
          {TIER_META.map(({ tier, label, timing, color, dot }) => {
            const msg = selectedTheme.messages[tier];
            const isSilent = !msg.title;
            return (
              <div key={tier} className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-bold text-warm-700 uppercase tracking-wider">{label}</span>
                    <span className="text-[10px] text-warm-300 font-mono">{timing}</span>
                  </div>
                </div>
                <div className={`rounded-xl p-3.5 border ${color}`}>
                  {isSilent ? (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{msg.emoji}</span>
                      <span className="text-xs text-warm-400 italic">Color signal only — no text notification</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">{msg.emoji}</span>
                        <p className="text-sm font-semibold text-warm-800">{msg.title}</p>
                      </div>
                      <p className="text-xs text-warm-500 leading-relaxed">{msg.body}</p>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Action Card Preview */}
          {selectedTheme.actionCards.ovulatory?.title && (
            <div className="p-4 bg-warm-50/50">
              <p className="text-[10px] font-bold text-warm-400 uppercase tracking-wider mb-2">
                + Themed Action Card (during fertile window)
              </p>
              <div className={`rounded-xl p-3.5 border border-warm-100 bg-white`}>
                <p className="text-sm font-semibold text-warm-800">{selectedTheme.actionCards.ovulatory.title}</p>
                <p className="text-xs text-warm-500 leading-relaxed mt-1">{selectedTheme.actionCards.ovulatory.body}</p>
              </div>
            </div>
          )}

          {/* Quick Replies Preview */}
          <div className="p-4">
            <p className="text-[10px] font-bold text-warm-400 uppercase tracking-wider mb-2.5">
              His Quick Replies
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedTheme.quickReplies.map((reply) => (
                <span
                  key={reply.value}
                  className="px-3 py-1.5 bg-warm-50 border border-warm-100 rounded-full text-[11px] text-warm-500 font-medium"
                >
                  {reply.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PartnerPairing() {
  const [paired, setPaired] = useState(false);
  const [connectedDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<'generate' | 'enter'>('generate');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeTimer, setCodeTimer] = useState(CODE_EXPIRY_SECONDS);
  const [copied, setCopied] = useState(false);
  const [enteredCode, setEnteredCode] = useState(['', '', '', '', '', '']);
  const [connecting, setConnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [sharingToggles, setSharingToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SHARING_OPTIONS.map((o) => [o.id, o.defaultOn]))
  );
  const [selectedThemeId, setSelectedThemeId] = useState(() => getSelectedTheme());
  const [savedPairCode, setSavedPairCode] = useState<string | null>(() => getPairCode());
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus | null>(null);
  const [connectNotice, setConnectNotice] = useState<{ tone: 'info' | 'warn'; message: string } | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCodeTimer(CODE_EXPIRY_SECONDS);
    timerRef.current = setInterval(() => {
      setCodeTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGeneratedCode(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleGenerate = () => {
    const code = generateCode();
    setGeneratedCode(code);
    savePairCode(code);
    setSavedPairCode(code.toUpperCase());
    setConnectNotice(null);
    startTimer();
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCodeInput = (index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    const next = [...enteredCode];
    next[index] = char;
    setEnteredCode(next);
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !enteredCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const next = [...enteredCode];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setEnteredCode(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleConnect = async () => {
    if (enteredCode.some((c) => !c)) return;
    const code = enteredCode.join('').toUpperCase();
    setConnectNotice(null);
    setConnecting(true);

    savePairCode(code);
    setSavedPairCode(code);

    if (!isSyncEnabled()) {
      setConnecting(false);
      setConnectNotice({
        tone: 'warn',
        message:
          "Cloud sync isn't configured on this deployment — your pair code is saved locally but will only sync when Supabase env vars are set.",
      });
      return;
    }

    try {
      const status = await pullStatus();
      setConnecting(false);
      if (status) {
        setPartnerStatus(status);
        setPaired(true);
      } else {
        setConnectNotice({
          tone: 'info',
          message: 'Pair code saved. Waiting for your partner to start tracking…',
        });
      }
    } catch {
      setConnecting(false);
      setConnectNotice({
        tone: 'warn',
        message: 'Could not reach sync right now — your pair code is saved and we will retry automatically.',
      });
    }
  };

  const handleClearPairCode = () => {
    localStorage.removeItem('iyla_pair_code');
    setSavedPairCode(null);
    setPartnerStatus(null);
    setConnectNotice(null);
  };

  const handleDisconnect = () => {
    setPaired(false);
    setShowDisconnectConfirm(false);
    setGeneratedCode(null);
    setEnteredCode(['', '', '', '', '', '']);
    if (timerRef.current) clearInterval(timerRef.current);
    setSharingToggles(Object.fromEntries(SHARING_OPTIONS.map((o) => [o.id, o.defaultOn])));
    localStorage.removeItem('iyla_pair_code');
    setSavedPairCode(null);
    setPartnerStatus(null);
    setConnectNotice(null);
  };

  const toggleSharing = (id: string) => {
    setSharingToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleThemeSelect = (themeId: string) => {
    setSelectedThemeId(themeId);
    setSelectedTheme(themeId);
  };

  if (connecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Link size={32} className="text-white" strokeWidth={1.5} />
          </div>
        </div>
        <p className="text-xl font-semibold text-warm-800">Connected! 💜</p>
        <p className="text-sm text-warm-400">Setting up your shared space…</p>
      </div>
    );
  }

  if (paired) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-warm-800 tracking-tight">Partner Pairing</h1>
          <p className="text-sm text-warm-400 mt-1">Manage your shared connection</p>
        </div>

        {savedPairCode && (
          <div className="bg-white rounded-2xl border border-warm-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Key size={14} strokeWidth={1.5} className="text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-warm-400 font-semibold">Saved pair code</p>
              <p className="text-sm font-mono font-semibold text-warm-800">{savedPairCode}</p>
            </div>
            <button
              onClick={handleClearPairCode}
              className="text-xs font-medium text-warm-400 hover:text-rose-500 transition-colors px-2 py-1"
            >
              Clear
            </button>
          </div>
        )}

        {/* Connected Status Card */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <Link size={24} className="text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-warm-800">Connected with Your Partner</h2>
              <p className="text-sm text-warm-400 mt-0.5">
                {partnerStatus?.cycle_day
                  ? <>Connected to your partner — they're on Cycle Day {partnerStatus.cycle_day}</>
                  : <>Since {connectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</>}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-700">Synced</span>
            </div>
          </div>
        </div>

        {/* Signal Theme */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-1">
            <Send size={20} strokeWidth={1.5} className="text-violet-500" />
            <h2 className="text-lg font-semibold text-warm-800">Signal Theme</h2>
          </div>
          <p className="text-sm text-warm-400 mb-5">Choose how your partner receives fertility notifications</p>
          <SignalThemePicker selectedThemeId={selectedThemeId} onSelect={handleThemeSelect} />
        </div>

        {/* Sharing Settings */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <Eye size={20} strokeWidth={1.5} className="text-warm-600" />
            <h2 className="text-lg font-semibold text-warm-800">Sharing Settings</h2>
          </div>
          <p className="text-sm text-warm-400 mb-5">Control exactly what your partner can see. Changes apply instantly.</p>
          <div className="space-y-1">
            {SHARING_OPTIONS.map((option) => (
              <div
                key={option.id}
                className="flex items-center gap-4 p-4 rounded-2xl hover:bg-warm-50/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-warm-50 flex items-center justify-center flex-shrink-0">
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-warm-800">{option.label}</p>
                  <p className="text-xs text-warm-400 mt-0.5">{option.description}</p>
                </div>
                <Toggle on={sharingToggles[option.id]} onToggle={() => toggleSharing(option.id)} />
              </div>
            ))}
          </div>
        </div>

        {/* What Your Partner Sees */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <EyeOff size={20} strokeWidth={1.5} className="text-warm-600" />
            <h2 className="text-lg font-semibold text-warm-800">What Your Partner Sees</h2>
          </div>
          <div className="bg-warm-50 rounded-2xl p-5 border border-warm-100">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-warm-700">Partner Dashboard</p>
                  <p className="text-[11px] text-warm-400">Simplified view</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {sharingToggles['cycle'] && (
                  <div className="bg-white rounded-xl p-3 border border-warm-100">
                    <p className="text-[10px] uppercase tracking-wider text-warm-300 font-medium">Cycle</p>
                    <p className="text-sm font-semibold text-warm-700 mt-1">Day 14 — Fertile</p>
                  </div>
                )}
                {sharingToggles['ovulation'] && (
                  <div className="bg-white rounded-xl p-3 border border-warm-100">
                    <p className="text-[10px] uppercase tracking-wider text-warm-300 font-medium">Signal</p>
                    <p className="text-sm font-semibold text-indigo-600 mt-1">Window Open</p>
                  </div>
                )}
                {sharingToggles['mood'] && (
                  <div className="bg-white rounded-xl p-3 border border-warm-100">
                    <p className="text-[10px] uppercase tracking-wider text-warm-300 font-medium">Mood</p>
                    <p className="text-sm font-semibold text-warm-700 mt-1">Feeling Good</p>
                  </div>
                )}
                {sharingToggles['breathwork'] && (
                  <div className="bg-white rounded-xl p-3 border border-warm-100">
                    <p className="text-[10px] uppercase tracking-wider text-warm-300 font-medium">Breathwork</p>
                    <p className="text-sm font-semibold text-cyan-600 mt-1">5-day streak</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-warm-500 font-medium">Your partner sees summaries, not raw data.</p>
            <p className="text-xs text-warm-400">
              They'll never see your notes, symptom details, or anything you don't explicitly share.
            </p>
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <Shield size={20} strokeWidth={1.5} className="text-warm-600" />
            <h2 className="text-lg font-semibold text-warm-800">Security & Privacy</h2>
          </div>
          <div className="space-y-3">
            {[
              'Your raw data never leaves your device',
              'No cloud servers — everything stays local',
              'Only approved summaries are shared',
              'You can disconnect at any time — their access is immediately revoked',
            ].map((text) => (
              <div key={text} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={12} className="text-emerald-500" strokeWidth={2.5} />
                </div>
                <p className="text-sm text-warm-500">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disconnect */}
        <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
          {!showDisconnectConfirm ? (
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-rose-50 text-rose-500 border border-rose-200 rounded-2xl font-medium text-sm hover:bg-rose-100 transition-colors"
            >
              <Unlink size={16} strokeWidth={1.5} />
              Disconnect Partner
            </button>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm font-medium text-warm-800">Are you sure you want to disconnect?</p>
              <p className="text-xs text-warm-400">
                Your partner will immediately lose access to all shared data. You can reconnect later with a new code.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="flex-1 px-4 py-3 bg-warm-50 text-warm-600 rounded-2xl text-sm font-medium hover:bg-warm-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex-1 px-4 py-3 bg-rose-500 text-white rounded-2xl text-sm font-medium hover:bg-rose-600 transition-colors"
                >
                  Yes, Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-warm-800 tracking-tight">Partner Pairing</h1>
        <p className="text-sm text-warm-400 mt-1">Share your journey together</p>
      </div>

      {savedPairCode && (
        <div className="bg-white rounded-2xl border border-warm-100 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Key size={14} strokeWidth={1.5} className="text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-warm-400 font-semibold">Saved pair code</p>
            <p className="text-sm font-mono font-semibold text-warm-800">{savedPairCode}</p>
          </div>
          <button
            onClick={handleClearPairCode}
            className="text-xs font-medium text-warm-400 hover:text-rose-500 transition-colors px-2 py-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-500 to-indigo-500 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-6 right-6 opacity-20">
          <svg width="80" height="48" viewBox="0 0 80 48" fill="none">
            <circle cx="28" cy="24" r="22" stroke="white" strokeWidth="3" fill="none" />
            <circle cx="52" cy="24" r="22" stroke="white" strokeWidth="3" fill="none" />
          </svg>
        </div>
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-5">
            <Link size={22} className="text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connect With Your Partner</h2>
          <p className="text-white/80 text-sm max-w-md leading-relaxed">
            iyla is designed for two. Share your journey — on your terms.
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-warm-800 mb-5">How It Works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              step: 1,
              icon: <Key size={20} strokeWidth={1.5} className="text-violet-500" />,
              title: 'Generate a Code',
              desc: 'One of you generates a pairing code',
            },
            {
              step: 2,
              icon: <Smartphone size={20} strokeWidth={1.5} className="text-indigo-500" />,
              title: 'Enter the Code',
              desc: 'The other enters the code on their device',
            },
            {
              step: 3,
              icon: <Shield size={20} strokeWidth={1.5} className="text-teal-500" />,
              title: 'Choose What to Share',
              desc: "You're always in control of your data",
            },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="flex flex-col items-center text-center p-4 rounded-2xl bg-warm-50/50">
              <div className="w-10 h-10 rounded-xl bg-white border border-warm-100 flex items-center justify-center mb-3 shadow-sm">
                {icon}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-warm-300 font-semibold mb-1">
                Step {step}
              </span>
              <p className="text-sm font-semibold text-warm-800 mb-1">{title}</p>
              <p className="text-xs text-warm-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Customize The Signal */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-1">
          <Send size={20} strokeWidth={1.5} className="text-violet-500" />
          <h2 className="text-lg font-semibold text-warm-800">Customize The Signal</h2>
        </div>
        <p className="text-sm text-warm-400 mb-5">Choose a notification style for your partner before you connect</p>
        <SignalThemePicker selectedThemeId={selectedThemeId} onSelect={handleThemeSelect} />
        <p className="text-xs text-warm-400 text-center mt-4">You can change this anytime after pairing</p>
      </div>

      {/* Generate / Enter Code */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-warm-50 rounded-2xl mb-6">
          {(['generate', 'enter'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-white text-warm-800 shadow-sm'
                  : 'text-warm-400 hover:text-warm-600'
              }`}
            >
              {tab === 'generate' ? 'Generate Code' : 'Enter Code'}
            </button>
          ))}
        </div>

        {activeTab === 'generate' && (
          <div className="text-center">
            {!generatedCode ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                  <Key size={28} strokeWidth={1.5} className="text-violet-500" />
                </div>
                <p className="text-sm text-warm-400 mb-5">
                  Generate a one-time code for your partner to enter on their device.
                </p>
                <button
                  onClick={handleGenerate}
                  className="px-8 py-3.5 bg-warm-800 text-white rounded-2xl font-medium text-sm hover:bg-warm-900 transition-colors"
                >
                  Generate Pairing Code
                </button>
              </>
            ) : (
              <>
                <div className="bg-gradient-to-br from-violet-500 to-indigo-500 rounded-2xl p-8 mb-4">
                  <div className="flex items-center justify-center gap-3">
                    {generatedCode.split('').map((char, i) => (
                      <span
                        key={i}
                        className="w-12 h-14 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-xl text-2xl font-mono font-bold text-white"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const inviteUrl = `${window.location.origin}/?invite=${generatedCode}`;
                    const message = `Hey! I'm using iyla to track our fertility journey. Tap this link to connect with me:\n\n${inviteUrl}`;
                    if (navigator.share) {
                      navigator.share({ title: 'iyla — Connect with your partner', text: message, url: inviteUrl }).catch(() => {});
                    } else {
                      window.open(`sms:?&body=${encodeURIComponent(message)}`, '_self');
                    }
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-2xl text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200/50 transition-all flex items-center justify-center gap-2 mb-4 active:scale-[0.98]"
                >
                  <MessageCircle size={16} strokeWidth={1.5} />
                  Text Invite to Partner
                </button>

                <div className="flex items-center justify-center gap-4 mb-4">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-warm-50 rounded-xl text-sm text-warm-600 hover:bg-warm-100 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check size={14} strokeWidth={2} className="text-emerald-500" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} strokeWidth={1.5} />
                        Copy Code
                      </>
                    )}
                  </button>
                  <span className="text-sm text-warm-400">
                    Expires in{' '}
                    <span className={`font-mono font-medium ${codeTimer < 60 ? 'text-rose-500' : 'text-warm-600'}`}>
                      {formatTime(codeTimer)}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-warm-400">
                  Or share the code manually — he'll enter it on his device.
                </p>
              </>
            )}
          </div>
        )}

        {activeTab === 'enter' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Smartphone size={28} strokeWidth={1.5} className="text-indigo-500" />
            </div>
            <p className="text-sm text-warm-400 mb-5">Enter the 6-character code from your partner's device.</p>
            <div className="flex items-center justify-center gap-2 mb-6" onPaste={handleCodePaste}>
              {enteredCode.map((char, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleCodeInput(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-mono font-bold text-warm-800 bg-warm-50 border-2 border-warm-200 rounded-xl focus:border-violet-500 focus:bg-white focus:outline-none transition-all"
                />
              ))}
            </div>
            <button
              onClick={handleConnect}
              disabled={enteredCode.some((c) => !c)}
              className="px-8 py-3.5 bg-warm-800 text-white rounded-2xl font-medium text-sm hover:bg-warm-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Connect
            </button>
            {connectNotice && (
              <div
                className={`mt-5 text-left rounded-2xl px-4 py-3 text-xs leading-relaxed border ${
                  connectNotice.tone === 'warn'
                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                    : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                }`}
              >
                {connectNotice.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* What Your Partner Sees */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <EyeOff size={20} strokeWidth={1.5} className="text-warm-600" />
          <h2 className="text-lg font-semibold text-warm-800">What Your Partner Sees</h2>
        </div>
        <div className="bg-warm-50 rounded-2xl p-5 border border-warm-100 mb-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-400" />
              <div>
                <p className="text-sm font-medium text-warm-700">Partner Dashboard</p>
                <p className="text-[11px] text-warm-400">Simplified view — preview</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-xl p-3 border border-warm-100">
                <p className="text-[10px] uppercase tracking-wider text-warm-300 font-medium">Cycle</p>
                <p className="text-sm font-semibold text-warm-700 mt-1">Day 14 — Fertile</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-warm-100">
                <p className="text-[10px] uppercase tracking-wider text-warm-300 font-medium">Signal</p>
                <p className="text-sm font-semibold text-indigo-600 mt-1">Window Open</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-sm text-warm-500 font-medium">Your partner sees summaries, not raw data.</p>
        <p className="text-xs text-warm-400 mt-1">
          They'll never see your notes, symptom details, or anything you don't explicitly share.
        </p>
      </div>

      {/* Security Info */}
      <div className="bg-white rounded-3xl border border-warm-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <Shield size={20} strokeWidth={1.5} className="text-warm-600" />
          <h2 className="text-lg font-semibold text-warm-800">Security & Privacy</h2>
        </div>
        <div className="space-y-3">
          {[
            'Your raw data never leaves your device',
            'No cloud servers — everything stays local',
            'Only approved summaries are shared',
            'You can disconnect at any time — their access is immediately revoked',
          ].map((text) => (
            <div key={text} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={12} className="text-emerald-500" strokeWidth={2.5} />
              </div>
              <p className="text-sm text-warm-500">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
