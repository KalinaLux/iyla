import { useState, useRef } from 'react';
import {
  Sparkles,
  Heart,
  User,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Key,
  Smartphone,
  Send,
  Shield,
  MessageCircle,
} from 'lucide-react';
import { db } from '../lib/db';
import { format } from 'date-fns';
import {
  SIGNAL_THEMES,
  getSelectedTheme,
  setSelectedTheme,
} from '../lib/signal-themes';
import { seedKalinaProfile, seedDominickProfile } from '../lib/seed-data';

type Role = null | 'her' | 'partner';
type HerStep = 'welcome' | 'cycle' | 'theme' | 'code' | 'done';
type HisStep = 'welcome' | 'code' | 'theme' | 'done';

const ROLE_STORAGE_KEY = 'iyla-user-role';
const ONBOARDED_KEY = 'iyla-onboarded';

export function getUserRole(): string | null {
  try {
    return localStorage.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === 'true';
  } catch {
    return false;
  }
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? 'w-6 bg-teal-500' : i < current ? 'w-1.5 bg-teal-300' : 'w-1.5 bg-warm-200'
          }`}
        />
      ))}
    </div>
  );
}

function ThemeMiniPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = SIGNAL_THEMES.find((t) => t.id === selectedId) || SIGNAL_THEMES[4];
  const peakMsg = selected.messages.peak_day;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        {SIGNAL_THEMES.filter((t) => t.id !== 'silent').map((theme) => {
          const isSelected = theme.id === selectedId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelect(theme.id)}
              className={`text-left rounded-xl overflow-hidden transition-all duration-200 ${
                isSelected
                  ? 'ring-2 ring-teal-500 ring-offset-2 shadow-md'
                  : 'border border-warm-100 hover:border-warm-200'
              }`}
            >
              <div className={`h-1.5 bg-gradient-to-r ${theme.gradient}`} />
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{theme.emoji}</span>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center">
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-warm-800">{theme.name}</p>
                <p className="text-[10px] text-warm-400 leading-snug">{theme.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {peakMsg.title && (
        <div className={`rounded-xl overflow-hidden border border-warm-100`}>
          <div className={`bg-gradient-to-r ${selected.gradient} px-4 py-2.5`}>
            <p className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">
              Peak Day Preview — What he'll see
            </p>
          </div>
          <div className="p-4 bg-white">
            <div className="flex items-center gap-2 mb-1.5">
              <span>{peakMsg.emoji}</span>
              <p className="text-sm font-semibold text-warm-800">{peakMsg.title}</p>
            </div>
            <p className="text-xs text-warm-500 leading-relaxed">{peakMsg.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function getInviteFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('invite');
  } catch {
    return null;
  }
}

export default function StartCyclePrompt() {
  const inviteCode = getInviteFromUrl();
  const [role, setRole] = useState<Role>(() => (inviteCode ? 'partner' : null));
  const [herStep, setHerStep] = useState<HerStep>('welcome');
  const [hisStep, setHisStep] = useState<HisStep>(() => (inviteCode ? 'code' : 'welcome'));
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [themeId, setThemeId] = useState(() => getSelectedTheme());
  const [generatedCode] = useState(() => generateCode());
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enteredCode, setEnteredCode] = useState(() => {
    if (inviteCode && inviteCode.length === 6) {
      return inviteCode.toUpperCase().split('').slice(0, 6);
    }
    return ['', '', '', '', '', ''];
  });
  const [codeValid, setCodeValid] = useState(() => !!inviteCode && inviteCode.length === 6);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const inviteUrl = `${window.location.origin}/?invite=${generatedCode}`;

  const handleShareInvite = async () => {
    const message = `Hey! I'm using iyla to track our fertility journey. Tap this link to connect with me:\n\n${inviteUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'iyla — Connect with your partner',
          text: message,
          url: inviteUrl,
        });
        setInvited(true);
        return;
      } catch {
        // user cancelled or share failed, fall through to SMS
      }
    }

    // Fallback: open SMS with pre-filled message
    const smsBody = encodeURIComponent(message);
    window.open(`sms:?&body=${smsBody}`, '_self');
    setInvited(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
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
    if (next.every((c) => c)) {
      setCodeValid(true);
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
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setEnteredCode(next);
    if (next.every((c) => c)) setCodeValid(true);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  async function finishHer() {
    await db.cycles.add({ startDate, outcome: 'ongoing' });
    setSelectedTheme(themeId);
    localStorage.setItem(ROLE_STORAGE_KEY, 'her');
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setHerStep('done');
  }

  function finishHim() {
    setSelectedTheme(themeId);
    localStorage.setItem(ROLE_STORAGE_KEY, 'partner');
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setHisStep('done');
    // Strip invite param from URL before navigating
    window.location.href = '/partner';
  }

  // ─── ROLE SELECTION ───
  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-200/50">
            <Sparkles size={32} className="text-white" strokeWidth={1.5} />
          </div>
          <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 animate-ping opacity-20" />
        </div>

        <h1 className="text-3xl font-bold text-warm-800 mb-2 tracking-tight">Welcome to <span className="text-4xl">i</span>yla</h1>
        <p className="text-warm-400 text-sm mb-1">by Solairen Health</p>
        <p className="text-warm-500 max-w-xs mb-10 leading-relaxed text-sm">
          All your fertility data. One clear picture. Built for two.
        </p>

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => setRole('her')}
            className="w-full bg-white rounded-2xl border border-warm-100 p-5 flex items-center gap-4 hover:shadow-md hover:border-warm-200 transition-all duration-200 active:scale-[0.98] group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-sm shadow-rose-200/50 group-hover:shadow-md group-hover:shadow-rose-200/50 transition-shadow">
              <Heart size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-warm-800">I'm tracking my fertility</p>
              <p className="text-xs text-warm-400 mt-0.5">Set up your cycle, devices, and invite your partner</p>
            </div>
            <ArrowRight size={16} className="text-warm-300 group-hover:text-warm-500 transition-colors" />
          </button>

          <button
            onClick={() => setRole('partner')}
            className="w-full bg-white rounded-2xl border border-warm-100 p-5 flex items-center gap-4 hover:shadow-md hover:border-warm-200 transition-all duration-200 active:scale-[0.98] group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200/50 group-hover:shadow-md group-hover:shadow-indigo-200/50 transition-shadow">
              <User size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-warm-800">I'm here for my partner</p>
              <p className="text-xs text-warm-400 mt-0.5">Enter your pairing code and get set up</p>
            </div>
            <ArrowRight size={16} className="text-warm-300 group-hover:text-warm-500 transition-colors" />
          </button>
        </div>

        {/* Quick-load profiles */}
        <div className="w-full max-w-sm mt-8 pt-6 border-t border-warm-100">
          <p className="text-[11px] text-warm-300 uppercase tracking-wider font-semibold mb-3 text-center">Quick Load — Returning User</p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setLoading(true);
                await seedKalinaProfile();
                window.location.href = '/';
              }}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 text-rose-700 rounded-xl py-3 text-xs font-semibold hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Loading...' : "Kalina's Profile"}
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                await seedKalinaProfile();
                await seedDominickProfile();
                window.location.href = '/partner';
              }}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl py-3 text-xs font-semibold hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Loading...' : "Dominick's Profile"}
            </button>
          </div>
          <p className="text-[10px] text-warm-300 mt-2 text-center">Loads all cycle data, labs, and supplements</p>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Shield size={12} className="text-warm-300" />
          <p className="text-[11px] text-warm-300">Your data never leaves your device. Zero tracking. Zero accounts.</p>
        </div>
      </div>
    );
  }

  // ─── HER FLOW ───
  if (role === 'her') {
    const herSteps: HerStep[] = ['welcome', 'cycle', 'theme', 'code'];
    const stepIdx = herSteps.indexOf(herStep);

    if (herStep === 'done') {
      return null;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-4">
        <div className="mb-6">
          <StepDots current={stepIdx} total={herSteps.length} />
        </div>

        {herStep === 'welcome' && (
          <div className="w-full max-w-sm animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-200/40">
              <Heart size={28} className="text-white" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-warm-800 mb-3">Let's get you set up</h2>
            <p className="text-sm text-warm-500 leading-relaxed mb-2">
              iyla brings together all your fertility signals — Kegg, Inito, TempDrop, BBT, labs, supplements — into one clear picture.
            </p>
            <p className="text-xs text-warm-400 leading-relaxed mb-8">
              Everything stays on your device. No cloud. No accounts. Yours.
            </p>
            <button
              onClick={() => setHerStep('cycle')}
              className="w-full bg-gradient-to-r from-rose-400 to-pink-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:shadow-lg hover:shadow-rose-200/50 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Let's Go <ArrowRight size={16} />
            </button>
          </div>
        )}

        {herStep === 'cycle' && (
          <div className="w-full max-w-sm animate-in fade-in">
            <h2 className="text-2xl font-bold text-warm-800 mb-2">When did your last period start?</h2>
            <p className="text-sm text-warm-400 mb-8">This helps iyla estimate where you are in your cycle.</p>

            <div className="bg-white rounded-3xl border border-warm-100 p-6 shadow-sm mb-6">
              <label className="block text-sm font-medium text-warm-600 text-left mb-2">
                First Day of Last Period
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-warm-200 rounded-2xl px-4 py-3 text-sm text-warm-700 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent bg-warm-50/50"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setHerStep('welcome')}
                className="px-5 py-3 bg-warm-50 text-warm-500 rounded-2xl text-sm font-medium hover:bg-warm-100 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => setHerStep('theme')}
                className="flex-1 bg-gradient-to-r from-rose-400 to-pink-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {herStep === 'theme' && (
          <div className="w-full max-w-sm animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Send size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-warm-800 mb-2">Choose his notification style</h2>
            <p className="text-sm text-warm-400 mb-6 leading-relaxed">
              When your fertile window opens, he'll get themed alerts. Pick the vibe that fits him best.
            </p>

            <div className="text-left mb-6">
              <ThemeMiniPicker selectedId={themeId} onSelect={setThemeId} />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setHerStep('cycle')}
                className="px-5 py-3 bg-warm-50 text-warm-500 rounded-2xl text-sm font-medium hover:bg-warm-100 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => setHerStep('code')}
                className="flex-1 bg-gradient-to-r from-rose-400 to-pink-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {herStep === 'code' && (
          <div className="w-full max-w-sm animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Key size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-warm-800 mb-2">Invite your partner</h2>
            <p className="text-sm text-warm-400 mb-6 leading-relaxed">
              Send him a link — he'll tap it and land right in his setup. No code to type.
            </p>

            {/* Primary: Send Invite */}
            <button
              onClick={handleShareInvite}
              className={`w-full py-4 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2.5 mb-4 ${
                invited
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-200/50 active:scale-[0.98]'
              }`}
            >
              {invited ? (
                <>
                  <Check size={18} strokeWidth={2} />
                  Invite Sent!
                </>
              ) : (
                <>
                  <MessageCircle size={18} strokeWidth={1.5} />
                  Text Invite to Partner
                </>
              )}
            </button>

            {/* Code display (secondary) */}
            <div className="bg-warm-50 rounded-2xl p-4 mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-warm-300 text-center mb-3">
                Or share this code manually
              </p>
              <div className="flex items-center justify-center gap-2">
                {generatedCode.split('').map((char, i) => (
                  <span
                    key={i}
                    className="w-9 h-11 flex items-center justify-center bg-white border border-warm-200 rounded-lg text-lg font-mono font-bold text-warm-700"
                  >
                    {char}
                  </span>
                ))}
                <button
                  onClick={handleCopy}
                  className="ml-2 p-2 bg-white border border-warm-200 rounded-lg hover:bg-warm-100 transition-colors"
                >
                  {copied ? (
                    <Check size={14} className="text-emerald-500" strokeWidth={2} />
                  ) : (
                    <Copy size={14} className="text-warm-400" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setHerStep('theme')}
                className="px-5 py-3 bg-warm-50 text-warm-500 rounded-2xl text-sm font-medium hover:bg-warm-100 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={finishHer}
                className="flex-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:shadow-lg hover:shadow-teal-200/50 transition-all flex items-center justify-center gap-2"
              >
                Start Tracking <Sparkles size={16} />
              </button>
            </div>

            <button
              onClick={finishHer}
              className="mt-3 text-xs text-warm-400 hover:text-warm-600 transition-colors"
            >
              Skip — I'll pair later
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── HIS FLOW ───
  if (role === 'partner') {
    const hisSteps: HisStep[] = ['welcome', 'code', 'theme'];
    const stepIdx = hisSteps.indexOf(hisStep);

    if (hisStep === 'done') {
      return null;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-4">
        <div className="mb-6">
          <StepDots current={stepIdx} total={hisSteps.length} />
        </div>

        {hisStep === 'welcome' && (
          <div className="w-full max-w-sm animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200/40">
              <User size={28} className="text-white" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-warm-800 mb-3">Welcome, Partner</h2>
            <p className="text-sm text-warm-500 leading-relaxed mb-2">
              Your partner is using iyla to track her fertility. She invited you so you can be part of the journey.
            </p>
            <p className="text-xs text-warm-400 leading-relaxed mb-8">
              You'll get clear, simple notifications about when timing matters — no medical jargon, no guesswork.
            </p>
            <button
              onClick={() => setHisStep('code')}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3.5 rounded-2xl text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200/50 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Enter Pairing Code <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Auto-filled from invite link — skip to code step with confirmation */}

        {hisStep === 'code' && (
          <div className="w-full max-w-sm animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Smartphone size={20} className="text-white" strokeWidth={1.5} />
            </div>

            {inviteCode ? (
              <>
                <h2 className="text-xl font-bold text-warm-800 mb-2">You're connected!</h2>
                <p className="text-sm text-warm-400 mb-6 leading-relaxed">
                  Your partner sent you an invite. You're all linked up — just pick a notification style and you're in.
                </p>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
                  <div className="flex items-center justify-center gap-2.5 mb-3">
                    {inviteCode.toUpperCase().split('').slice(0, 6).map((char, i) => (
                      <span
                        key={i}
                        className="w-10 h-12 flex items-center justify-center bg-white border border-emerald-200 rounded-lg text-lg font-mono font-bold text-emerald-700"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center">
                      <Check size={12} className="text-emerald-700" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-medium text-emerald-700">Paired via invite link</span>
                  </div>
                </div>

                <button
                  onClick={() => setHisStep('theme')}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3.5 rounded-2xl text-sm font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  Choose Notification Style <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-warm-800 mb-2">Enter your pairing code</h2>
                <p className="text-sm text-warm-400 mb-6">Ask your partner for the 6-character code from her phone.</p>

                <div
                  className="flex items-center justify-center gap-2 mb-6"
                  onPaste={handleCodePaste}
                >
                  {enteredCode.map((char, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      maxLength={1}
                      value={char}
                      onChange={(e) => handleCodeInput(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className="w-12 h-14 text-center text-xl font-mono font-bold text-warm-800 bg-warm-50 border-2 border-warm-200 rounded-xl focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                    />
                  ))}
                </div>

                {codeValid && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Check size={12} className="text-emerald-600" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-medium text-emerald-600">Code accepted</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setHisStep('welcome')}
                    className="px-5 py-3 bg-warm-50 text-warm-500 rounded-2xl text-sm font-medium hover:bg-warm-100 transition-colors"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    onClick={() => setHisStep('theme')}
                    disabled={!codeValid}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3.5 rounded-2xl text-sm font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {hisStep === 'theme' && (
          <div className="w-full max-w-sm animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Send size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-warm-800 mb-2">Pick your notification style</h2>
            <p className="text-sm text-warm-400 mb-6 leading-relaxed">
              Your partner may have already chosen one. You can keep it or change it — this is how you'll receive fertility timing alerts.
            </p>

            <div className="text-left mb-6">
              <ThemeMiniPicker selectedId={themeId} onSelect={setThemeId} />
            </div>

            <button
              onClick={finishHim}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3.5 rounded-2xl text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200/50 transition-all flex items-center justify-center gap-2"
            >
              Let's Go <Sparkles size={16} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
