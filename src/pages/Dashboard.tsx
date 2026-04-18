import { format } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { Plus, Sparkles, Thermometer, Droplets, Zap, Heart, TrendingUp, Eye, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useCurrentCycle, useCycleReadings, useTodayReading, useRecentReadings, useSupplements, useSupplementLogs, useIntelligence } from '../lib/hooks';
import { assessFertility, getStatusLabel, getStatusGradient, getStatusGlow, getPhaseLabel } from '../lib/fertility-engine';
import CycleChart from '../components/CycleChart';
import DataEntryModal from '../components/DataEntryModal';
import SupplementChecklist from '../components/SupplementChecklist';
import StartCyclePrompt from '../components/StartCyclePrompt';
import { getUserRole, isOnboarded } from '../components/StartCyclePrompt';
import WeekStrip from '../components/WeekStrip';
import type { FertilityStatus, CyclePhase } from '../lib/types';
import { pushStatus, isSyncEnabled, getPairCode } from '../lib/sync';
import ScoreRing from '../components/intelligence/ScoreRing';
import ScoreDrilldownModal from '../components/intelligence/ScoreDrilldownModal';
import PredictionsCard from '../components/intelligence/PredictionsCard';
import PatternsCard from '../components/intelligence/PatternsCard';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const ALL_STATUSES: FertilityStatus[] = ['low', 'menstrual', 'rising', 'high', 'peak', 'confirmed_ovulation', 'luteal'];

const PREVIEW_DATA: Record<FertilityStatus, {
  phase: CyclePhase;
  cd: number;
  recommendation: string;
  bbt: string;
  lh: string;
  kegg: string;
  pdg: string;
  signals: { source: string; signal: string; direction: 'positive' | 'neutral' | 'negative' }[];
}> = {
  low: {
    phase: 'follicular', cd: 6,
    recommendation: 'Early follicular phase. Your body is quietly building toward the next window.',
    bbt: '97.24°F', lh: '3.2', kegg: '1580', pdg: '0.8',
    signals: [
      { source: 'TempDrop', signal: 'BBT in follicular range (97.24°F)', direction: 'neutral' },
      { source: 'Inito', signal: 'LH baseline (3.2 mIU/mL)', direction: 'neutral' },
      { source: 'Kegg', signal: 'Impedance stable', direction: 'neutral' },
    ],
  },
  menstrual: {
    phase: 'menstrual', cd: 2,
    recommendation: 'Rest and replenish. Focus on iron-rich foods, warmth, and gentle movement today.',
    bbt: '97.18°F', lh: '2.1', kegg: '—', pdg: '0.4',
    signals: [
      { source: 'TempDrop', signal: 'BBT: 97.18°F (menstrual phase)', direction: 'neutral' },
      { source: 'Inito', signal: 'LH baseline (2.1 mIU/mL)', direction: 'neutral' },
    ],
  },
  rising: {
    phase: 'follicular', cd: 10,
    recommendation: 'Fertility is building. Your body is preparing — the window is approaching.',
    bbt: '97.31°F', lh: '8.4', kegg: '1340', pdg: '1.2',
    signals: [
      { source: 'Inito', signal: 'Estrogen gradually rising (42.3 pg/mL)', direction: 'positive' },
      { source: 'Kegg', signal: 'Impedance declining — approaching fertile window', direction: 'positive' },
      { source: 'TempDrop', signal: 'BBT in follicular range (97.31°F)', direction: 'neutral' },
      { source: 'Manual', signal: 'Cervical mucus: creamy', direction: 'neutral' },
    ],
  },
  high: {
    phase: 'ovulatory', cd: 13,
    recommendation: 'Your fertile window is open. Your body is doing beautiful work right now.',
    bbt: '97.28°F', lh: '14.6', kegg: '1120', pdg: '1.8',
    signals: [
      { source: 'Inito', signal: 'LH rising (14.6 mIU/mL)', direction: 'positive' },
      { source: 'Inito', signal: 'Estrogen rising significantly (68.7 pg/mL)', direction: 'positive' },
      { source: 'Kegg', signal: 'Impedance dropping sharply — fertile mucus developing', direction: 'positive' },
      { source: 'Manual', signal: 'Cervical mucus: egg white', direction: 'positive' },
    ],
  },
  peak: {
    phase: 'ovulatory', cd: 14,
    recommendation: 'Your body is giving strong signals. Multiple sources confirm peak fertility today.',
    bbt: '97.22°F', lh: '42.8', kegg: '980', pdg: '2.1',
    signals: [
      { source: 'Inito', signal: 'LH surge detected (42.8 mIU/mL)', direction: 'positive' },
      { source: 'Inito', signal: 'Estrogen rising significantly (82.4 pg/mL)', direction: 'positive' },
      { source: 'Kegg', signal: 'Impedance dropping sharply — fertile mucus developing', direction: 'positive' },
      { source: 'Manual', signal: 'Cervical mucus: egg white', direction: 'positive' },
      { source: 'TempDrop', signal: 'BBT in follicular range (97.22°F)', direction: 'neutral' },
    ],
  },
  confirmed_ovulation: {
    phase: 'luteal', cd: 16,
    recommendation: 'Ovulation confirmed. Nourish yourself — progesterone support, rest, and calm.',
    bbt: '97.82°F', lh: '5.3', kegg: '1650', pdg: '7.7',
    signals: [
      { source: 'TempDrop', signal: 'Thermal shift detected (+0.48°F) — ovulation confirmed', direction: 'negative' },
      { source: 'Inito', signal: 'PdG rising (7.7 µg/mL) — ovulation likely confirmed', direction: 'negative' },
      { source: 'Kegg', signal: 'Impedance rising — post-ovulatory pattern', direction: 'negative' },
      { source: 'Inito', signal: 'LH baseline (5.3 mIU/mL)', direction: 'neutral' },
    ],
  },
  luteal: {
    phase: 'luteal', cd: 22,
    recommendation: 'You\'re in the luteal phase. Prioritize sleep, warmth, and your supplement protocol.',
    bbt: '97.91°F', lh: '3.8', kegg: '1720', pdg: '9.2',
    signals: [
      { source: 'TempDrop', signal: 'BBT sustained elevated (97.91°F)', direction: 'neutral' },
      { source: 'Inito', signal: 'PdG strong (9.2 µg/mL) — good luteal support', direction: 'neutral' },
      { source: 'Kegg', signal: 'Impedance stable — post-ovulatory', direction: 'neutral' },
    ],
  },
};

