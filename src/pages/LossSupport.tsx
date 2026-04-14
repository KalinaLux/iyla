import { useState, useMemo } from 'react';
import {
  Feather,
  Shield,
  Phone,
  Users,
  Calendar,
  ArrowRight,
  Plus,
  Check,
  AlertTriangle,
  ExternalLink,
  Clock,
  Thermometer,
  Droplets,
  TrendingDown,
} from 'lucide-react';
import { format, differenceInWeeks, differenceInDays } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

/* ─── Types ─── */

type LossType =
  | 'chemical'
  | 'early_miscarriage'
  | 'late_miscarriage'
  | 'ectopic'
  | 'molar'
  | 'stillbirth'
  | 'other';

type Intervention = 'natural' | 'dnc' | 'medication' | 'surgical' | 'other';

type BleedingLevel = 'none' | 'light' | 'moderate' | 'heavy';

type EmotionWord =
  | 'numb'
  | 'sad'
  | 'angry'
  | 'hopeful'
  | 'scared'
  | 'relieved'
  | 'confused'
  | 'exhausted'
  | 'okay';

interface LossEvent {
  date: string;
  type: LossType;
  gestationalWeeks: number;
  gestationalDays: number;
  intervention: Intervention;
  provider: string;
  notes: string;
}

interface DailyLog {
  date: string;
  bleeding: BleedingLevel;
  pain: number;
  temperature: string;
  emotions: EmotionWord[];
}

interface HCGReading {
  date: string;
  value: number;
}

const LOSS_TYPE_LABELS: Record<LossType, string> = {
  chemical: 'Chemical pregnancy',
  early_miscarriage: 'Early miscarriage (<12 weeks)',
  late_miscarriage: 'Late miscarriage (12–20 weeks)',
  ectopic: 'Ectopic pregnancy',
  molar: 'Molar pregnancy',
  stillbirth: 'Stillbirth',
  other: 'Other',
};

const INTERVENTION_LABELS: Record<Intervention, string> = {
  natural: 'Natural / expectant management',
  dnc: 'D&C (dilation & curettage)',
  medication: 'Medication (misoprostol)',
  surgical: 'Surgical',
  other: 'Other',
};

const EMOTION_WORDS: EmotionWord[] = [
  'numb',
  'sad',
  'angry',
  'hopeful',
  'scared',
  'relieved',
  'confused',
  'exhausted',
  'okay',
];

interface Milestone {
  weekThreshold: number;
  message: string;
}

const MILESTONES: Milestone[] = [
  {
    weekThreshold: 1,
    message:
      'Your body is working hard right now. Rest is not optional — it\u2019s medicine.',
  },
  {
    weekThreshold: 2,
    message:
      'Hormone shifts can feel overwhelming. What you\u2019re feeling is real and valid.',
  },
  {
    weekThreshold: 4,
    message:
      'One month. There\u2019s no \u201cshould\u201d for where you are right now.',
  },
  {
    weekThreshold: 6,
    message:
      'If your provider cleared you for TTC, remember: readiness is emotional too.',
  },
  {
    weekThreshold: 8,
    message: 'Whenever you\u2019re ready. We\u2019ll be here.',
  },
];

/* ─── Helpers ─── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-warm-800">{children}</h2>
  );
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-3xl border border-warm-100 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Component ─── */