export default function Dashboard() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [scoreDrilldownOpen, setScoreDrilldownOpen] = useState(false);
  const intelligence = useIntelligence();
  const cycle = useCurrentCycle();
  const readings = useCycleReadings(cycle?.id);
  const selectedReading = useTodayReading(cycle?.id, selectedDate);
  const todayReading = useTodayReading(cycle?.id, todayStr);
  const recentReadings = useRecentReadings(cycle?.id, selectedDate, 7);
  const supplements = useSupplements();
  const supplementLogs = useSupplementLogs(todayStr);

  const lastPushedRef = useRef('');

  const startDate = cycle ? new Date(cycle.startDate + 'T00:00:00') : null;
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const todayDate = new Date(todayStr + 'T00:00:00');
  const viewingCycleDay = startDate
    ? Math.floor((selectedDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;
  const todayCycleDay = startDate
    ? Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const isViewingToday = selectedDate === todayStr;

  const assessment = selectedReading && cycle
    ? assessFertility(selectedReading, recentReadings, viewingCycleDay)
    : null;

  const todayAssessment = todayReading && cycle
    ? assessFertility(todayReading, recentReadings, todayCycleDay)
    : null;

  const viewStatus: FertilityStatus = assessment?.status ?? (viewingCycleDay <= 5 && viewingCycleDay > 0 ? 'menstrual' : 'low');
  const todayStatus: FertilityStatus = todayAssessment?.status ?? (todayCycleDay <= 5 && todayCycleDay > 0 ? 'menstrual' : 'low');

  // Push TODAY's status to partner (always uses today, not selected date)
  useEffect(() => {
    if (!cycle || previewMode || !isSyncEnabled()) return;
    const key = `${todayStatus}:${todayCycleDay}`;
    if (key === lastPushedRef.current) return;
    lastPushedRef.current = key;

    const phase = todayAssessment?.phase ?? (todayCycleDay <= 5 ? 'menstrual' : 'follicular');
    const recommendation = todayAssessment?.recommendation ?? '';
    pushStatus({
      fertilityStatus: todayStatus,
      cycleDay: todayCycleDay,
      phase,
      recommendation,
    });
  }, [cycle, todayStatus, todayCycleDay, previewMode, todayAssessment]);

  if (getUserRole() === 'partner' && isOnboarded()) {
    window.location.href = '/partner';
    return null;
  }

  if (!cycle) {
    return <StartCyclePrompt />;
  }

  const previewStatus = ALL_STATUSES[previewIndex];
  const preview = PREVIEW_DATA[previewStatus];

  const status = previewMode ? previewStatus : viewStatus;
  const cycleDay = previewMode ? preview.cd : viewingCycleDay;
  const displayPhase = previewMode ? preview.phase : (assessment?.phase ?? (viewingCycleDay <= 5 ? 'menstrual' as CyclePhase : 'follicular' as CyclePhase));
  const displayRecommendation = previewMode ? preview.recommendation : (assessment?.recommendation ?? 'Log your morning readings to receive your personalized insight.');
  const displaySignals = previewMode ? preview.signals : (assessment?.signals ?? []);

  function nextPreview() {
    setPreviewIndex(i => (i + 1) % ALL_STATUSES.length);
  }
  function prevPreview() {
    setPreviewIndex(i => (i - 1 + ALL_STATUSES.length) % ALL_STATUSES.length);
  }

  return (
    <div className="space-y-6">
      {/* Sync Status Banner */}
      {isSyncEnabled() && getPairCode() && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-700">
            Syncing to partner — code {getPairCode()}
          </span>
        </div>
      )}
      {isSyncEnabled() && !getPairCode() && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs font-medium text-amber-700">
            Partner sync ready but no pairing code set. Re-load your profile from the welcome screen.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warm-800">{isViewingToday ? getGreeting() : format(selectedDateObj, 'EEEE, MMMM d')}</h1>
          <p className="text-warm-400 text-sm mt-1">
            {isViewingToday ? format(new Date(), 'EEEE, MMMM d') : (
              <button onClick={() => setSelectedDate(todayStr)} className="text-teal-600 hover:text-teal-700 font-medium transition-colors">
                ← Back to today
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setPreviewMode(!previewMode); setPreviewIndex(0); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-medium transition-all duration-200 ${
              previewMode
                ? 'bg-violet-100 text-violet-600 shadow-sm'
                : 'bg-warm-100 text-warm-400 hover:bg-warm-150 hover:text-warm-600'
            }`}
          >
            <Eye size={13} strokeWidth={2} />
            Preview
          </button>
          <button
            onClick={() => setEntryModalOpen(true)}
            className="flex items-center gap-2 bg-warm-800 text-white px-5 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-900 transition-all duration-200 shadow-sm active:scale-[0.97]"
          >
            {selectedReading ? <Pencil size={14} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
            {isViewingToday ? (selectedReading ? 'Edit' : 'Log') : `CD${viewingCycleDay}`}
          </button>
        </div>
      </div>

      {/* Week Calendar Strip */}
      <WeekStrip cycleId={cycle.id} cycleStartDate={cycle.startDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Preview Controls */}
      {previewMode && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={prevPreview} className="p-2 rounded-xl bg-white border border-warm-200 text-warm-400 hover:text-warm-600 hover:bg-warm-50 transition-all active:scale-95">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            {ALL_STATUSES.map((s, i) => (
              <button
                key={s}
                onClick={() => setPreviewIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === previewIndex ? 'w-6 bg-warm-700' : 'w-2 bg-warm-200 hover:bg-warm-300'
                }`}
              />
            ))}
          </div>
          <button onClick={nextPreview} className="p-2 rounded-xl bg-white border border-warm-200 text-warm-400 hover:text-warm-600 hover:bg-warm-50 transition-all active:scale-95">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* --- HERO STATUS CARD --- */}
      <div
        key={status}
        className={`status-card-glow rounded-3xl bg-gradient-to-br ${getStatusGradient(status)} p-7 shadow-lg ${getStatusGlow(status)} text-white`}
      >
        <div className="flex items-start justify-between relative z-10">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-white/70" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
                {getPhaseLabel(displayPhase)}
              </span>
            </div>
            <h2 className="text-2xl font-bold mt-1 tracking-tight">
              {getStatusLabel(status)}
            </h2>
            <p className="text-white/80 text-sm mt-3 leading-relaxed max-w-md">
              {displayRecommendation}
            </p>

            {(assessment || previewMode) && (
              <div className="flex items-center gap-2.5 mt-4 flex-wrap">
                <span className="text-xs px-3 py-1 rounded-full font-medium backdrop-blur-sm bg-white/25 text-white">
                  {previewMode ? 'high' : assessment!.confidence} confidence
                </span>
                {previewMode && previewStatus === 'rising' && (
                  <span className="text-xs px-3 py-1 rounded-full bg-white/20 text-white/90 font-medium backdrop-blur-sm">
                    Signals concordant
                  </span>
                )}
                {!previewMode && assessment && !assessment.concordance && assessment.signals.length >= 2 && (
                  <span className="text-xs px-3 py-1 rounded-full bg-white/20 text-white/90 font-medium backdrop-blur-sm">
                    Signals diverging
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Cycle Day Ring */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex flex-col items-center justify-center border border-white/30">
              <span className="text-xs font-medium text-white/60 -mb-0.5">Today is</span>
              <span className="text-2xl font-bold text-white">CD {cycleDay}</span>
            </div>
          </div>
        </div>

        {/* Signal Reports */}
        {displaySignals.length > 0 && (
          <div className="mt-5 pt-5 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-2 relative z-10">
            {displaySignals.map((sig, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-white/70">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  sig.direction === 'positive' ? 'bg-white' :
                  sig.direction === 'negative' ? 'bg-white/50' :
                  'bg-white/30'
                }`} />
                <span><span className="font-medium text-white/90">{sig.source}:</span> {sig.signal}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickStat
          icon={<Thermometer size={15} className="text-rose-500" strokeWidth={1.5} />}
          label="BBT"
          value={previewMode ? preview.bbt : (selectedReading?.bbt ? `${selectedReading.bbt}°F` : '—')}
          accent="rose"
        />
        <QuickStat
          icon={<Zap size={15} className="text-amber-500" strokeWidth={1.5} />}
          label="LH"
          value={previewMode ? preview.lh : (selectedReading?.lh ? `${selectedReading.lh}` : '—')}
          accent="amber"
        />
        <QuickStat
          icon={<Droplets size={15} className="text-teal-500" strokeWidth={1.5} />}
          label="Kegg"
          value={previewMode ? preview.kegg : (selectedReading?.keggImpedance ? `${selectedReading.keggImpedance}` : '—')}
          accent="teal"
        />
        <QuickStat
          icon={<Heart size={15} className="text-violet-500" strokeWidth={1.5} />}
          label="PdG"
          value={previewMode ? preview.pdg : (selectedReading?.pdg ? `${selectedReading.pdg}` : '—')}
          accent="violet"
        />
      </div>

      {/* iyla Score — the flagship unified metric */}
      {intelligence && !previewMode && (
        <ScoreRing score={intelligence.score} onClick={() => setScoreDrilldownOpen(true)} />
      )}

      {/* Predictions */}
      {intelligence && !previewMode && (
        <PredictionsCard predictions={intelligence.predictions} today={todayStr} />
      )}

      {/* Cycle Chart */}
      <div className="bg-white rounded-3xl border border-warm-100 p-7 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-warm-700">Cycle Overview</h2>
          <div className="flex items-center gap-1.5 text-xs text-warm-400 font-medium">
            <TrendingUp size={13} strokeWidth={2} />
            {readings.length} readings
          </div>
        </div>
        <CycleChart readings={readings} cycleDay={todayCycleDay} />
      </div>

      {/* Pattern detection */}
      {intelligence && !previewMode && intelligence.patterns.length > 0 && (
        <PatternsCard patterns={intelligence.patterns} limit={4} />
      )}

      {/* Supplement Checklist */}
      <div className="bg-white rounded-3xl border border-warm-100 p-7 shadow-sm">
        <h2 className="text-base font-semibold text-warm-700 mb-5">Today's Supplements</h2>
        <SupplementChecklist
          supplements={supplements}
          logs={supplementLogs}
          date={todayStr}
        />
      </div>

      {/* Data Entry Modal */}
      <DataEntryModal
        key={selectedDate}
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        cycleId={cycle.id!}
        cycleDay={viewingCycleDay}
        date={selectedDate}
        existingReading={selectedReading}
      />

      {/* Score Drilldown Modal */}
      {intelligence && (
        <ScoreDrilldownModal
          open={scoreDrilldownOpen}
          onClose={() => setScoreDrilldownOpen(false)}
          score={intelligence.score}
        />
      )}
    </div>
  );
}

function QuickStat({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  const bgMap: Record<string, string> = {
    rose: 'bg-rose-50',
    amber: 'bg-amber-50',
    teal: 'bg-teal-50',
    violet: 'bg-violet-50',
  };

  return (
    <div className="bg-white rounded-2xl border border-warm-100 p-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-default">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-7 h-7 rounded-xl ${bgMap[accent] ?? 'bg-warm-50'} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-xs text-warm-400 font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold text-warm-700">{value}</p>
    </div>
  );
}