export default function LossSupport() {
  const today = format(new Date(), 'yyyy-MM-dd');

  /* Loss event state */
  const [lossEvent, setLossEvent] = useState<LossEvent | null>(null);
  const [lossForm, setLossForm] = useState({
    date: today,
    type: 'chemical' as LossType,
    gestationalWeeks: 0,
    gestationalDays: 0,
    intervention: 'natural' as Intervention,
    provider: '',
    notes: '',
  });
  const [showLossForm, setShowLossForm] = useState(true);

  /* Daily recovery log state */
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [currentLog, setCurrentLog] = useState<DailyLog>({
    date: today,
    bleeding: 'none',
    pain: 0,
    temperature: '',
    emotions: [],
  });

  /* hCG tracking state */
  const [hcgReadings, setHcgReadings] = useState<HCGReading[]>([]);
  const [hcgInput, setHcgInput] = useState({ date: today, value: '' });

  /* First period state */
  const [periodReturned, setPeriodReturned] = useState(false);
  const [periodDate, setPeriodDate] = useState('');

  /* Derived values */
  const weeksSinceLoss = useMemo(() => {
    if (!lossEvent) return 0;
    return differenceInWeeks(new Date(), new Date(lossEvent.date + 'T00:00:00'));
  }, [lossEvent]);

  const daysSinceLoss = useMemo(() => {
    if (!lossEvent) return 0;
    return differenceInDays(new Date(), new Date(lossEvent.date + 'T00:00:00'));
  }, [lossEvent]);

  const applicableMilestones = useMemo(() => {
    return MILESTONES.filter((m) => weeksSinceLoss >= m.weekThreshold);
  }, [weeksSinceLoss]);

  const showReturnToTTC = lossEvent && daysSinceLoss > 28;

  /* Handlers */

  function saveLossEvent() {
    setLossEvent({ ...lossForm });
    setShowLossForm(false);
  }

  function toggleEmotion(emotion: EmotionWord) {
    setCurrentLog((prev) => ({
      ...prev,
      emotions: prev.emotions.includes(emotion)
        ? prev.emotions.filter((e) => e !== emotion)
        : [...prev.emotions, emotion],
    }));
  }

  function saveDailyLog() {
    setDailyLogs((prev) => [
      ...prev.filter((l) => l.date !== currentLog.date),
      { ...currentLog },
    ]);
    setCurrentLog({
      date: today,
      bleeding: 'none',
      pain: 0,
      temperature: '',
      emotions: [],
    });
  }

  function addHCGReading() {
    const val = parseFloat(hcgInput.value);
    if (isNaN(val)) return;
    setHcgReadings((prev) =>
      [...prev, { date: hcgInput.date, value: val }].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    );
    setHcgInput({ date: today, value: '' });
  }

  const hcgChartData = hcgReadings.map((r) => ({
    date: format(new Date(r.date + 'T00:00:00'), 'MMM d'),
    value: r.value,
  }));

  /* ─── Render ─── */

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-warm-800">
          Support & Recovery
        </h1>
        <p className="text-sm text-warm-400 mt-0.5">
          A safe, private space — at your pace.
        </p>
      </div>

      {/* ─── 1. Introduction Card ─── */}
      <div className="bg-gradient-to-br from-warm-200 to-warm-100 rounded-3xl p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-2xl bg-white/60 flex items-center justify-center">
            <Feather size={20} className="text-warm-600" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-warm-800 mb-2">
              This space is yours.
            </h2>
            <p className="text-sm text-warm-600 leading-relaxed">
              There is no timeline for grief, and no right way to feel. We're
              here to help you track your recovery — at your pace.
            </p>
          </div>
        </div>
      </div>

      {/* ─── 2. Loss Timeline Logger ─── */}
      <section className="space-y-3">
        <SectionHeading>Loss Timeline</SectionHeading>

        {lossEvent && !showLossForm ? (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Calendar
                  size={18}
                  className="text-warm-400"
                  strokeWidth={1.5}
                />
                <span className="text-sm font-medium text-warm-800">
                  {format(
                    new Date(lossEvent.date + 'T00:00:00'),
                    'MMMM d, yyyy'
                  )}
                </span>
              </div>
              <button
                onClick={() => setShowLossForm(true)}
                className="text-xs text-warm-400 hover:text-warm-600 transition-colors"
              >
                Edit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-warm-400 text-xs">Type</p>
                <p className="text-warm-700">
                  {LOSS_TYPE_LABELS[lossEvent.type]}
                </p>
              </div>
              <div>
                <p className="text-warm-400 text-xs">Gestational age</p>
                <p className="text-warm-700">
                  {lossEvent.gestationalWeeks}w {lossEvent.gestationalDays}d
                </p>
              </div>
              <div>
                <p className="text-warm-400 text-xs">Intervention</p>
                <p className="text-warm-700">
                  {INTERVENTION_LABELS[lossEvent.intervention]}
                </p>
              </div>
              {lossEvent.provider && (
                <div>
                  <p className="text-warm-400 text-xs">Provider</p>
                  <p className="text-warm-700">{lossEvent.provider}</p>
                </div>
              )}
            </div>
            {lossEvent.notes && (
              <p className="mt-3 text-sm text-warm-500 italic border-t border-warm-50 pt-3">
                {lossEvent.notes}
              </p>
            )}
            {daysSinceLoss > 0 && (
              <p className="mt-3 text-xs text-warm-400">
                {weeksSinceLoss > 0
                  ? `${weeksSinceLoss} week${weeksSinceLoss !== 1 ? 's' : ''} ago`
                  : `${daysSinceLoss} day${daysSinceLoss !== 1 ? 's' : ''} ago`}
              </p>
            )}
          </Card>
        ) : (
          <Card className="p-6 space-y-4">
            <p className="text-sm text-warm-500">
              Log a loss event when you're ready. This information stays
              private and is only used to support your recovery tracking.
            </p>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-warm-600 mb-1">
                Date of loss
              </label>
              <input
                type="date"
                value={lossForm.date}
                onChange={(e) =>
                  setLossForm((f) => ({ ...f, date: e.target.value }))
                }
                className="w-full px-4 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-warm-600 mb-1">
                Type
              </label>
              <select
                value={lossForm.type}
                onChange={(e) =>
                  setLossForm((f) => ({
                    ...f,
                    type: e.target.value as LossType,
                  }))
                }
                className="w-full px-4 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
              >
                {Object.entries(LOSS_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Gestational age */}
            <div>
              <label className="block text-xs font-medium text-warm-600 mb-1">
                Gestational age at loss
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={42}
                      value={lossForm.gestationalWeeks || ''}
                      onChange={(e) =>
                        setLossForm((f) => ({
                          ...f,
                          gestationalWeeks: parseInt(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-warm-400">
                      weeks
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={lossForm.gestationalDays || ''}
                      onChange={(e) =>
                        setLossForm((f) => ({
                          ...f,
                          gestationalDays: parseInt(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-warm-400">
                      days
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Intervention */}
            <div>
              <label className="block text-xs font-medium text-warm-600 mb-1">
                Medical intervention
              </label>
              <select
                value={lossForm.intervention}
                onChange={(e) =>
                  setLossForm((f) => ({
                    ...f,
                    intervention: e.target.value as Intervention,
                  }))
                }
                className="w-full px-4 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
              >
                {Object.entries(INTERVENTION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Provider */}
            <div>
              <label className="block text-xs font-medium text-warm-600 mb-1">
                Provider
              </label>
              <input
                type="text"
                value={lossForm.provider}
                onChange={(e) =>
                  setLossForm((f) => ({ ...f, provider: e.target.value }))
                }
                placeholder="Name or practice (optional)"
                className="w-full px-4 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300 placeholder:text-warm-300"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-warm-600 mb-1">
                Notes
              </label>
              <textarea
                value={lossForm.notes}
                onChange={(e) =>
                  setLossForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
                placeholder="Only if you want to — this is for you."
                className="w-full px-4 py-3 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300 placeholder:text-warm-300 resize-none"
              />
            </div>

            <button
              onClick={saveLossEvent}
              className="w-full py-3 rounded-2xl bg-warm-600 text-white text-sm font-medium hover:bg-warm-500 transition-colors"
            >
              Save
            </button>
          </Card>
        )}
      </section>

      {/* ─── 3. Recovery Tracker ─── */}
      {lossEvent && (
        <section className="space-y-3">
          <SectionHeading>Daily Recovery Check-In</SectionHeading>

          {/* Physical Symptoms */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Droplets
                size={16}
                className="text-warm-400"
                strokeWidth={1.5}
              />
              <h3 className="text-sm font-semibold text-warm-700">
                Physical Symptoms
              </h3>
            </div>

            {/* Bleeding */}
            <div>
              <label className="block text-xs font-medium text-warm-500 mb-2">
                Bleeding level
              </label>
              <div className="flex gap-2">
                {(['none', 'light', 'moderate', 'heavy'] as BleedingLevel[]).map(
                  (level) => (
                    <button
                      key={level}
                      onClick={() =>
                        setCurrentLog((prev) => ({ ...prev, bleeding: level }))
                      }
                      className={`flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                        currentLog.bleeding === level
                          ? 'bg-warm-400 text-white'
                          : 'bg-warm-50 text-warm-400 hover:bg-warm-100'
                      }`}
                    >
                      {level}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Pain */}
            <div>
              <label className="block text-xs font-medium text-warm-500 mb-2">
                Pain level
              </label>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() =>
                      setCurrentLog((prev) => ({ ...prev, pain: level }))
                    }
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      currentLog.pain === level
                        ? 'bg-warm-400 text-white'
                        : 'bg-warm-50 text-warm-400 hover:bg-warm-100'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-warm-300">None</span>
                <span className="text-[10px] text-warm-300">Severe</span>
              </div>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-xs font-medium text-warm-500 mb-1">
                Temperature
              </label>
              <div className="relative">
                <Thermometer
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-300"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  value={currentLog.temperature}
                  onChange={(e) =>
                    setCurrentLog((prev) => ({
                      ...prev,
                      temperature: e.target.value,
                    }))
                  }
                  placeholder="e.g. 98.6"
                  className="w-full pl-10 pr-12 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300 placeholder:text-warm-300"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-warm-400">
                  °F
                </span>
              </div>
            </div>
          </Card>

          {/* Emotional Check-In */}
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-warm-700">
              How are you feeling?
            </h3>
            <p className="text-xs text-warm-400">
              Choose as many as feel true right now. No judgment.
            </p>
            <div className="flex flex-wrap gap-2">
              {EMOTION_WORDS.map((emotion) => (
                <button
                  key={emotion}
                  onClick={() => toggleEmotion(emotion)}
                  className={`px-4 py-2 rounded-2xl text-xs font-medium capitalize transition-all ${
                    currentLog.emotions.includes(emotion)
                      ? 'bg-warm-400 text-white'
                      : 'bg-warm-50 text-warm-400 border border-warm-100 hover:bg-warm-100'
                  }`}
                >
                  {emotion}
                </button>
              ))}
            </div>
          </Card>

          {/* hCG Tracking */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <TrendingDown
                size={16}
                className="text-warm-400"
                strokeWidth={1.5}
              />
              <h3 className="text-sm font-semibold text-warm-700">
                hCG Tracking
              </h3>
            </div>
            <p className="text-xs text-warm-400">
              Track your hCG as it returns to zero. Some find this helps with
              closure — only use it if it serves you.
            </p>

            <div className="flex gap-2">
              <input
                type="date"
                value={hcgInput.date}
                onChange={(e) =>
                  setHcgInput((prev) => ({ ...prev, date: e.target.value }))
                }
                className="flex-1 px-3 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
              />
              <div className="relative flex-1">
                <input
                  type="number"
                  value={hcgInput.value}
                  onChange={(e) =>
                    setHcgInput((prev) => ({ ...prev, value: e.target.value }))
                  }
                  placeholder="hCG value"
                  className="w-full px-3 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300 placeholder:text-warm-300"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-warm-400">
                  mIU/mL
                </span>
              </div>
              <button
                onClick={addHCGReading}
                className="shrink-0 w-11 h-11 rounded-2xl bg-warm-600 text-white flex items-center justify-center hover:bg-warm-500 transition-colors"
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>

            {hcgReadings.length > 0 && (
              <div className="h-48 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hcgChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e8e2da"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#a39585' }}
                      axisLine={{ stroke: '#e8e2da' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#a39585' }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'white',
                        border: '1px solid #e8e2da',
                        borderRadius: '16px',
                        fontSize: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      }}
                      formatter={(value: any) => [
                        `${value} mIU/mL`,
                        'hCG',
                      ]}
                    />
                    <ReferenceLine
                      y={5}
                      stroke="#c4b9ac"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Negative (<5)',
                        position: 'right',
                        fontSize: 10,
                        fill: '#a39585',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#a39585"
                      strokeWidth={2}
                      dot={{ fill: '#a39585', r: 4 }}
                      activeDot={{ r: 6, fill: '#7a6e62' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {hcgReadings.length > 0 && (
              <div className="space-y-1.5">
                {hcgReadings.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs text-warm-500 px-1"
                  >
                    <span>
                      {format(new Date(r.date + 'T00:00:00'), 'MMM d, yyyy')}
                    </span>
                    <span className="font-medium text-warm-700">
                      {r.value} mIU/mL
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* First Period */}
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <Clock
                size={16}
                className="text-warm-400"
                strokeWidth={1.5}
              />
              <h3 className="text-sm font-semibold text-warm-700">
                First Period Return
              </h3>
            </div>

            <button
              onClick={() => setPeriodReturned(!periodReturned)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl border text-sm transition-all ${
                periodReturned
                  ? 'border-warm-400 bg-warm-50 text-warm-700'
                  : 'border-warm-200 bg-warm-50/50 text-warm-400'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                  periodReturned
                    ? 'bg-warm-400 border-warm-400'
                    : 'border-warm-300'
                }`}
              >
                {periodReturned && (
                  <Check size={12} className="text-white" strokeWidth={3} />
                )}
              </div>
              First period has returned
            </button>

            {periodReturned && (
              <input
                type="date"
                value={periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-warm-200 text-sm text-warm-800 bg-warm-50/50 focus:outline-none focus:ring-2 focus:ring-warm-300"
              />
            )}
          </Card>

          {/* Save daily log */}
          <button
            onClick={saveDailyLog}
            className="w-full py-3 rounded-2xl bg-warm-600 text-white text-sm font-medium hover:bg-warm-500 transition-colors"
          >
            Save Today's Check-In
          </button>

          {dailyLogs.length > 0 && (
            <p className="text-xs text-warm-400 text-center">
              {dailyLogs.length} day{dailyLogs.length !== 1 ? 's' : ''} logged
            </p>
          )}
        </section>
      )}

      {/* ─── 4. Recovery Milestones ─── */}
      {lossEvent && applicableMilestones.length > 0 && (
        <section className="space-y-3">
          <SectionHeading>Gentle Milestones</SectionHeading>
          <div className="space-y-3">
            {applicableMilestones.map((m) => (
              <Card key={m.weekThreshold} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-warm-50 flex items-center justify-center">
                    <Feather
                      size={14}
                      className="text-warm-400"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-warm-400 mb-1">
                      {m.weekThreshold === 8
                        ? 'Week 8+'
                        : `Week ${m.weekThreshold}`}
                    </p>
                    <p className="text-sm text-warm-700 leading-relaxed">
                      {m.message}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ─── 5. Resources ─── */}
      <section className="space-y-3">
        <SectionHeading>Resources</SectionHeading>

        {/* When to call your provider */}
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <AlertTriangle
                size={14}
                className="text-amber-500"
                strokeWidth={1.5}
              />
            </div>
            <h3 className="text-sm font-semibold text-warm-700">
              When to call your provider
            </h3>
          </div>
          <ul className="space-y-2.5">
            {[
              'Fever above 100.4°F',
              'Soaking through a pad in one hour or less',
              'Foul-smelling discharge',
              'Severe or worsening pain',
            ].map((sign) => (
              <li
                key={sign}
                className="flex items-start gap-2.5 text-sm text-warm-600"
              >
                <Phone
                  size={13}
                  className="text-warm-400 mt-0.5 shrink-0"
                  strokeWidth={1.5}
                />
                {sign}
              </li>
            ))}
          </ul>
          <p className="text-xs text-warm-400 mt-4">
            Trust your instincts. If something feels wrong, call. You are not
            overreacting.
          </p>
        </Card>

        {/* You are not alone */}
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-warm-50 flex items-center justify-center">
              <Shield
                size={14}
                className="text-warm-400"
                strokeWidth={1.5}
              />
            </div>
            <h3 className="text-sm font-semibold text-warm-700">
              You are not alone
            </h3>
          </div>
          <div className="space-y-3">
            {[
              {
                name: 'Share Pregnancy & Infant Loss Support',
                url: 'https://www.nationalshare.org',
              },
              {
                name: 'RESOLVE: The National Infertility Association',
                url: 'https://resolve.org',
              },
              {
                name: 'Postpartum Support International',
                url: 'https://www.postpartum.net',
              },
            ].map((org) => (
              <a
                key={org.name}
                href={org.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-2xl bg-warm-50/80 hover:bg-warm-100 transition-colors group"
              >
                <span className="text-sm text-warm-600 group-hover:text-warm-800 transition-colors">
                  {org.name}
                </span>
                <ExternalLink
                  size={14}
                  className="text-warm-300 group-hover:text-warm-500 transition-colors shrink-0"
                  strokeWidth={1.5}
                />
              </a>
            ))}
          </div>
        </Card>

        {/* For your partner */}
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-warm-50 flex items-center justify-center">
              <Users
                size={14}
                className="text-warm-400"
                strokeWidth={1.5}
              />
            </div>
            <h3 className="text-sm font-semibold text-warm-700">
              For your partner
            </h3>
          </div>
          <p className="text-sm text-warm-500 leading-relaxed">
            Partners grieve too — often in silence, often feeling like they need
            to be strong. Their loss is real, and their feelings matter.
          </p>
          <p className="text-xs text-warm-400 mt-3">
            Partners can track their own experience in the Partner Dashboard.
          </p>
        </Card>
      </section>

      {/* ─── 6. Return to TTC ─── */}
      {showReturnToTTC && (
        <section className="space-y-3">
          <Card className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-2xl bg-warm-50 flex items-center justify-center">
                <Feather
                  size={18}
                  className="text-warm-400"
                  strokeWidth={1.5}
                />
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-warm-700">
                  Thinking about trying again?
                </h3>
                <p className="text-sm text-warm-500 leading-relaxed">
                  There is no rush, and there is no right time. If and when
                  you're ready, iyla will support you — with your full history
                  preserved and honored.
                </p>
                <p className="text-xs text-warm-400">
                  Please confirm with your provider before starting a new cycle
                  after a loss.
                </p>
                <button className="flex items-center gap-2 mt-2 px-5 py-2.5 rounded-2xl bg-warm-600 text-white text-sm font-medium hover:bg-warm-500 transition-colors">
                  Start a new cycle
                  <ArrowRight size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
